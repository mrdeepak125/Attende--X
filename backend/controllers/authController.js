"use strict";

const User        = require("../models/User");
const Otp         = require("../models/Otp");
const bcrypt      = require("bcryptjs");
const jwt         = require("jsonwebtoken");
const transporter = require("../config/mail");
const generateOtp = require("../utils/generateOtp");

const ADMIN_EMAIL = "deepakpuri9190@gmail.com";

// ─── Safe email sender — NEVER throws, always logs on failure ─────────────────
// This is the root fix: any mail error is caught here, logged,
// and a result object is returned so the caller can decide what to tell the user.
const safeSendMail = async (options) => {
  try {
    const info = await transporter.sendMail(options);
    console.log("[mail] sent →", options.to, info.messageId);
    return { ok: true, info };
  } catch (err) {
    console.error("[mail] FAILED →", options.to, err.message);
    return { ok: false, error: err.message };
  }
};

// ─── HTML templates ───────────────────────────────────────────────────────────
const otpHtml = (otp) =>
  '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fa;border-radius:12px">' +
  '<h2 style="color:#4f46e5;margin-bottom:8px">EduStream</h2>' +
  '<p style="color:#374151;margin-bottom:24px">Your one-time verification code is:</p>' +
  '<div style="background:#fff;border:2px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;' +
  'letter-spacing:16px;font-size:40px;font-weight:900;color:#111827;font-family:monospace">' + otp + '</div>' +
  '<p style="color:#6b7280;font-size:13px;margin-top:16px">Expires in <strong>5 minutes</strong>. Do not share.</p>' +
  '</div>';

const resetHtml = (resetUrl) =>
  '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fa;border-radius:12px">' +
  '<h2 style="color:#4f46e5;margin-bottom:8px">EduStream</h2>' +
  '<p style="color:#374151;margin-bottom:24px">Click the button below to reset your password:</p>' +
  '<a href="' + resetUrl + '" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;' +
  'padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">Reset My Password</a>' +
  '<p style="color:#6b7280;font-size:13px;margin-top:24px">Link expires in <strong>15 minutes</strong>.</p>' +
  '<p style="color:#9ca3af;font-size:11px;margin-top:8px;word-break:break-all">Or copy: ' + resetUrl + '</p>' +
  '</div>';

const adminHtml = (user) =>
  '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff3cd;border-radius:12px">' +
  '<h3 style="color:#92400e">Unknown userType on signup</h3>' +
  '<p style="margin-top:12px;font-size:14px"><strong>Email:</strong> ' + user.email + '</p>' +
  '<p style="font-size:14px"><strong>UserType:</strong> ' + (user.userType || 'null') + '</p>' +
  '<p style="font-size:14px"><strong>Time:</strong> ' + new Date().toISOString() + '</p>' +
  '</div>';

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
exports.signup = async (req, res) => {
  try {
    const { email, password, userType, username, originalImage } = req.body;

    // Validate
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const cleanEmail = email.toLowerCase().trim();

    // Check existing
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      // Not verified yet → resend OTP instead of blocking
      if (!existing.isVerified) {
        await Otp.deleteMany({ email: cleanEmail });
        const otp = generateOtp();
        await Otp.create({ email: cleanEmail, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
        const mail = await safeSendMail({
          from: '"EduStream" <' + process.env.EMAIL_USER + '>',
          to: cleanEmail,
          subject: "Verify Your EduStream Account",
          html: otpHtml(otp)
        });
        return res.json({
          message: "Account exists but is not verified. " +
            (mail.ok ? "A new verification code has been sent to your email." : "Email delivery failed — please use Resend OTP."),
          emailSent: mail.ok,
          ...(!mail.ok && process.env.NODE_ENV !== "production" ? { debugOtp: otp } : {})
        });
      }
      return res.status(409).json({ message: "This email is already registered. Please log in." });
    }

    // Create user
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email:         cleanEmail,
      password:      hashed,
      userType:      userType || null,
      username:      (username && username.trim()) || cleanEmail.split("@")[0],
      originalImage: originalImage || null
    });

    console.log("[signup] created user:", cleanEmail, "| type:", user.userType);

    // Admin notify for unknown type (fire-and-forget, never blocks response)
    const validTypes = ["student", "teacher"];
    if (!userType || !validTypes.includes(userType)) {
      safeSendMail({
        from:    '"EduStream System" <' + process.env.EMAIL_USER + '>',
        to:      ADMIN_EMAIL,
        subject: "New Registration — Unknown User Type",
        html:    adminHtml(user)
      }); // NOT awaited intentionally
    }

    // Generate OTP
    await Otp.deleteMany({ email: cleanEmail });
    const otp = generateOtp();
    await Otp.create({ email: cleanEmail, otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    // Send OTP — use safeSendMail so a mail error never causes 500
    const mail = await safeSendMail({
      from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
      to:      cleanEmail,
      subject: "Verify Your EduStream Account",
      html:    otpHtml(otp)
    });

    // Always return 200 — user is safely stored regardless of mail result
    return res.json({
      message: mail.ok
        ? "Account created! Check your email for the verification code."
        : "Account created! Email delivery failed — please use Resend OTP on the verify page.",
      emailSent: mail.ok,
      // Expose OTP in non-production when mail fails so testing isn't blocked
      ...(!mail.ok && process.env.NODE_ENV !== "production" ? { debugOtp: otp } : {})
    });

  } catch (err) {
    console.error("[signup] error:", err);
    if (err.code === 11000)
      return res.status(409).json({ message: "This email is already registered. Please log in." });
    res.status(500).json({ message: "Server error during signup. Please try again." });
  }
};

// ─── RESEND OTP ───────────────────────────────────────────────────────────────
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ message: "No account found with this email" });
    if (user.isVerified) return res.status(400).json({ message: "This account is already verified. Please log in." });

    await Otp.deleteMany({ email: cleanEmail });
    const otp = generateOtp();
    await Otp.create({ email: cleanEmail, otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    const mail = await safeSendMail({
      from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
      to:      cleanEmail,
      subject: "Your New Verification Code — EduStream",
      html:    otpHtml(otp)
    });

    return res.json({
      message:   mail.ok ? "New OTP sent to your email." : "Email delivery failed. Please try again.",
      emailSent: mail.ok,
      ...(!mail.ok && process.env.NODE_ENV !== "production" ? { debugOtp: otp } : {})
    });
  } catch (err) {
    console.error("[resendOtp] error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, action } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP are required" });

    const cleanEmail = email.toLowerCase().trim();
    const record = await Otp.findOne({ email: cleanEmail, otp: String(otp).trim() });

    if (!record)
      return res.status(400).json({ message: "Invalid OTP. Please check and try again." });

    if (record.expiresAt < Date.now())
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });

    if (action === "signup") {
      await User.updateOne({ email: cleanEmail }, { isVerified: true });
      await Otp.deleteMany({ email: cleanEmail });

      const user = await User.findOne({ email: cleanEmail });
      const token = jwt.sign(
        { id: user._id, userType: user.userType },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        message:  "Email verified! Welcome to EduStream.",
        token,
        userType:  user.userType,
        username:  user.username,
        email:     user.email
      });
    }

    // reset flow — OTP stays so reset-password endpoint can re-verify
    return res.json({ message: "OTP valid" });

  } catch (err) {
    console.error("[verifyOtp] error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user)
      return res.status(404).json({ message: "No account found with this email" });

    if (!user.isVerified) {
      // Auto-resend OTP to unblock the user
      await Otp.deleteMany({ email: cleanEmail });
      const otp = generateOtp();
      await Otp.create({ email: cleanEmail, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
      await safeSendMail({
        from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
        to:      cleanEmail,
        subject: "Verify Your EduStream Account",
        html:    otpHtml(otp)
      });
      return res.status(403).json({
        message:  "Please verify your email first. We've re-sent the verification code.",
        redirect: "/verify-otp",
        email:    cleanEmail
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message:  "Login successful",
      token,
      userType:  user.userType,
      username:  user.username || cleanEmail.split("@")[0],
      email:     user.email
    });

  } catch (err) {
    console.error("[login] error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    // Always respond same way — don't leak whether email exists
    if (!user) {
      return res.json({ message: "If an account with this email exists, a reset link has been sent." });
    }

    const resetToken = jwt.sign(
      { email: user.email, purpose: "reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const frontendUrl = process.env.FRONTEND_URL || "https://attende-x.vercel.app";
    const resetUrl = frontendUrl + "/reset-password?token=" + encodeURIComponent(resetToken) + "&email=" + encodeURIComponent(user.email);

    const mail = await safeSendMail({
      from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
      to:      user.email,
      subject: "Reset Your EduStream Password",
      html:    resetHtml(resetUrl)
    });

    return res.json({
      message:   mail.ok
        ? "Password reset link sent! Please check your email."
        : "Email delivery failed. Please try again later.",
      emailSent: mail.ok
    });

  } catch (err) {
    console.error("[forgotPassword] error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── VERIFY RESET TOKEN ───────────────────────────────────────────────────────
exports.verifyResetToken = async (req, res) => {
  try {
    const { token, email } = req.query;
    if (!token || !email)
      return res.status(400).json({ message: "Invalid reset link" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== "reset" || decoded.email !== decodeURIComponent(email))
      return res.status(400).json({ message: "Invalid reset link" });

    res.json({ message: "Token valid", email: decoded.email });
  } catch (err) {
    res.status(400).json({ message: "Reset link has expired. Please request a new one." });
  }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, token } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email is required" });
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const cleanEmail = email.toLowerCase().trim();

    if (token) {
      // Link-based reset
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.purpose !== "reset" || decoded.email !== cleanEmail)
          return res.status(400).json({ message: "Invalid reset token" });
      } catch {
        return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
      }
    } else if (otp) {
      // OTP-based reset
      const record = await Otp.findOne({ email: cleanEmail, otp: String(otp).trim() });
      if (!record) return res.status(400).json({ message: "Invalid OTP" });
      if (record.expiresAt < Date.now())
        return res.status(400).json({ message: "OTP expired. Please request a new one." });
      await Otp.deleteMany({ email: cleanEmail });
    } else {
      return res.status(400).json({ message: "A reset token or OTP is required" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email: cleanEmail }, { password: hashed });

    return res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error("[resetPassword] error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── GET PROFILE ──────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -originalImage");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};