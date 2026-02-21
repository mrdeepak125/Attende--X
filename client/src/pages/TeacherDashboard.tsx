import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, BookOpen, Calendar, BarChart3, 
  Plus, Search, Bell, Settings, ChevronRight,
  X, Clock, Hash, GraduationCap
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from 'motion/react';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [formData, setFormData] = useState({
    className: '',
    studentsCount: '',
    duration: '60'
  });

  const userName = localStorage.getItem('userName') || 'Teacher';

  useEffect(() => {
    if (isCreateModalOpen) {
      generateRoomCode();
    }
  }, [isCreateModalOpen]);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomCode(code);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleStartClass = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('currentRoomCode', roomCode);
    localStorage.setItem('currentClassName', formData.className);
    navigate('/meeting');
  };

  const stats = [
    { label: 'Total Students', value: '124', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Courses', value: '8', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Upcoming Classes', value: '3', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Avg. Attendance', value: '92%', icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 pt-16">
      <Navbar userType="teacher" onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Welcome back, {userName}!</h1>
            <p className="text-zinc-500">Here's what's happening with your classes today.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus size={20} />
            Create New Class
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
              </div>
              <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Classes */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="font-bold text-zinc-900">Upcoming Classes</h3>
                <button className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
              </div>
              <div className="divide-y divide-zinc-100">
                {[
                  { title: 'Advanced Mathematics', time: '10:00 AM - 11:30 AM', students: 42, status: 'Starting in 15m' },
                  { title: 'Physics 101: Mechanics', time: '01:00 PM - 02:30 PM', students: 38, status: 'Upcoming' },
                  { title: 'Computer Science: Algorithms', time: '04:00 PM - 05:30 PM', students: 45, status: 'Upcoming' },
                ].map((item, i) => (
                  <div key={i} className="p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900">{item.title}</h4>
                        <p className="text-sm text-zinc-500">{item.time} • {item.students} Students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        item.status === 'Starting in 15m' ? 'bg-orange-50 text-orange-600' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {item.status}
                      </span>
                      <ChevronRight size={20} className="text-zinc-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-600/20">
              <h3 className="font-bold text-lg mb-2">Upgrade to Pro</h3>
              <p className="text-indigo-100 text-sm mb-4">Get unlimited meeting time and advanced analytics for your classes.</p>
              <button className="w-full bg-white text-indigo-600 font-bold py-2.5 rounded-xl hover:bg-indigo-50 transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Create Room Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-zinc-900">Create New Class</h2>
                  <button 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <X size={20} className="text-zinc-400" />
                  </button>
                </div>

                <form onSubmit={handleStartClass} className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Class Name</label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        placeholder="e.g. Advanced Mathematics"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.className}
                        onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">No. of Students</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                          required
                          type="number"
                          placeholder="Max 50"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          value={formData.studentsCount}
                          onChange={(e) => setFormData({ ...formData, studentsCount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Duration (Min)</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                          required
                          type="number"
                          placeholder="60"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          value={formData.duration}
                          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Room Code (Auto-generated)</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input
                        readOnly
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-900 font-mono font-bold tracking-widest cursor-not-allowed"
                        value={roomCode}
                      />
                    </div>
                  </div>

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
