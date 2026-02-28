import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
  MessageSquare, PhoneOff, Settings, Users, User,
  ShieldCheck, Pin, PinOff, X, Send, Grid
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface Participant {
  id: string;
  username: string;
  email?: string;
  isScreenSharing?: boolean;
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  text: string;
  time: string;
}

// ─── Remote Video Tile ───────────────────────────────────────────────────────
function RemoteVideo({
  participant, isPrimary, isPinned, onPin
}: {
  participant: Participant; isPrimary: boolean; isPinned: boolean; onPin: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && participant.stream) ref.current.srcObject = participant.stream;
  }, [participant.stream]);

  return (
    <div className="w-full h-full relative bg-zinc-900 group">
      {participant.stream ? (
        <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className={`${isPrimary ? 'w-20 h-20 md:w-28 md:h-28' : 'w-10 h-10'} bg-zinc-700 rounded-full flex items-center justify-center`}>
            <span className={`${isPrimary ? 'text-3xl' : 'text-sm'} text-zinc-400 font-bold`}>
              {participant.username?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
        </div>
      )}
      {/* Name */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="text-white text-xs bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md font-medium truncate max-w-[70%]">
          {participant.username}
          {participant.isScreenSharing ? ' • Screen' : ''}
        </span>
      </div>
      {/* Pin */}
      <button
        onClick={e => { e.stopPropagation(); onPin(); }}
        className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
          isPinned ? 'bg-indigo-600 text-white opacity-100' : 'bg-black/40 text-zinc-300 opacity-0 group-hover:opacity-100'
        }`}
      >
        {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
      </button>
    </div>
  );
}

// ─── Control Button ───────────────────────────────────────────────────────────
function CtrlBtn({
  onClick, active, danger, icon, label, badge, disabled
}: {
  onClick?: () => void; active?: boolean; danger?: boolean;
  icon: React.ReactNode; label?: string; badge?: number; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-0.5 px-2.5 md:px-4 py-2 md:py-3 rounded-xl transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed bg-zinc-900' :
        danger ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' :
        active ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }`}
    >
      {icon}
      {label && <span className="text-[9px] font-bold uppercase tracking-tight hidden md:block">{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[9px] flex items-center justify-center rounded-full text-white font-bold">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MeetingPage() {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [timer, setTimer] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<any>(null);
  // floating position snaps to corners
  type Corner = 'tl' | 'tr' | 'bl' | 'br';
  const [floatCorner, setFloatCorner] = useState<Corner>('br');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<any>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<Participant[]>([]);

  const navigate = useNavigate();
  const location = useLocation();
  const userType = localStorage.getItem('userType') || 'student';
  const roomCode = localStorage.getItem('currentRoomCode') || 'EDU-442-901';
  const className = localStorage.getItem('currentClassName') || 'Advanced Mathematics';
  const userName = localStorage.getItem('userName') || 'You';

  // Keep ref in sync
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  // ── Timer ──
  useEffect(() => {
    const i = setInterval(() => setTimer(p => p + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const fmt = (s: number) => [Math.floor(s/3600), Math.floor((s%3600)/60), s%60].map(v=>String(v).padStart(2,'0')).join(':');

  // ── Camera ──
  useEffect(() => {
    const start = async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(ms);
        localStreamRef.current = ms;
        if (videoRef.current) videoRef.current.srcObject = ms;
        setCameraPermissionDenied(false);
        if (socketRef.current?.connected) socketRef.current.emit('join', { room: roomCode, username: userName });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraPermissionDenied(true);
          setTimeout(() => navigate('/join-room'), 3000);
        }
      }
    };
    if (!isCameraOff) { start(); }
    else {
      stream?.getTracks().forEach(t => t.stop());
      setStream(null); localStreamRef.current = null;
    }
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [isCameraOff]);

  // ── Socket + WebRTC ──
  useEffect(() => {
    const VIDEO_URL = (import.meta as any).env?.VITE_VIDEO_URL || 'http://localhost:7000';
    const newSocket = io(VIDEO_URL);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (localStreamRef.current) newSocket.emit('join', { room: roomCode, username: userName });
    });

    newSocket.on('users', (users: any[]) => {
      setParticipants(users.map(u => ({ id: u.id, username: u.username, isScreenSharing: false })));
      users.forEach(u => createPeer(u.id, true));
    });

    newSocket.on('new-user', (u: any) => {
      setParticipants(prev => [...prev, { id: u.id, username: u.username, isScreenSharing: false }]);
      createPeer(u.id, false);
    });

    newSocket.on('user-left', (u: any) => {
      setParticipants(prev => prev.filter(p => p.id !== u.id));
      if (peersRef.current[u.id]) { peersRef.current[u.id].close(); delete peersRef.current[u.id]; }
      setPinnedUserId(prev => prev === u.id ? null : prev);
      setActiveSpeakerId(prev => prev === u.id ? null : prev);
    });

    newSocket.on('offer', async (data: any) => {
      const sid = data.sender;
      if (!peersRef.current[sid]) createPeer(sid, false);
      const pc = peersRef.current[sid];
      await pc.setRemoteDescription(data.offer);
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      newSocket.emit('answer', { answer: ans, target: sid });
    });

    newSocket.on('answer', async (data: any) => {
      if (peersRef.current[data.sender]) await peersRef.current[data.sender].setRemoteDescription(data.answer);
    });

    newSocket.on('ice', async (data: any) => {
      if (peersRef.current[data.sender]) {
        try { await peersRef.current[data.sender].addIceCandidate(data.candidate); } catch {}
      }
    });

    // Screen share notification from others
    newSocket.on('screen-sharing', (data: { id: string; active: boolean }) => {
      setParticipants(prev => prev.map(p => p.id === data.id ? { ...p, isScreenSharing: data.active } : p));
      // Auto-switch primary if no pin
      if (!pinnedUserId) {
        setActiveSpeakerId(data.active ? data.id : null);
      }
    });

    // Real-time chat from server
    newSocket.on('chat-message', (data: ChatMessage) => {
      setChatMessages(prev => [...prev, { ...data, id: data.id || Date.now().toString() }]);
      setUnreadCount(prev => prev + 1);
    });

    return () => { newSocket.disconnect(); socketRef.current = null; setSocket(null); };
  }, []);

  const createPeer = (id: string, init: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peersRef.current[id] = pc;

    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    pc.ontrack = e => {
      const s = e.streams[0];
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, stream: s } : p));

      // Voice activity detection
      try {
        const ac = new AudioContext();
        const analyser = ac.createAnalyser();
        analyser.fftSize = 512;
        ac.createMediaStreamSource(s).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const check = () => {
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
          if (avg > 20) {
            setActiveSpeakerId(cur => {
              // only auto-switch if nothing pinned
              return cur === id ? cur : id;
            });
          }
          requestAnimationFrame(check);
        };
        check();
      } catch {}
    };

    pc.onicecandidate = e => {
      if (e.candidate && socketRef.current) socketRef.current.emit('ice', { candidate: e.candidate, target: id });
    };

    if (init) pc.createOffer().then(o => { pc.setLocalDescription(o); socketRef.current?.emit('offer', { offer: o, target: id }); }).catch(console.error);
  };

  // ── Screen Share ──
  const handleShareScreen = async () => {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach(t => t.stop());
      setScreenStream(null); setIsScreenSharing(false);
      Object.values(peersRef.current).forEach(pc => {
        const s = pc.getSenders().find(s => s.track?.kind === 'video');
        if (s && localStreamRef.current) s.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
      });
      socketRef.current?.emit('screen-sharing', { room: roomCode, active: false });
      return;
    }
    try {
      const ss = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(ss); setIsScreenSharing(true);
      const vt = ss.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(pc => {
        const s = pc.getSenders().find(s => s.track?.kind === 'video');
        if (s) s.replaceTrack(vt);
      });
      // Show MY screen in local preview
      if (videoRef.current) videoRef.current.srcObject = ss;
      socketRef.current?.emit('screen-sharing', { room: roomCode, active: true });
      vt.onended = () => handleShareScreen();
    } catch (e) { console.error(e); }
  };

  // ── Chat ──
  const sendChat = () => {
    if (!chatInput.trim() || !socket) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: userName,
      senderId: socket.id,
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    socket.emit('chat-message', { ...msg, room: roomCode });
    setChatMessages(prev => [...prev, msg]);
    setChatInput('');
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => { if (isChatOpen) setUnreadCount(0); }, [isChatOpen]);

  // ── Floating video drag ──
  const onFloatMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setFloatPos({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  };
  const onFloatTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setFloatPos({ x: cx, y: cy });
    };
    const onUp = (e: MouseEvent | TouchEvent) => {
      setIsDragging(false);
      const cx = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
      const cy = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;
      const W = window.innerWidth, H = window.innerHeight;
      // Snap to nearest corner
      const corner: Corner =
        cx < W / 2 ? (cy < H / 2 ? 'tl' : 'bl') : (cy < H / 2 ? 'tr' : 'br');
      setFloatCorner(corner);
    };
    window.addEventListener('mousemove', onMove as any);
    window.addEventListener('mouseup', onUp as any);
    window.addEventListener('touchmove', onMove as any, { passive: true });
    window.addEventListener('touchend', onUp as any);
    return () => {
      window.removeEventListener('mousemove', onMove as any);
      window.removeEventListener('mouseup', onUp as any);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('touchend', onUp as any);
    };
  }, [isDragging]);

  const cornerStyle: Record<Corner, React.CSSProperties> = {
    tl: { top: 72, left: 12, right: 'auto', bottom: 'auto' },
    tr: { top: 72, right: 12, left: 'auto', bottom: 'auto' },
    bl: { bottom: 88, left: 12, right: 'auto', top: 'auto' },
    br: { bottom: 88, right: 12, left: 'auto', top: 'auto' },
  };

  // ── Swipe gesture ──
  const onSwipeStart = (e: React.TouchEvent) => setSwipeStartX(e.touches[0].clientX);
  const onSwipeEnd = (e: React.TouchEvent) => {
    if (swipeStartX === null) return;
    const diff = swipeStartX - e.changedTouches[0].clientX;
    if (diff > 60) { setIsParticipantsOpen(false); setIsChatOpen(true); }
    else if (diff < -60) { setIsChatOpen(false); setIsParticipantsOpen(prev => !prev); }
    setSwipeStartX(null);
  };

  // ── Derived ──
  const effectivePrimaryId = pinnedUserId || activeSpeakerId || participants[0]?.id || null;
  const primaryParticipant = participants.find(p => p.id === effectivePrimaryId) || null;
  const gridParticipants = participants.filter(p => p.id !== effectivePrimaryId);

  // ── Camera denied ──
  if (cameraPermissionDenied) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center p-8 bg-zinc-900 rounded-2xl border border-red-500/30 max-w-sm mx-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <VideoOff size={32} className="text-red-500" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Camera Access Denied</h2>
          <p className="text-zinc-400 text-sm mb-4">Camera access is required to join. Redirecting you out shortly...</p>
          <button onClick={() => navigate('/join-room')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Leave Now</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden select-none" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Top Bar ── */}
      <div className="h-12 md:h-14 flex items-center justify-between px-3 md:px-6 bg-zinc-900/80 backdrop-blur-sm z-10 border-b border-zinc-800/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-green-500/20 p-1.5 rounded-lg flex-shrink-0">
            <ShieldCheck size={15} className="text-green-500" />
          </div>
          <h2 className="text-zinc-200 font-medium text-xs md:text-sm truncate max-w-[160px] md:max-w-none">
            <span className="hidden md:inline">EduStream: </span>{className}
          </h2>
          {isScreenSharing && (
            <span className="flex-shrink-0 text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">Sharing</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-zinc-800 rounded-md">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-zinc-300 font-mono text-xs">{fmt(timer)}</span>
          </div>
          <div className="hidden md:flex px-3 py-1.5 bg-zinc-800/80 rounded-lg border border-zinc-700">
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mr-1.5">Room</span>
            <span className="text-zinc-200 text-xs font-mono">{roomCode}</span>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div
        className="flex-1 flex overflow-hidden relative"
        onTouchStart={onSwipeStart}
        onTouchEnd={onSwipeEnd}
      >
        {/* Video Column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Primary Screen */}
          <div className="flex-1 relative overflow-hidden">
            {primaryParticipant ? (
              <RemoteVideo
                participant={primaryParticipant}
                isPrimary
                isPinned={pinnedUserId === primaryParticipant.id}
                onPin={() => setPinnedUserId(pinnedUserId === primaryParticipant.id ? null : primaryParticipant.id)}
              />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 md:w-28 md:h-28 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <User size={40} className="text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 text-sm">Waiting for others to join...</p>
                </div>
              </div>
            )}
            {/* Speaking / pinned indicator */}
            {(pinnedUserId || (activeSpeakerId && !pinnedUserId)) && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-white text-xs flex items-center gap-1.5 pointer-events-none">
                {pinnedUserId ? <><Pin size={10} className="text-indigo-400" /><span>Pinned</span></> : <><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /><span>Speaking</span></>}
              </div>
            )}
          </div>

          {/* Grid Strip */}
          {gridParticipants.length > 0 && (
            <div className="h-24 md:h-32 flex gap-2 px-2 py-2 bg-zinc-950 overflow-x-auto flex-shrink-0 scrollbar-thin">
              {gridParticipants.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (pinnedUserId === p.id) setPinnedUserId(null);
                    else { setPinnedUserId(p.id); setActiveSpeakerId(null); }
                  }}
                  className={`relative flex-shrink-0 w-36 md:w-48 h-full rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                    pinnedUserId === p.id ? 'border-indigo-500' :
                    activeSpeakerId === p.id ? 'border-green-400' :
                    p.isScreenSharing ? 'border-purple-500' : 'border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  <RemoteVideo participant={p} isPrimary={false} isPinned={pinnedUserId === p.id} onPin={() => setPinnedUserId(pinnedUserId === p.id ? null : p.id)} />
                  {p.isScreenSharing && (
                    <div className="absolute top-1.5 right-1.5 bg-purple-600/80 text-white text-[9px] px-1.5 py-0.5 rounded-md">Screen</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participants Side Panel */}
        <div className={`
          ${isParticipantsOpen ? 'w-72 md:w-76' : 'w-0'}
          flex-col border-l border-zinc-800 bg-zinc-900
          transition-all duration-300 overflow-hidden
          fixed md:relative top-12 md:top-0 right-0 z-20
          h-[calc(100%-112px)] md:h-auto
          ${isParticipantsOpen ? 'flex' : 'hidden md:hidden'}
        `}>
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
            <h3 className="text-white font-semibold text-sm">Participants ({participants.length + 1})</h3>
            <button onClick={() => setIsParticipantsOpen(false)} className="text-zinc-400 hover:text-white"><X size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Self */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/60">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">{userName}</p>
                <p className="text-zinc-500 text-xs">{userType} • You{isScreenSharing ? ' • 🖥️' : ''}</p>
              </div>
              {isMuted && <MicOff size={12} className="text-red-400 flex-shrink-0" />}
            </div>
            {/* Others */}
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-800/60 transition-colors group cursor-pointer" onClick={() => setPinnedUserId(pinnedUserId === p.id ? null : p.id)}>
                <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{p.username?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">{p.username}</p>
                  <p className="text-zinc-500 text-xs truncate">
                    {p.email || 'Connected'}
                    {p.isScreenSharing ? ' • 🖥️ Sharing' : ''}
                    {pinnedUserId === p.id ? ' • 📌' : ''}
                  </p>
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 text-xs">
                  {pinnedUserId === p.id ? <PinOff size={13} /> : <Pin size={13} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Floating Local Video (draggable, snaps to corners) ── */}
      <div
        ref={floatRef}
        onMouseDown={onFloatMouseDown}
        onTouchStart={onFloatTouchStart}
        className={`fixed z-30 rounded-xl overflow-hidden border-2 shadow-2xl cursor-grab active:cursor-grabbing ${
          isScreenSharing ? 'border-purple-500/70' : 'border-indigo-500/60'
        }`}
        style={{
          width: 130, touchAction: 'none',
          ...(isDragging
            ? { left: floatPos.x - 65, top: floatPos.y - 45, right: 'auto', bottom: 'auto', cursor: 'grabbing' }
            : cornerStyle[floatCorner]
          )
        }}
      >
        {isCameraOff ? (
          <div className="w-full bg-zinc-800 flex items-center justify-center" style={{ height: 90 }}>
            <User size={24} className="text-zinc-600" />
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full object-cover block" style={{ height: 90, transform: isScreenSharing ? 'none' : 'scaleX(-1)' }} />
        )}
        <div className="bg-black/70 text-white text-[10px] text-center py-0.5 px-1 font-medium">
          {isScreenSharing ? '🖥️ Your Screen' : userName}
        </div>
        {isMuted && (
          <div className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5">
            <MicOff size={8} className="text-white" />
          </div>
        )}
      </div>

      {/* ── Chat Popup ── */}
      {isChatOpen && (
        <div className="fixed inset-x-0 bottom-16 md:bottom-20 md:inset-x-auto md:right-4 z-40 flex md:block pointer-events-none">
          <div className="pointer-events-auto w-full md:w-80 mx-2 md:mx-0 h-[55vh] md:h-[460px] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <MessageSquare size={14} className="text-indigo-400" /> Meeting Chat
              </h3>
              <button onClick={() => setIsChatOpen(false)} className="text-zinc-400 hover:text-white"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && <p className="text-center text-zinc-600 text-xs pt-10">No messages yet</p>}
              {chatMessages.map(msg => {
                const isMe = msg.sender === userName;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && <span className="text-zinc-500 text-[10px] mb-0.5 px-1">{msg.sender}</span>}
                    <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                      isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                    }`}>{msg.text}</div>
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
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Type a message..."
                className="flex-1 bg-zinc-800 text-white text-sm px-3 py-2 rounded-xl outline-none border border-zinc-700 focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
              />
              <button onClick={sendChat} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors flex-shrink-0">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Controls ── */}
      <div className="flex-shrink-0 h-16 md:h-20 bg-zinc-900 flex items-center justify-between px-3 md:px-8 border-t border-zinc-800 z-10">
        {/* Left */}
        <div className="flex items-center gap-1.5">
          <CtrlBtn
            onClick={() => { setIsParticipantsOpen(p => !p); }}
            active={isParticipantsOpen}
            icon={<Users size={18} />}
            label="People"
            badge={participants.length + 1}
          />
        </div>

        {/* Center */}
        <div className="flex items-center gap-1.5 md:gap-3">
          <CtrlBtn
            onClick={() => {
              if (stream) stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
              setIsMuted(p => !p);
            }}
            danger={isMuted}
            icon={isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            label={isMuted ? 'Unmute' : 'Mute'}
          />

          {userType === 'teacher' ? (
            <CtrlBtn
              onClick={() => setIsCameraOff(p => !p)}
              danger={isCameraOff}
              icon={isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              label={isCameraOff ? 'Start' : 'Stop'}
            />
          ) : (
            <CtrlBtn disabled icon={<Video size={20} />} label="Locked" />
          )}

          <CtrlBtn
            onClick={handleShareScreen}
            active={isScreenSharing}
            icon={isScreenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
            label={isScreenSharing ? 'Stop' : 'Share'}
          />

          <CtrlBtn
            onClick={() => setIsChatOpen(p => !p)}
            active={isChatOpen}
            icon={<MessageSquare size={20} />}
            label="Chat"
            badge={!isChatOpen ? unreadCount : 0}
          />

          <div className="w-px h-6 bg-zinc-700 mx-0.5" />

          {userType === 'teacher' ? (
            <button
              onClick={() => { stream?.getTracks().forEach(t => t.stop()); navigate('/dashboard'); }}
              className="flex flex-col items-center gap-0.5 px-3 md:px-4 py-2 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-lg shadow-red-900/30"
            >
              <PhoneOff size={20} />
              <span className="text-[9px] font-bold uppercase tracking-tight hidden md:block">End</span>
            </button>
          ) : (
            <button
              onClick={() => { stream?.getTracks().forEach(t => t.stop()); navigate('/join-room'); }}
              className="flex flex-col items-center gap-0.5 px-3 md:px-4 py-2 md:py-3 bg-zinc-800 hover:bg-red-900/40 hover:text-red-400 text-zinc-200 rounded-xl transition-all"
            >
              <PhoneOff size={20} />
              <span className="text-[9px] font-bold uppercase tracking-tight hidden md:block">Leave</span>
            </button>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          <div className="hidden md:flex flex-col px-3 py-1.5 bg-zinc-800/80 rounded-lg border border-zinc-700/50">
            <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-widest">Code</span>
            <span className="text-zinc-200 text-xs font-mono">{roomCode}</span>
          </div>
        </div>
      </div>
    </div>
  );
}