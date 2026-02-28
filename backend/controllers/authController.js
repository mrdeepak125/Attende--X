"use strict";

const User       = require("../models/User");
const Otp        = require("../models/Otp");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const transporter = require("../config/mail");
const generateOtp = require("../utils/generateOtp");

const ADMIN_EMAIL = "deepakpuri9190@gmail.com";

// ─── Email helpers ────────────────────────────────────────────────────────────

const sendOtpEmail = async (email, otp, subject = "Your OTP Code") => {
  await transporter.sendMail({
    from: `"EduStream" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fa;border-radius:12px">
        <h2 style="color:#4f46e5;margin-bottom:8px">EduStream</h2>
        <p style="color:#374151;margin-bottom:24px">Your one-time verification code is:</p>
        <div style="background:#fff;border:2px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:900;color:#111827">${otp}</div>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">This code expires in 5 minutes. Do not share it with anyone.</p>
      </div>
    `
  });
};

const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || "https://attende-x.vercel.app"}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  await transporter.sendMail({
    from: `"EduStream" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your Password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fa;border-radius:12px">
        <h2 style="color:#4f46e5;margin-bottom:8px">EduStream</h2>
        <p style="color:#374151;margin-bottom:24px">You requested a password reset. Click the button below:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">Reset Password</a>
        <p style="color:#6b7280;font-size:13px;margin-top:24px">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `
  });
};

const notifyAdmin = async (user) => {
  try {
    await transporter.sendMail({
      from: `"EduStream System" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: "New Registration — Unknown User Type",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff3cd;border-radius:12px">
          <h3 style="color:#92400e">⚠️ Unknown userType on signup</h3>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <tr><td style="padding:6px 0;font-weight:600;width:120px">Email</td><td>${user.email}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600">UserType</td><td>${user.userType || "null / not set"}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600">Registered</td><td>${new Date().toISOString()}</td></tr>
          </table>
        </div>
      `
    });
  } catch (e) {
    console.warn("Admin notify failed:", e.message);
  }
};

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
exports.signup = async (req, res) => {
  try {
    const { email, password, userType, username, originalImage } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "An account with this email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const userData = {
      email,
      password: hashed,
      userType:  userType || null,
      username:  username || email.split("@")[0],
    };

    // Store base64 original image if provided (for face attendance)
    if (originalImage) userData.originalImage = originalImage;

    const user = await User.create(userData);

    // Notify admin if userType is missing/unknown
    const validTypes = ["student", "teacher"];
    if (!userType || !validTypes.includes(userType)) {
      await notifyAdmin(user);
    }

    // Generate & send OTP
    await Otp.deleteMany({ email }); // clear old OTPs
    const otp = generateOtp();       // 4-digit

    await Otp.create({ email, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    await sendOtpEmail(email, otp, "Verify Your EduStream Account");

    res.json({ message: "OTP sent to email. Please verify to activate your account." });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error during signup" });
  }
};

// ─── RESEND OTP ───────────────────────────────────────────────────────────────
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    await Otp.deleteMany({ email });
    const otp = generateOtp();
    await Otp.create({ email, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    await sendOtpEmail(email, otp, "Your New OTP Code");

    res.json({ message: "New OTP sent to email" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, action } = req.body;

    const record = await Otp.findOne({ email, otp });
    if (!record) return res.status(400).json({ message: "Invalid OTP" });
    if (record.expiresAt < Date.now())
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });

    if (action === "signup") {
      await User.updateOne({ email }, { isVerified: true });
      await Otp.deleteMany({ email });

      const user = await User.findOne({ email });
      const token = jwt.sign({ id: user._id, userType: user.userType }, process.env.JWT_SECRET, { expiresIn: "7d" });

      return res.json({
        message: "Email verified successfully",
        token,
        userType:  user.userType,
        username:  user.username,
        email:     user.email
      });
    }

    // reset flow — keep OTP so reset-password can validate it
    return res.json({ message: "OTP valid" });

  } catch (err) {
    console.error("verifyOtp error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "No account found with this email" });

    if (!user.isVerified)
      return res.status(403).json({ message: "Please verify your email first. Check your inbox for the OTP." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message:  "Login successful",
      token,
      userType: user.userType,
      username: user.username || user.email.split("@")[0],
      email:    user.email
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "No account found with this email" });

    // Generate a short-lived reset token (15 min)
    const resetToken = jwt.sign({ email, purpose: "reset" }, process.env.JWT_SECRET, { expiresIn: "15m" });

    // Also store OTP as fallback (the OTP verify page still works)
    await Otp.deleteMany({ email });
    const otp = generateOtp();
    await Otp.create({ email, otp, expiresAt: Date.now() + 15 * 60 * 1000 });

    // Send clickable reset link email
    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── VERIFY RESET TOKEN (for link-based flow) ─────────────────────────────────
exports.verifyResetToken = async (req, res) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) return res.status(400).json({ message: "Invalid reset link" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== "reset" || decoded.email !== email)
      return res.status(400).json({ message: "Invalid or expired reset link" });

    res.json({ message: "Token valid", email });
  } catch (err) {
    res.status(400).json({ message: "Reset link has expired. Please request a new one." });
  }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, token } = req.body;

    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    // Support both link-based (token) and OTP-based reset
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.purpose !== "reset" || decoded.email !== email)
          return res.status(400).json({ message: "Invalid reset token" });
      } catch {
        return res.status(400).json({ message: "Reset link has expired" });
      }
    } else {
      const record = await Otp.findOne({ email, otp });
      if (!record) return res.status(400).json({ message: "Invalid OTP" });
      if (record.expiresAt < Date.now())
        return res.status(400).json({ message: "OTP expired" });
      await Otp.deleteMany({ email });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email }, { password: hashed });

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── GET PROFILE ─────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};