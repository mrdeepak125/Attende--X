import React from 'react';
import { User, LogOut } from 'lucide-react';

interface NavbarProps {
  userType?: string;
  onLogout: () => void;
}

export default function Navbar({ userType, onLogout }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xl">E</span>
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
          EduStream
        </span>
      </div>

      <div className="flex items-center gap-4">
        {userType && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full">
            <User size={16} className="text-zinc-600" />
            <span className="text-sm font-medium text-zinc-700 capitalize">{userType}</span>
          </div>
        )}
        <button
          onClick={onLogout}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600 hover:text-red-600"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}
