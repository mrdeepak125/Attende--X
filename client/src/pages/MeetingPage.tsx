import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, 
  MessageSquare, PhoneOff, Settings, Users, User,
  Maximize2, ShieldCheck, MoreVertical
} from 'lucide-react';
import ChatBox from '../components/ChatBox';

export default function MeetingPage() {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [timer, setTimer] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  const userType = localStorage.getItem('userType') || 'student';
  const roomCode = localStorage.getItem('currentRoomCode') || 'EDU-442-901';
  const className = localStorage.getItem('currentClassName') || 'Advanced Mathematics';

  // Timer logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  // Camera logic
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };

    if (!isCameraOff) {
      startCamera();
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOff]);

  const toggleCamera = () => {
    if (userType !== 'teacher') return; // Only teacher can stop camera
    setIsCameraOff(!isCameraOff);
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const handleShareScreen = async () => {
    try {
      await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const handleEndMeeting = () => {
    if (userType !== 'teacher') return; // Only teacher can end meeting
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    navigate('/dashboard');
  };

  const handleLeaveMeeting = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    navigate('/');
  };

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-green-500/20 p-1.5 rounded-lg">
            <ShieldCheck size={18} className="text-green-500" />
          </div>
          <h2 className="text-zinc-200 font-medium text-sm">EduStream Meeting: {className}</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-md">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-zinc-300 font-mono text-sm">{formatTime(timer)}</span>
          </div>
          <button className="text-zinc-400 hover:text-white transition-colors">
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Container */}
        <div className="flex-1 flex items-center justify-center p-4 bg-zinc-950 relative">
          <div className="w-full h-full max-w-5xl aspect-video bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative group">
            {isCameraOff ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center border-4 border-zinc-700">
                  <User size={64} className="text-zinc-600" />
                </div>
                <p className="text-zinc-500 font-medium">Camera is off</p>
              </div>
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted={isMuted}
                className="w-full h-full object-cover mirror"
              />
            )}
            
            {/* User Label */}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10">
              {localStorage.getItem('userName') || 'You'} ({userType})
            </div>
          </div>
        </div>

        {/* Side Panel */}
        {isChatOpen && (
          <div className="w-80 flex flex-col border-l border-zinc-800 animate-in slide-in-from-right duration-300">
            <ChatBox />
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="h-20 bg-zinc-900 flex items-center justify-between px-8 border-t border-zinc-800 z-10">
        <div className="flex items-center gap-4 w-1/4">
          <button className="p-3 text-zinc-400 hover:bg-zinc-800 rounded-xl transition-all">
            <Settings size={22} />
          </button>
          <button className="p-3 text-zinc-400 hover:bg-zinc-800 rounded-xl transition-all relative">
            <Users size={22} />
            <span className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 text-[10px] flex items-center justify-center rounded-full text-white font-bold">1</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleMute}
            className={`p-4 rounded-2xl transition-all flex flex-col items-center gap-1 min-w-[80px] ${
              isMuted ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            <span className="text-[10px] font-bold uppercase tracking-tighter">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {userType === 'teacher' ? (
            <button 
              onClick={toggleCamera}
              className={`p-4 rounded-2xl transition-all flex flex-col items-center gap-1 min-w-[80px] ${
                isCameraOff ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
              <span className="text-[10px] font-bold uppercase tracking-tighter">{isCameraOff ? 'Start Cam' : 'Stop Cam'}</span>
            </button>
          ) : (
            <div className="p-4 bg-zinc-900/50 text-zinc-600 rounded-2xl flex flex-col items-center gap-1 min-w-[80px] cursor-not-allowed opacity-50">
              <Video size={24} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Cam Locked</span>
            </div>
          )}

          <button 
            onClick={handleShareScreen}
            className="p-4 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-2xl transition-all flex flex-col items-center gap-1 min-w-[80px]"
          >
            <ScreenShare size={24} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Share</span>
          </button>

          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-4 rounded-2xl transition-all flex flex-col items-center gap-1 min-w-[80px] ${
              isChatOpen ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <MessageSquare size={24} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Chat</span>
          </button>

          <div className="w-px h-8 bg-zinc-800 mx-2" />

          {userType === 'teacher' ? (
            <button 
              onClick={handleEndMeeting}
              className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all flex flex-col items-center gap-1 min-w-[80px] shadow-lg shadow-red-600/20"
            >
              <PhoneOff size={24} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">End Class</span>
            </button>
          ) : (
            <button 
              onClick={handleLeaveMeeting}
              className="p-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-2xl transition-all flex flex-col items-center gap-1 min-w-[80px]"
            >
              <PhoneOff size={24} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Leave</span>
            </button>
          )}
        </div>

        <div className="w-1/4 flex justify-end">
          <div className="px-4 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Room Code</p>
            <p className="text-zinc-200 text-xs font-mono">{roomCode}</p>
          </div>
        </div>
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
