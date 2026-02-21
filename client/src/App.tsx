import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RegistrationPage from './pages/RegistrationPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import OTPVerifyPage from './pages/OTPVerifyPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import JoinRoomPage from './pages/JoinRoomPage';
import MeetingPage from './pages/MeetingPage';
import TeacherDashboard from './pages/TeacherDashboard';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-otp" element={<OTPVerifyPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/join-room" element={<JoinRoomPage />} />
        <Route path="/meeting" element={<MeetingPage />} />
        <Route path="/dashboard" element={<TeacherDashboard />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
