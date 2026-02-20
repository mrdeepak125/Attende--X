import { motion } from 'motion/react';
import { LogOut, User, Settings, Bell, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
            </div>
            AuthFlow
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl">
            <User size={18} />
            Profile
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <Bell size={18} />
            Notifications
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <Settings size={18} />
            Settings
          </a>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => navigate('/login')}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-sm outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
              <Bell size={20} />
            </button>
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
              JD
            </div>
          </div>
        </header>

        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">Total Sessions</h3>
              <p className="text-3xl font-bold text-slate-900">1,284</p>
              <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <span>+12.5%</span>
                <span className="text-slate-400 font-normal">from last month</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">Security Score</h3>
              <p className="text-3xl font-bold text-slate-900">98%</p>
              <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <span>Excellent</span>
                <span className="text-slate-400 font-normal">Your account is safe</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">Active Devices</h3>
              <p className="text-3xl font-bold text-slate-900">3</p>
              <div className="mt-4 flex items-center gap-2 text-indigo-600 text-sm font-medium">
                <span>Manage devices</span>
              </div>
            </div>
          </motion.div>

          <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Recent Login Activity</h2>
              <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { device: 'Chrome on MacOS', location: 'San Francisco, US', time: 'Just now', status: 'Success' },
                { device: 'Safari on iPhone', location: 'San Francisco, US', time: '2 hours ago', status: 'Success' },
                { device: 'Firefox on Windows', location: 'London, UK', time: 'Yesterday', status: 'Success' },
              ].map((item, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <Settings size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.device}</p>
                      <p className="text-xs text-slate-500">{item.location} • {item.time}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
