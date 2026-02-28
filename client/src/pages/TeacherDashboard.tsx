import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, Calendar, BarChart3,
  Plus, Bell, ChevronRight, X, Clock,
  Hash, RefreshCw, Settings2, Mic, Video,
  MessageSquare, ScreenShare, Copy, Check
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from 'motion/react';

interface RoomSettings {
  allowStudentMic:    boolean;
  allowStudentCamera: boolean;
  allowStudentChat:   boolean;
  allowScreenShare:   boolean;
  requireApproval:    boolean;
}

const DEFAULT_SETTINGS: RoomSettings = {
  allowStudentMic:    true,
  allowStudentCamera: true,
  allowStudentChat:   true,
  allowScreenShare:   false,
  requireApproval:    false,
};

export default function TeacherDashboard() {
  const navigate  = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [roomCode, setRoomCode]   = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [formData, setFormData]   = useState({ className: '', studentsCount: '', duration: '60' });
  const [settings, setSettings]   = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [activeRooms, setActiveRooms] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const userName = localStorage.getItem('userName') || 'Teacher';

  useEffect(() => {
    if (isCreateModalOpen) generateRoomCode();
  }, [isCreateModalOpen]);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setRoomCode(code);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleStartClass = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('currentRoomCode',  roomCode);
    localStorage.setItem('currentClassName', formData.className);
    localStorage.setItem('userType',         'teacher');
    localStorage.setItem('roomSettings',     JSON.stringify(settings));
    // Track active rooms
    const updated = [...activeRooms, roomCode];
    setActiveRooms(updated);
    localStorage.setItem('activeRooms', JSON.stringify(updated));
    navigate('/meeting');
  };

  const toggleSetting = (key: keyof RoomSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const stats = [
    { label: 'Total Students', value: '124', icon: Users,    color: 'text-blue-600',    bg: 'bg-blue-50'    },
    { label: 'Active Courses', value: '8',   icon: BookOpen, color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
    { label: 'Classes Today',  value: '3',   icon: Calendar, color: 'text-purple-600',  bg: 'bg-purple-50'  },
    { label: 'Avg. Attendance',value: '92%', icon: BarChart3,color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const controlSettings = [
    { key: 'allowStudentMic'    as keyof RoomSettings, icon: Mic,         label: 'Student Microphone', desc: 'Allow students to unmute themselves'          },
    { key: 'allowStudentCamera' as keyof RoomSettings, icon: Video,       label: 'Student Camera',     desc: 'Allow students to turn on their camera'        },
    { key: 'allowStudentChat'   as keyof RoomSettings, icon: MessageSquare,label: 'Chat',              desc: 'Allow students to send chat messages'           },
    { key: 'allowScreenShare'   as keyof RoomSettings, icon: ScreenShare, label: 'Screen Sharing',     desc: 'Allow students to share their screen'           },
    { key: 'requireApproval'    as keyof RoomSettings, icon: Users,       label: 'Require Approval',   desc: 'Manually approve students before they join'     },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 pt-16">
      <Navbar userType="teacher" onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Welcome back, {userName}!</h1>
            <p className="text-zinc-500 text-sm mt-1">Here's what's happening with your classes today.</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/20 w-fit"
          >
            <Plus size={20} /> Create New Class
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={22} />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12%</span>
              </div>
              <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Classes */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="font-bold text-zinc-900">Upcoming Classes</h3>
                <button className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
              </div>
              <div className="divide-y divide-zinc-100">
                {[
                  { title: 'Advanced Mathematics',        time: '10:00 AM – 11:30 AM', students: 42, status: 'Starting in 15m' },
                  { title: 'Physics 101: Mechanics',      time: '01:00 PM – 02:30 PM', students: 38, status: 'Upcoming' },
                  { title: 'CS: Algorithms',              time: '04:00 PM – 05:30 PM', students: 45, status: 'Upcoming' },
                ].map((item, i) => (
                  <div key={i} className="p-5 flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <BookOpen size={22} />
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900 text-sm">{item.title}</h4>
                        <p className="text-xs text-zinc-500">{item.time} · {item.students} Students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        item.status === 'Starting in 15m' ? 'bg-orange-50 text-orange-600' : 'bg-zinc-100 text-zinc-500'
                      }`}>{item.status}</span>
                      <ChevronRight size={18} className="text-zinc-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Quick start */}
            <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-xl shadow-indigo-600/20">
              <h3 className="font-bold text-lg mb-1">Quick Start</h3>
              <p className="text-indigo-100 text-sm mb-4">Create a class and share the room code with your students instantly.</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full bg-white text-indigo-600 font-bold py-2.5 rounded-xl hover:bg-indigo-50 transition-colors"
              >
                Start Now
              </button>
            </div>

            {/* Active rooms */}
            {activeRooms.length > 0 && (
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <h3 className="font-bold text-zinc-900 text-sm mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Active Rooms
                </h3>
                <div className="space-y-2">
                  {activeRooms.slice(-3).map(code => (
                    <div key={code} className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
                      <span className="font-mono font-bold text-zinc-700 tracking-widest">{code}</span>
                      <button
                        onClick={() => {
                          localStorage.setItem('currentRoomCode', code);
                          navigate('/meeting');
                        }}
                        className="text-xs text-indigo-600 font-semibold hover:underline"
                      >Rejoin</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Create Class Modal ── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-7">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-zinc-900">Create New Class</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSettings(p => !p)}
                      className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-zinc-100 text-zinc-400'}`}
                      title="Room Control Settings"
                    >
                      <Settings2 size={18} />
                    </button>
                    <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
                      <X size={18} className="text-zinc-400" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleStartClass} className="space-y-5">
                  {/* Class Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Class Name</label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                      <input
                        required type="text" placeholder="e.g. Advanced Mathematics"
                        value={formData.className} onChange={e => setFormData({ ...formData, className: e.target.value })}
                        className="w-full pl-9 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Students</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                          required type="number" placeholder="Max 50" min="1" max="200"
                          value={formData.studentsCount} onChange={e => setFormData({ ...formData, studentsCount: e.target.value })}
                          className="w-full pl-9 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Duration (min)</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                          required type="number" placeholder="60" min="5"
                          value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })}
                          className="w-full pl-9 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Room Code */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Room Code</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                          readOnly type="text"
                          className="w-full pl-9 pr-4 py-3 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-900 font-mono font-bold tracking-widest cursor-not-allowed text-sm"
                          value={roomCode}
                        />
                      </div>
                      <button
                        type="button" onClick={copyCode}
                        className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl transition-colors text-zinc-600"
                        title="Copy code"
                      >
                        {codeCopied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                      </button>
                      <button
                        type="button" onClick={generateRoomCode}
                        className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl transition-colors text-zinc-600"
                        title="Generate new code"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 ml-1">Share this code with your students to let them join.</p>
                  </div>

                  {/* Control Settings (collapsible) */}
                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border border-zinc-200 rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                            <h4 className="text-sm font-bold text-zinc-700 flex items-center gap-2">
                              <Settings2 size={15} className="text-indigo-500" /> Student Controls
                            </h4>
                          </div>
                          <div className="divide-y divide-zinc-100">
                            {controlSettings.map(({ key, icon: Icon, label, desc }) => (
                              <div key={key} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Icon size={15} className="text-indigo-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-zinc-800">{label}</p>
                                    <p className="text-xs text-zinc-400">{desc}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleSetting(key)}
                                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings[key] ? 'bg-indigo-600' : 'bg-zinc-200'}`}
                                >
                                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 group"
                  >
                    Start Online Class
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}