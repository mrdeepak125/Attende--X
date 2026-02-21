import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Hash, ArrowRight, ArrowLeft, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import Navbar from '../components/Navbar';

export default function JoinRoomPage() {
  const [code, setCode] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Student';

  const handleChange = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    if (upperValue.length > 1) {
      const lastChar = upperValue[upperValue.length - 1];
      const newCode = [...code];
      newCode[index] = lastChar;
      setCode(newCode);
    } else {
      const newCode = [...code];
      newCode[index] = upperValue;
      setCode(newCode);
    }

    if (upperValue && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length === 4) {
      localStorage.setItem('currentRoomCode', fullCode);
      localStorage.setItem('currentClassName', 'Live Class Session');
      navigate('/meeting');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-50 pt-16">
      <Navbar userType="student" onLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden"
        >
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Hash className="text-indigo-600" size={32} />
              </div>
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">Join a Class</h1>
              <p className="text-zinc-500">Enter the 4-digit room code provided by your teacher</p>
            </div>

            <form onSubmit={handleJoin} className="space-y-8">
              <div className="flex justify-center gap-4">
                {code.map((char, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    maxLength={1}
                    value={char}
                    onChange={e => handleChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className="w-14 h-16 text-center text-2xl font-bold bg-zinc-50 border-2 border-zinc-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all uppercase font-mono"
                    placeholder="•"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={code.some(char => !char)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 group"
              >
                Join Meeting
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <div className="mt-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-xs text-indigo-600 font-medium text-center">
                Need help? Ask your teacher for the alphanumeric code displayed on their dashboard.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
