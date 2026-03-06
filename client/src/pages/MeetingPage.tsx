import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
  MessageSquare, PhoneOff, Users, User,
  ShieldCheck, Pin, PinOff, X, Send,
  ZoomIn, ZoomOut, Maximize2, Minimize2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Participant {
  id: string;
  username: string;
  isScreenSharing?: boolean;
  stream?: MediaStream;
  audioMuted?: boolean;
  videoOff?: boolean;
}
interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  text: string;
  time: string;
}
interface Toast { id: number; text: string; icon: string; }
type Corner = 'tl' | 'tr' | 'bl' | 'br';

// ─── Audio notification beeps (Web Audio API — no files needed) ───────────────
function beep(type: 'join' | 'leave' | 'message') {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    if (type === 'join') {
      osc.frequency.setValueAtTime(523, t);
      osc.frequency.setValueAtTime(659, t + 0.1);
      osc.frequency.setValueAtTime(784, t + 0.22);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t); osc.stop(t + 0.55);
    } else if (type === 'leave') {
      osc.frequency.setValueAtTime(784, t);
      osc.frequency.setValueAtTime(659, t + 0.1);
      osc.frequency.setValueAtTime(523, t + 0.22);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t); osc.stop(t + 0.55);
    } else {
      osc.frequency.setValueAtTime(1046, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.12);
    }
    setTimeout(() => { try { ctx.close(); } catch {} }, 700);
  } catch {}
}

// ─── Remote Video Tile ────────────────────────────────────────────────────────
const RemoteVideo = React.memo(function RemoteVideo({
  participant, big, isPinned, onPin,
}: {
  participant: Participant; big?: boolean; isPinned: boolean; onPin: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && participant.stream) {
      if (ref.current.srcObject !== participant.stream) {
        ref.current.srcObject = participant.stream;
      }
    }
  }, [participant.stream]);

  const initial = participant.username?.charAt(0)?.toUpperCase() || '?';
  const showAvatar = !participant.stream || participant.videoOff;

  return (
    <div className="w-full h-full relative bg-zinc-900 group overflow-hidden">
      <video
        ref={ref}
        autoPlay playsInline
        className={`w-full h-full object-cover ${showAvatar ? 'invisible' : 'visible'}`}
      />
      {showAvatar && (
        <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
          <div className={`rounded-full bg-zinc-700 flex items-center justify-center ${big ? 'w-24 h-24 md:w-32 md:h-32' : 'w-10 h-10 md:w-14 md:h-14'}`}>
            <span className={`font-bold text-zinc-300 ${big ? 'text-3xl' : 'text-base'}`}>{initial}</span>
          </div>
        </div>
      )}
      {/* Name + status bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pb-2 pt-8 px-2 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-xs font-semibold truncate flex-1 drop-shadow">
            {participant.username}{participant.isScreenSharing ? ' · 🖥️' : ''}
          </span>
          {participant.audioMuted && (
            <span className="bg-red-500/90 rounded-full p-0.5 flex-shrink-0"><MicOff size={9} className="text-white" /></span>
          )}
          {participant.videoOff && (
            <span className="bg-zinc-700/90 rounded-full p-0.5 flex-shrink-0"><VideoOff size={9} className="text-zinc-300" /></span>
          )}
        </div>
      </div>
      {/* Pin button */}
      <button
        onClick={e => { e.stopPropagation(); onPin(); }}
        className={`absolute top-1.5 right-1.5 p-1.5 rounded-lg transition-all ${
          isPinned ? 'bg-indigo-600 text-white opacity-100' : 'bg-black/50 text-zinc-300 opacity-0 group-hover:opacity-100'
        }`}
      >
        {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
      </button>
    </div>
  );
});

// ─── Screen Share Viewer (zoom / pan / fullscreen) ────────────────────────────
function ScreenViewer({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [zoom,   setZoom]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [full,   setFull]   = useState(false);
  const dragging    = useRef(false);
  const dragOrigin  = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const lastPinch   = useRef(0);
  const touchPanRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  useEffect(() => { if (zoom <= 1) setOffset({ x: 0, y: 0 }); }, [zoom]);

  // Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.5, Math.min(5, z - e.deltaY * 0.004)));
  };

  // Mouse drag (pan when zoomed)
  const onMD = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    e.preventDefault();
  };
  const onMM = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: dragOrigin.current.ox + (e.clientX - dragOrigin.current.mx),
      y: dragOrigin.current.oy + (e.clientY - dragOrigin.current.my),
    });
  };
  const onMU = () => { dragging.current = false; };

  // Touch: pinch to zoom + 1-finger pan
  const onTS = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastPinch.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      touchPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const onTM = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (d - lastPinch.current) * 0.013;
      setZoom(z => Math.max(0.5, Math.min(5, z + delta)));
      lastPinch.current = d;
    } else if (e.touches.length === 1 && zoom > 1) {
      const dx = e.touches[0].clientX - touchPanRef.current.x;
      const dy = e.touches[0].clientY - touchPanRef.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      touchPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const wrapper = `${full ? 'fixed inset-0 z-50' : 'absolute inset-0'} bg-black flex flex-col overflow-hidden`;

  return (
    <div className={wrapper}>
      {/* Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <span className="text-white text-xs font-semibold bg-purple-600/80 px-2.5 py-1 rounded-lg pointer-events-auto">
          🖥️ {participant.username}'s screen
        </span>
        <div className="flex items-center gap-0.5 bg-black/70 rounded-xl px-1.5 py-1 pointer-events-auto">
          <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors">
            <ZoomOut size={14} />
          </button>
          <span className="text-zinc-400 text-[11px] font-mono w-9 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))}
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors">
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 bg-zinc-600 mx-0.5" />
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors text-[10px] font-bold px-2">
            1:1
          </button>
          <button
            onClick={() => setFull(f => !f)}
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors">
            {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Video — object-contain so all content is always visible, nothing cut off */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center"
        style={{ cursor: zoom > 1 ? (dragging.current ? 'grabbing' : 'grab') : 'default' }}
        onWheel={onWheel}
        onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
        onTouchStart={onTS} onTouchMove={onTM}
      >
        <video
          ref={videoRef}
          autoPlay playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',           // FIX: contain = no clipping
            transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            transformOrigin: 'center center',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── Control Button ────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, active, danger, icon, label, badge, disabled }: {
  onClick?: () => void; active?: boolean; danger?: boolean;
  icon: React.ReactNode; label?: string; badge?: number; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center gap-0.5 px-2 md:px-3.5 py-2 md:py-2.5 rounded-xl transition-all min-w-[44px] min-h-[44px] ${
        disabled ? 'opacity-40 cursor-not-allowed bg-zinc-900 text-zinc-600'
        : danger  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        : active  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }`}
    >
      {icon}
      {label && (
        <span className="text-[9px] font-bold uppercase tracking-tight hidden md:block leading-none mt-0.5">
          {label}
        </span>
      )}
      {/* FIX: Show exact participant count — no 9+ cap */}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MeetingPage() {
  const navigate  = useNavigate();

  const userType  = localStorage.getItem('userType') || 'student';
  const roomCode  = localStorage.getItem('currentRoomCode') || 'ROOM';
  const roomName  = localStorage.getItem('currentClassName') || 'Class';
  const userName  = localStorage.getItem('userName') || 'You';

  // ── State ──
  const [isMuted,      setIsMuted]      = useState(false);
  const [isCamOff,     setIsCamOff]     = useState(false);
  const [isSharing,    setIsSharing]    = useState(false);
  const [permDenied,   setPermDenied]   = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pinnedId,     setPinnedId]     = useState<string | null>(null);
  const [speakerId,    setSpeakerId]    = useState<string | null>(null);
  const [timer,        setTimer]        = useState(0);
  const [isChatOpen,   setIsChatOpen]   = useState(false);
  const [isPplOpen,    setIsPplOpen]    = useState(false);
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [chatInput,    setChatInput]    = useState('');
  const [unread,       setUnread]       = useState(0);
  const [toasts,       setToasts]       = useState<Toast[]>([]);
  const [corner,       setCorner]       = useState<Corner>('br');
  const [dragging,     setDragging]     = useState(false);
  const [floatPos,     setFloatPos]     = useState({ x: 0, y: 0 });
  const [swipeX,       setSwipeX]       = useState<number | null>(null);
  // selfOnMain: when true, local camera is in the BIG primary view,
  // remote participant moves to the floating corner tile
  const [selfOnMain,   setSelfOnMain]   = useState(false);

  // ── Refs (avoid stale closures in socket callbacks) ──
  const localVideoRef = useRef<HTMLVideoElement>(null);  // floating tile
  const mainVideoRef  = useRef<HTMLVideoElement>(null);  // primary area (self-on-main mode)
  const socketRef     = useRef<Socket | null>(null);
  const peersRef      = useRef<Record<string, RTCPeerConnection>>({});
  const localStream   = useRef<MediaStream | null>(null);
  const screenStream  = useRef<MediaStream | null>(null);
  const chatEndRef    = useRef<HTMLDivElement>(null);

  // ── Toast ──
  const toast = useCallback((text: string, icon: string) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p.slice(-3), { id, text, icon }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Timer ──
  useEffect(() => {
    const i = setInterval(() => setTimer(p => p + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const fmt = (s: number) =>
    [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map(v => String(v).padStart(2, '0')).join(':');

  // ─────────────────────────────────────────────────────────────────────────────
  // FIX 1 & 2: DUPLICATE USERS + CAMERA ICON
  //
  // Old code ran getUserMedia inside useEffect([isCameraOff]).
  // Every camera toggle → new stream → new socket join → server adds user again.
  // After enough toggles = 12 copies of same user in room list.
  //
  // Fix: Get media ONCE on mount. Camera/mic toggle just enables/disables the
  // existing track — no new stream, no new socket join.
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(ms => {
        if (!alive) { ms.getTracks().forEach(t => t.stop()); return; }
        localStream.current = ms;
        if (localVideoRef.current) localVideoRef.current.srcObject = ms;
        // Socket may not be connected yet — connect handler also emits join
        socketRef.current?.emit('join', { room: roomCode, username: userName });
      })
      .catch(err => {
        if (!alive) return;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermDenied(true);
          setTimeout(() => navigate('/join-room'), 3000);
        }
      });
    return () => {
      alive = false;
      localStream.current?.getTracks().forEach(t => t.stop());
      localStream.current = null;
    };
  }, []); // ← empty deps, runs exactly ONCE

  // ─────────────────────────────────────────────────────────────────────────────
  // FIX 3: CAMERA OFF ICON
  // Just flip track.enabled — no stream changes, no re-joining.
  // VideoOff icon shown clearly in floating tile when camera is off.
  // ─────────────────────────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    localStream.current?.getVideoTracks().forEach(t => { t.enabled = isCamOff; }); // flip
    setIsCamOff(p => !p);
  }, [isCamOff]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FIX 4: MIC MUTE — audio reaches peers via existing track
  // track.enabled=false immediately silences what remote peers hear.
  // ─────────────────────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const willMute = !isMuted;
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = !willMute; });
    setIsMuted(willMute);
    // Tell others our mic state so they can show the mic-off icon on our tile
    socketRef.current?.emit('media-state', { room: roomCode, audioMuted: willMute, videoOff: isCamOff });
  }, [isMuted, isCamOff, roomCode]);

  // Emit cam state change too
  useEffect(() => {
    if (localStream.current) {
      socketRef.current?.emit('media-state', { room: roomCode, audioMuted: isMuted, videoOff: isCamOff });
    }
  }, [isCamOff]);

  // ── Socket + WebRTC ──
  useEffect(() => {
    const URL = (import.meta as any).env?.VITE_VIDEO_URL || 'http://localhost:7000';
    const sock: Socket = io(URL, { reconnectionAttempts: 5 });
    socketRef.current = sock;

    sock.on('connect', () => {
      if (localStream.current) {
        sock.emit('join', { room: roomCode, username: userName });
      }
    });

    // Full user list (on join) — replace entirely + dedupe
    sock.on('users', (users: any[]) => {
      const map = new Map(users.map((u: any) => [u.id, u]));
      const unique = Array.from(map.values());
      setParticipants(unique.map((u: any) => ({
        id: u.id, username: u.username,
        isScreenSharing: u.isScreenSharing ?? false,
        audioMuted: u.audioMuted ?? false,
        videoOff: u.videoOff ?? false,
      })));
      unique.forEach((u: any) => makePeer(u.id, true, sock));
    });

    // Single new user joined
    sock.on('new-user', (u: any) => {
      setParticipants(prev => {
        if (prev.find(p => p.id === u.id)) return prev; // dedupe guard
        beep('join');
        toast(`${u.username} joined`, '👋');
        return [...prev, { id: u.id, username: u.username, isScreenSharing: false, audioMuted: false, videoOff: false }];
      });
      makePeer(u.id, false, sock);
    });

    sock.on('user-left', (u: any) => {
      setParticipants(prev => prev.filter(p => p.id !== u.id));
      peersRef.current[u.id]?.close();
      delete peersRef.current[u.id];
      setPinnedId(p => p === u.id ? null : p);
      setSpeakerId(p => p === u.id ? null : p);
      beep('leave');
      toast(`${u.username || 'Someone'} left`, '🚪');
    });

    sock.on('offer', async (data: any) => {
      if (!peersRef.current[data.sender]) makePeer(data.sender, false, sock);
      const pc = peersRef.current[data.sender];
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        sock.emit('answer', { answer: ans, target: data.sender });
      } catch (e) { console.warn('offer', e); }
    });

    sock.on('answer', async (data: any) => {
      const pc = peersRef.current[data.sender];
      if (pc?.signalingState === 'have-local-offer') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); } catch {}
      }
    });

    sock.on('ice', async (data: any) => {
      const pc = peersRef.current[data.sender];
      if (pc && data.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
      }
    });

    sock.on('screen-sharing', (data: { id: string; active: boolean }) => {
      setParticipants(prev => prev.map(p => p.id === data.id ? { ...p, isScreenSharing: data.active } : p));
      setSpeakerId(data.active ? data.id : null);
      if (data.active) toast('Screen share started', '🖥️');
    });

    // Remote mic/cam state — shows icons on their tile
    sock.on('media-state', (data: { id: string; audioMuted: boolean; videoOff: boolean }) => {
      setParticipants(prev => prev.map(p => p.id === data.id
        ? { ...p, audioMuted: data.audioMuted, videoOff: data.videoOff }
        : p
      ));
    });

    sock.on('chat-message', (data: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        beep('message');
        return [...prev, { ...data, id: data.id || String(Date.now()) }];
      });
      setUnread(p => p + 1);
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
    };
  }, []);

  // ── Peer connection factory ──
  function makePeer(id: string, init: boolean, sock: Socket) {
    peersRef.current[id]?.close(); // close stale
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });
    peersRef.current[id] = pc;

    localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current!));

    pc.ontrack = e => {
      const ms = e.streams[0];
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, stream: ms } : p));
      // VAD for auto speaker detection
      try {
        const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
        const an = ac.createAnalyser();
        an.fftSize = 512;
        ac.createMediaStreamSource(ms).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        let raf = 0;
        const check = () => {
          raf = requestAnimationFrame(check);
          an.getByteFrequencyData(buf);
          if (buf.reduce((a, b) => a + b, 0) / buf.length > 18) {
            setSpeakerId(cur => cur === id ? cur : id);
          }
        };
        check();
        pc.addEventListener('connectionstatechange', () => {
          if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
            cancelAnimationFrame(raf);
            try { ac.close(); } catch {}
          }
        });
      } catch {}
    };

    pc.onicecandidate = e => {
      if (e.candidate) sock.emit('ice', { candidate: e.candidate, target: id });
    };

    if (init) {
      pc.createOffer()
        .then(o => { pc.setLocalDescription(o); sock.emit('offer', { offer: o, target: id }); })
        .catch(console.error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN SHARE — Enhanced for mobile + desktop
  //
  // Why WhatsApp/Google Meet work on Android but basic getDisplayMedia fails:
  // - Android Chrome 72+ supports getDisplayMedia but requires specific options
  // - iOS Safari does NOT support screen share at all (OS restriction)
  // - Some old Android WebViews also don't support it
  // - The fix: detect support properly, request with mobile-friendly options,
  //   and show a clear message on unsupported browsers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleShareScreen = async () => {
    if (isSharing) {
      // Stop sharing
      screenStream.current?.getTracks().forEach(t => t.stop());
      screenStream.current = null;
      setIsSharing(false);
      const cam = localStream.current?.getVideoTracks()[0];
      if (cam) Object.values(peersRef.current).forEach(pc => {
        pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(cam);
      });
      if (localVideoRef.current && localStream.current) {
        localVideoRef.current.srcObject = localStream.current;
      }
      socketRef.current?.emit('screen-sharing', { room: roomCode, active: false });
      return;
    }

    // ── Detect support properly ──
    // navigator.mediaDevices.getDisplayMedia = desktop Chrome/Firefox/Edge + Android Chrome 72+
    // It does NOT exist on: iOS Safari, old Android WebView, Firefox for Android
    const hasDisplayMedia = !!(
      navigator.mediaDevices &&
      typeof (navigator.mediaDevices as any).getDisplayMedia === 'function'
    );

    if (!hasDisplayMedia) {
      // Detect iOS specifically for a more helpful message
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        toast('iOS does not support screen sharing in browsers. Use a desktop browser.', '⚠️');
      } else {
        toast('Screen sharing not supported. Try Chrome or Edge on Android/desktop.', '⚠️');
      }
      return;
    }

    try {
      // Mobile-friendly getDisplayMedia options:
      // - preferCurrentTab: false → let user pick any screen/app (Android)
      // - surfaceSwitching: 'include' → show switch button during share
      // - selfBrowserSurface: 'exclude' → don't show current tab in picker
      const displayOptions: any = {
        video: {
          cursor: 'always',
          // Don't set frameRate/width here — let browser choose best for device
        },
        audio: false, // Audio capture not supported on mobile
        // Chrome-specific hints that improve mobile UX
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: 'exclude',
      };

      const ss = await (navigator.mediaDevices as any).getDisplayMedia(displayOptions);
      screenStream.current = ss;
      setIsSharing(true);

      const track = ss.getVideoTracks()[0];

      // Replace video track in all peer connections
      Object.values(peersRef.current).forEach(pc => {
        pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(track);
      });

      // Show screen in local floating preview
      if (localVideoRef.current) localVideoRef.current.srcObject = ss;

      socketRef.current?.emit('screen-sharing', { room: roomCode, active: true });
      toast('Screen sharing started', '🖥️');

      // Handle user clicking "Stop sharing" in browser's native UI
      track.addEventListener('ended', () => handleShareScreen());

    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        toast('Screen share permission denied', '🚫');
      } else if (e.name === 'NotSupportedError') {
        toast('Screen sharing not supported on this device', '⚠️');
      } else {
        toast('Screen share cancelled', '⚠️');
        console.error('[screen-share]', e);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTO PICTURE-IN-PICTURE when user switches tab / minimizes browser
  //
  // When the user leaves the meeting tab, the local camera video enters PiP
  // mode automatically — just like Google Meet's floating meeting window.
  // The PiP window stays on screen so they can see/hear the meeting.
  // It dismisses automatically when they return to the tab.
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const pipVideoRef = localVideoRef;

    const enterPip = async () => {
      try {
        const vid = pipVideoRef.current;
        if (!vid) return;
        // Only enter PiP if the API is supported and we're not already in PiP
        if (document.pictureInPictureEnabled && !(document as any).pictureInPictureElement) {
          // Make sure video has a valid srcObject and is playing
          if (vid.readyState >= 2 && !vid.paused) {
            await (vid as any).requestPictureInPicture();
          }
        }
      } catch {}
    };

    const exitPip = async () => {
      try {
        if ((document as any).pictureInPictureElement) {
          await (document as any).exitPictureInPicture();
        }
      } catch {}
    };

    const onVisChange = () => {
      if (document.hidden) {
        enterPip();
      } else {
        exitPip();
      }
    };

    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      // Clean up PiP on unmount
      if ((document as any).pictureInPictureElement) {
        (document as any).exitPictureInPicture().catch(() => {});
      }
    };
  }, []);

  // ── Camera swap: toggle self between floating corner and main screen ──
  const swapCamera = () => {
    setSelfOnMain(prev => {
      const next = !prev;
      // When switching to self-on-main, attach stream to mainVideoRef
      // When switching back to floating, re-attach to localVideoRef
      setTimeout(() => {
        const src = isSharing ? screenStream.current : localStream.current;
        if (src) {
          if (next && mainVideoRef.current)  mainVideoRef.current.srcObject  = src;
          if (!next && localVideoRef.current) localVideoRef.current.srcObject = src;
        }
      }, 0);
      return next;
    });
  };

  // Keep mainVideoRef in sync when selfOnMain is true and stream changes
  useEffect(() => {
    if (selfOnMain && mainVideoRef.current) {
      const src = isSharing ? screenStream.current : localStream.current;
      if (src) mainVideoRef.current.srcObject = src;
    }
  }, [selfOnMain, isSharing]);
  const sendChat = useCallback(() => {
    const txt = chatInput.trim();
    if (!txt || !socketRef.current) return;
    const msg: ChatMessage = {
      id: String(Date.now()),
      sender: userName,
      text: txt,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    socketRef.current.emit('chat-message', { ...msg, room: roomCode });
    setMessages(prev => [...prev, msg]);
    setChatInput('');
  }, [chatInput, userName, roomCode]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (isChatOpen) setUnread(0); }, [isChatOpen]);

  // ── Floating tile drag ──
  const onFMD = (e: React.MouseEvent) => { setDragging(true); setFloatPos({ x: e.clientX, y: e.clientY }); e.preventDefault(); };
  const onFTS = (e: React.TouchEvent) => { setDragging(true); setFloatPos({ x: e.touches[0].clientX, y: e.touches[0].clientY }); };

  useEffect(() => {
    if (!dragging) return;
    const mv = (e: MouseEvent | TouchEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      setFloatPos({ x, y });
    };
    const up = (e: MouseEvent | TouchEvent) => {
      setDragging(false);
      const x = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
      const y = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;
      setCorner(x < window.innerWidth / 2 ? (y < window.innerHeight / 2 ? 'tl' : 'bl') : (y < window.innerHeight / 2 ? 'tr' : 'br'));
    };
    window.addEventListener('mousemove', mv as any);
    window.addEventListener('mouseup',   up as any);
    window.addEventListener('touchmove', mv as any, { passive: true });
    window.addEventListener('touchend',  up as any);
    return () => {
      window.removeEventListener('mousemove', mv as any);
      window.removeEventListener('mouseup',   up as any);
      window.removeEventListener('touchmove', mv as any);
      window.removeEventListener('touchend',  up as any);
    };
  }, [dragging]);

  const CP: Record<Corner, React.CSSProperties> = {
    tl: { top: 68,   left: 12,  right: 'auto', bottom: 'auto' },
    tr: { top: 68,   right: 12, left:  'auto', bottom: 'auto' },
    bl: { bottom: 84, left: 12,  right: 'auto', top:    'auto' },
    br: { bottom: 84, right: 12, left:  'auto', top:    'auto' },
  };

  // ── Swipe gestures ──
  const onSS = (e: React.TouchEvent) => setSwipeX(e.touches[0].clientX);
  const onSE = (e: React.TouchEvent) => {
    if (swipeX === null) return;
    const d = swipeX - e.changedTouches[0].clientX;
    if (d >  60) { setIsPplOpen(false); setIsChatOpen(true); }
    if (d < -60) { setIsChatOpen(false); setIsPplOpen(p => !p); }
    setSwipeX(null);
  };

  // ── Derived ──
  const total      = participants.length + 1;
  const sharer     = participants.find(p => p.isScreenSharing && p.stream);
  const primaryId  = pinnedId || speakerId || participants[0]?.id || null;
  const primary    = participants.find(p => p.id === primaryId) ?? null;
  const gridList   = participants.filter(p => p.id !== primaryId);

  const leave = () => {
    localStream.current?.getTracks().forEach(t => t.stop());
    screenStream.current?.getTracks().forEach(t => t.stop());
    socketRef.current?.disconnect();
    navigate(userType === 'teacher' ? '/dashboard' : '/join-room');
  };

  // ── Permission denied screen ──
  if (permDenied) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-zinc-900 rounded-2xl border border-red-500/30 max-w-sm w-full">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <VideoOff size={32} className="text-red-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Camera Access Denied</h2>
          <p className="text-zinc-400 text-sm mb-5">Camera and mic access is required. Redirecting...</p>
          <button onClick={() => navigate('/join-room')} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors">
            Leave Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen bg-zinc-950 flex flex-col overflow-hidden select-none"
      style={{
        fontFamily: 'system-ui,-apple-system,sans-serif',
        // Block pull-to-refresh on Android Chrome + iOS Safari
        overscrollBehavior: 'none',
        touchAction: 'pan-x pan-y',
      }}
    >

      {/* Toast notifications */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none items-center">
        {toasts.map(t => (
          <div key={t.id} className="bg-zinc-800/95 backdrop-blur text-white text-xs md:text-sm px-4 py-2.5 rounded-full shadow-xl border border-zinc-700 flex items-center gap-2"
            style={{ animation: 'tIn 0.2s ease both' }}>
            <span>{t.icon}</span><span className="font-medium">{t.text}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes tIn{from{opacity:0;transform:translateY(-6px) scale(.96)}to{opacity:1;transform:none}}`}</style>

      {/* Top bar */}
      <div className="h-12 md:h-14 flex items-center justify-between px-3 md:px-6 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 flex-shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-green-500/20 p-1.5 rounded-lg flex-shrink-0">
            <ShieldCheck size={14} className="text-green-400" />
          </div>
          <span className="text-zinc-200 font-medium text-xs md:text-sm truncate max-w-[130px] md:max-w-xs">
            <span className="hidden md:inline text-zinc-500">Attende-x · </span>{roomName}
          </span>
          {isSharing && (
            <span className="flex-shrink-0 text-[10px] bg-purple-600/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">Sharing</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-zinc-800 rounded-lg">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-zinc-300 font-mono text-xs">{fmt(timer)}</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 rounded-lg border border-zinc-700">
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Room</span>
            <span className="text-zinc-200 text-xs font-mono font-bold">{roomCode}</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden relative" onTouchStart={onSS} onTouchEnd={onSE}>

        {/* Video column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Primary area */}
          <div className="flex-1 relative overflow-hidden bg-zinc-950">
            {sharer ? (
              <ScreenViewer participant={sharer} />
            ) : selfOnMain ? (
              /* ── SELF ON MAIN: local camera fills the primary screen ── */
              <div className="w-full h-full relative bg-zinc-900">
                {isCamOff ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-zinc-900">
                    <VideoOff size={48} className="text-zinc-600" />
                    <span className="text-zinc-500 text-sm font-medium">Your camera is off</span>
                  </div>
                ) : (
                  <video
                    ref={mainVideoRef}
                    autoPlay playsInline muted
                    className="w-full h-full object-cover"
                    style={{ transform: isSharing ? 'none' : 'scaleX(-1)' }}
                  />
                )}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 backdrop-blur rounded-full text-white text-xs font-semibold pointer-events-none">
                  {isSharing ? '🖥️ Your Screen' : `${userName} (You)`}
                </div>
              </div>
            ) : primary ? (
              <RemoteVideo
                participant={primary} big
                isPinned={pinnedId === primary.id}
                onPin={() => setPinnedId(pinnedId === primary.id ? null : primary.id)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <div className="text-center">
                  <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User size={40} className="text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 text-sm">Waiting for others to join…</p>
                  <p className="text-zinc-600 text-xs mt-1 font-mono">{roomCode}</p>
                </div>
              </div>
            )}
            {(pinnedId || speakerId) && !sharer && !selfOnMain && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 backdrop-blur rounded-full text-white text-xs flex items-center gap-1.5 pointer-events-none">
                {pinnedId
                  ? <><Pin size={10} className="text-indigo-400" /><span>Pinned</span></>
                  : <><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /><span>Speaking</span></>
                }
              </div>
            )}
          </div>

          {/* Grid strip */}
          {gridList.length > 0 && (
            <div className="h-24 md:h-28 flex gap-2 px-2 py-2 bg-zinc-950 overflow-x-auto flex-shrink-0">
              {gridList.map(p => (
                <div
                  key={p.id}
                  onClick={() => setPinnedId(pinnedId === p.id ? null : p.id)}
                  className={`relative flex-shrink-0 w-32 md:w-40 h-full rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                    pinnedId  === p.id ? 'border-indigo-500'
                    : speakerId === p.id ? 'border-green-400'
                    : p.isScreenSharing ? 'border-purple-500'
                                        : 'border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  <RemoteVideo participant={p} isPinned={pinnedId === p.id} onPin={() => setPinnedId(pinnedId === p.id ? null : p.id)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participants panel */}
        <div className={`flex-col border-l border-zinc-800 bg-zinc-900 transition-all duration-300 fixed md:relative right-0 z-20 top-12 md:top-0 h-[calc(100%-64px)] md:h-auto ${isPplOpen ? 'w-72 flex' : 'w-0 hidden'}`}>
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
            <h3 className="text-white font-semibold text-sm">
              Participants <span className="text-zinc-500 font-normal">({total})</span>
            </h3>
            <button onClick={() => setIsPplOpen(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg"><X size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {/* Self */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{userName}</p>
                <p className="text-zinc-500 text-xs capitalize">{userType} · You</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isMuted   && <MicOff  size={12} className="text-red-400" />}
                {isCamOff  && <VideoOff size={12} className="text-red-400" />}
                {isSharing && <ScreenShare size={12} className="text-purple-400" />}
              </div>
            </div>
            {/* Remote participants */}
            {participants.map(p => (
              <div key={p.id} onClick={() => setPinnedId(pinnedId === p.id ? null : p.id)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer group">
                <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{p.username?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{p.username}</p>
                  <p className="text-zinc-500 text-xs">{p.isScreenSharing ? '🖥️ Sharing' : 'Connected'}{pinnedId === p.id ? ' · 📌' : ''}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {p.audioMuted && <MicOff  size={12} className="text-red-400" />}
                  {p.videoOff   && <VideoOff size={12} className="text-zinc-500" />}
                  <span className="opacity-0 group-hover:opacity-100 ml-0.5 text-zinc-500">
                    {pinnedId === p.id ? <PinOff size={12} /> : <Pin size={12} />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating tile — shows self normally, shows remote participant when self is on main */}
      <div
        onMouseDown={selfOnMain ? undefined : onFMD}
        onTouchStart={selfOnMain ? undefined : onFTS}
        onClick={selfOnMain ? swapCamera : undefined}
        className={`fixed z-30 rounded-xl overflow-hidden shadow-2xl border-2 transition-all ${
          isSharing
            ? 'border-purple-500'
            : selfOnMain
              ? 'border-green-500/70 cursor-pointer'
              : 'border-indigo-500/70 cursor-grab active:cursor-grabbing'
        }`}
        style={{
          width: 128, touchAction: selfOnMain ? 'auto' : 'none',
          ...(dragging && !selfOnMain
            ? { left: floatPos.x - 64, top: floatPos.y - 48, right: 'auto', bottom: 'auto', cursor: 'grabbing' }
            : CP[corner]
          )
        }}
        title={selfOnMain ? 'Tap to swap back' : 'Drag to move • Tap to swap camera'}
      >
        {selfOnMain ? (
          /* Show the remote primary participant in the corner when self is on main */
          primary ? (
            <RemoteVideo participant={primary} isPinned={false} onPin={() => {}} />
          ) : (
            <div className="w-full flex items-center justify-center bg-zinc-800" style={{ height: 88 }}>
              <User size={22} className="text-zinc-500" />
            </div>
          )
        ) : (
          /* Normal mode: show self */
          isCamOff ? (
            <div className="w-full flex flex-col items-center justify-center bg-zinc-800 gap-1.5" style={{ height: 88 }}>
              <VideoOff size={22} className="text-zinc-400" />
              <span className="text-zinc-500 text-[9px] font-medium">Camera off</span>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay playsInline muted
              className="w-full object-cover block"
              style={{ height: 88, transform: isSharing ? 'none' : 'scaleX(-1)' }}
            />
          )
        )}
        <div
          className={`py-1 px-1.5 flex items-center justify-center gap-1 ${selfOnMain ? 'bg-green-900/80' : 'bg-black/80'}`}
          onClick={!selfOnMain ? swapCamera : undefined}
          style={!selfOnMain ? { cursor: 'pointer' } : {}}
          title={!selfOnMain ? 'Tap to put yourself on main screen' : undefined}
        >
          {selfOnMain ? (
            <span className="text-green-400 text-[9px] font-bold">↩ Swap back</span>
          ) : (
            <>
              {isSharing && <ScreenShare size={9} className="text-purple-400 flex-shrink-0" />}
              <span className="text-white text-[10px] font-medium truncate">{isSharing ? 'Your Screen' : userName}</span>
              <span className="text-zinc-500 text-[8px] ml-0.5">⇄</span>
            </>
          )}
        </div>
        {!selfOnMain && isMuted && (
          <div className="absolute top-1 left-1 bg-red-500 rounded-full p-0.5">
            <MicOff size={8} className="text-white" />
          </div>
        )}
        {!selfOnMain && (
          <div className="absolute top-1 right-1 opacity-0 hover:opacity-100 transition-opacity">
            <div className="bg-black/60 rounded-md p-0.5 text-[8px] text-zinc-400">⇄</div>
          </div>
        )}
      </div>

      {/* Chat panel */}
      {isChatOpen && (
        <div className="fixed inset-x-0 bottom-16 md:bottom-20 md:inset-x-auto md:right-4 z-40 pointer-events-none flex md:block">
          <div className="pointer-events-auto w-full md:w-80 mx-2 md:mx-0 h-[55vh] md:h-[460px] bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <MessageSquare size={14} className="text-indigo-400" /> Chat
              </h3>
              <button onClick={() => setIsChatOpen(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && <p className="text-center text-zinc-600 text-xs pt-10">No messages yet. Say hi! 👋</p>}
              {messages.map(msg => {
                const isMe = msg.sender === userName;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && <span className="text-zinc-500 text-[10px] mb-0.5 px-1">{msg.sender}</span>}
                    <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm leading-relaxed break-words ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                    <span className="text-zinc-600 text-[10px] mt-0.5 px-1">{msg.time}</span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-zinc-800 flex gap-2 flex-shrink-0">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Type a message…"
                className="flex-1 bg-zinc-800 text-white text-sm px-3 py-2 rounded-xl outline-none border border-zinc-700 focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
              />
              <button onClick={sendChat} className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors flex-shrink-0">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex-shrink-0 h-16 md:h-20 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-3 md:px-8 z-10">
        {/* Left */}
        <div className="flex items-center">
          <CtrlBtn
            onClick={() => { setIsPplOpen(p => !p); if (isChatOpen) setIsChatOpen(false); }}
            active={isPplOpen}
            icon={<Users size={18} />}
            label="People"
            badge={total}
          />
        </div>

        {/* Center */}
        <div className="flex items-center gap-1.5 md:gap-2.5">
          <CtrlBtn
            onClick={toggleMute}
            danger={isMuted}
            icon={isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            label={isMuted ? 'Unmute' : 'Mute'}
          />
          {userType === 'teacher' ? (
            <CtrlBtn
              onClick={toggleCamera}
              danger={isCamOff}
              icon={isCamOff ? <VideoOff size={20} /> : <Video size={20} />}
              label={isCamOff ? 'Start' : 'Stop'}
            />
          ) : (
            <CtrlBtn disabled icon={<VideoOff size={20} />} label="Locked" />
          )}
          <CtrlBtn
            onClick={handleShareScreen}
            active={isSharing}
            icon={isSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
            label={isSharing ? 'Stop' : 'Share'}
          />
          <CtrlBtn
            onClick={() => { setIsChatOpen(p => !p); if (isPplOpen) setIsPplOpen(false); }}
            active={isChatOpen}
            icon={<MessageSquare size={20} />}
            label="Chat"
            badge={!isChatOpen ? unread : 0}
          />
          <div className="w-px h-6 bg-zinc-700/50 mx-0.5" />
          {userType === 'teacher' ? (
            <button onClick={leave} className="flex flex-col items-center gap-0.5 px-3 md:px-4 py-2 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-lg shadow-red-900/30">
              <PhoneOff size={20} />
              <span className="text-[9px] font-bold uppercase tracking-tight hidden md:block">End</span>
            </button>
          ) : (
            <button onClick={leave} className="flex flex-col items-center gap-0.5 px-3 md:px-4 py-2 md:py-3 bg-zinc-800 hover:bg-red-900/30 hover:text-red-400 text-zinc-300 rounded-xl transition-all">
              <PhoneOff size={20} />
              <span className="text-[9px] font-bold uppercase tracking-tight hidden md:block">Leave</span>
            </button>
          )}
        </div>

        {/* Right */}
        <div className="hidden md:flex flex-col items-end px-3 py-1.5 bg-zinc-800 rounded-lg border border-zinc-700/50">
          <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-widest">Code</span>
          <span className="text-zinc-200 text-xs font-mono font-bold">{roomCode}</span>
        </div>
      </div>
    </div>
  );
}