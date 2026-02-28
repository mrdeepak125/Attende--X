import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";
import RegistrationPage    from './pages/RegistrationPage';
import LoginPage           from './pages/LoginPage';
import ForgotPasswordPage  from './pages/ForgotPasswordPage';
import OTPVerifyPage       from './pages/OTPVerifyPage';
import ResetPasswordPage   from './pages/ResetPasswordPage';
import JoinRoomPage        from './pages/JoinRoomPage';
import MeetingPage         from './pages/MeetingPage';
import TeacherDashboard    from './pages/TeacherDashboard';

// ── Requires valid JWT token ────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// ── Requires teacher role ───────────────────────────────────────────────────
const TeacherRoute = ({ children }: { children: JSX.Element }) => {
  const token    = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');
  if (!token)                return <Navigate to="/login"    replace />;
  if (userType !== 'teacher') return <Navigate to="/join-room" replace />;
  return children;
};

export default function App() {
  return (
    <Router>
        <Analytics />
      <Routes>
        {/* Default → login */}
        <Route path="/"               element={<Navigate to="/login" replace />} />

        {/* Auth */}
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/register"       element={<RegistrationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-otp"     element={<OTPVerifyPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Student flow */}
        <Route path="/join-room"      element={<ProtectedRoute><JoinRoomPage /></ProtectedRoute>} />
        <Route path="/meeting"        element={<ProtectedRoute><MeetingPage /></ProtectedRoute>} />

        {/* Teacher flow */}
        <Route path="/dashboard"      element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />

        {/* 404 fallback */}
        <Route path="*"               element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}