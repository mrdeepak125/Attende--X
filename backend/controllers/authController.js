"use strict";

const User        = require("../models/User");
const Otp         = require("../models/Otp");
const bcrypt      = require("bcryptjs");
const jwt         = require("jsonwebtoken");
const transporter = require("../config/mail");
const generateOtp = require("../utils/generateOtp");

const ADMIN_EMAIL = "deepakpuri9190@gmail.com";

// ─────────────────────────────────────────────────────────────────────────────
// ROOT FIX FOR RENDER SLOW RESPONSE + EMAIL ISSUES:
//
// Problem 1 - Slow response: We were awaiting email before responding.
//   Gmail SMTP on cold Render takes 5-15s. User sees a hang then timeout.
//   Fix: Save to DB → send res.json() immediately → send email AFTER.
//
// Problem 2 - OTP not arriving: Gmail blocks SMTP from cloud servers when
//   auth fails silently. Errors only show in logs, not in the response.
//   Fix: sendEmailInBackground() catches all errors and prints them to
//   Render logs with clear messages so you can debug.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget email. Response is already sent before this runs.
 * Errors are logged to Render logs — never crash the server.
 */
function sendEmailInBackground(mailOptions, tag) {
  // process.nextTick ensures this runs after res.json() flushes
  process.nextTick(function () {
    transporter.sendMail(mailOptions, function (err, info) {
      if (err) {
        console.error("[mail:" + tag + "] FAILED to " + mailOptions.to);
        console.error("[mail:" + tag + "] Error:", err.message);
        if (/Invalid login|Username and Password/.test(err.message)) {
          console.error("[mail] *** FIX: EMAIL_PASS must be a Gmail App Password, not your normal password ***");
          console.error("[mail] *** Get one at: https://myaccount.google.com/apppasswords ***");
        }
      } else {
        console.log("[mail:" + tag + "] Sent OK to " + mailOptions.to + " id=" + info.messageId);
      }
    });
  });
}

// ── Email HTML builders ───────────────────────────────────────────────────────
function otpEmail(otp) {
  return (
    '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">' +
    '<h2 style="color:#4f46e5;margin:0 0 12px">EduStream</h2>' +
    '<p style="color:#374151;margin:0 0 20px;font-size:15px">Your one-time verification code is:</p>' +
    '<div style="background:#ffffff;border:2px solid #e5e7eb;border-radius:10px;padding:20px;' +
    'text-align:center;font-size:44px;font-weight:900;letter-spacing:12px;' +
    'color:#111827;font-family:Courier New,monospace">' + otp + '</div>' +
    '<p style="color:#6b7280;font-size:13px;margin:16px 0 0">' +
    'This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>' +
    '</div>'
  );
}

function resetEmail(resetUrl) {
  return (
    '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">' +
    '<h2 style="color:#4f46e5;margin:0 0 12px">EduStream</h2>' +
    '<p style="color:#374151;margin:0 0 20px;font-size:15px">Click the button below to reset your password:</p>' +
    '<a href="' + resetUrl + '" style="display:inline-block;background:#4f46e5;color:#ffffff;' +
    'text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">' +
    'Reset My Password</a>' +
    '<p style="color:#6b7280;font-size:13px;margin:20px 0 0">This link expires in <strong>15 minutes</strong>.</p>' +
    '<p style="color:#9ca3af;font-size:11px;margin:8px 0 0;word-break:break-all">Direct link: ' + resetUrl + '</p>' +
    '</div>'
  );
}

// ── SIGNUP ────────────────────────────────────────────────────────────────────
exports.signup = async function (req, res) {
  try {
    var email         = req.body.email;
    var password      = req.body.password;
    var userType      = req.body.userType || null;
    var username      = req.body.username || null;
    var originalImage = req.body.originalImage || null;

    // Validate
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    var cleanEmail = email.toLowerCase().trim();

    // Check existing account
    var existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      if (!existing.isVerified) {
        // Re-generate OTP and tell them to verify
        await Otp.deleteMany({ email: cleanEmail });
        var reOtp = generateOtp();
        await Otp.create({ email: cleanEmail, otp: reOtp, expiresAt: Date.now() + 5 * 60 * 1000 });

        // Respond fast
        res.json({ message: "Account exists but is not verified. A new code has been sent to your email." });

        // Email after
        sendEmailInBackground({
          from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
          to:      cleanEmail,
          subject: "Verify Your EduStream Account",
          html:    otpEmail(reOtp)
        }, "signup-reactivate");
        return;
      }
      return res.status(409).json({ message: "This email is already registered. Please log in." });
    }

    // Hash password
    var hashed = await bcrypt.hash(password, 10);

    // ── SAVE USER TO DB ──
    var user = await User.create({
      email:         cleanEmail,
      password:      hashed,
      userType:      userType,
      username:      (username && username.trim()) || cleanEmail.split("@")[0],
      originalImage: originalImage
    });
    console.log("[signup] user saved:", cleanEmail, "type:", userType);

    // ── SAVE OTP TO DB ──
    await Otp.deleteMany({ email: cleanEmail });
    var otp = generateOtp();
    await Otp.create({ email: cleanEmail, otp: otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    console.log("[signup] OTP saved for:", cleanEmail);

    // ── RESPOND IMMEDIATELY — client gets response in <500ms ──
    res.json({ message: "Account created! Check your email for the verification code." });

    // ── EMAIL FIRES AFTER RESPONSE IS SENT ──
    sendEmailInBackground({
      from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
      to:      cleanEmail,
      subject: "Verify Your EduStream Account",
      html:    otpEmail(otp)
    }, "signup-otp");

    // Admin alert for unknown userType (also background)
    var validTypes = ["student", "teacher"];
    if (!userType || validTypes.indexOf(userType) === -1) {
      sendEmailInBackground({
        from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
        to:      ADMIN_EMAIL,
        subject: "New Signup — Unknown User Type",
        html:    "<p>Email: " + cleanEmail + "</p><p>Type: " + (userType || "null") + "</p>"
      }, "admin-alert");
    }

  } catch (err) {
    console.error("[signup] error:", err.message);
    if (err.code === 11000)
      return res.status(409).json({ message: "This email is already registered." });
    if (!res.headersSent)
      res.status(500).json({ message: "Server error. Please try again." });
  }
};

// ── RESEND OTP ────────────────────────────────────────────────────────────────
exports.resendOtp = async function (req, res) {
  try {
    var email = req.body.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    var cleanEmail = email.toLowerCase().trim();
    var user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ message: "No account found with this email" });
    if (user.isVerified) return res.status(400).json({ message: "Account already verified. Please log in." });

    await Otp.deleteMany({ email: cleanEmail });
    var otp = generateOtp();
    await Otp.create({ email: cleanEmail, otp: otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    console.log("[resendOtp] new OTP for:", cleanEmail);

    // Respond fast
    res.json({ message: "New verification code sent to your email." });

    // Email after
    sendEmailInBackground({
      from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
      to:      cleanEmail,
      subject: "Your New Verification Code — EduStream",
      html:    otpEmail(otp)
    }, "resend-otp");

  } catch (err) {
    console.error("[resendOtp] error:", err.message);
    if (!res.headersSent) res.status(500).json({ message: "Server error" });
  }
};

// ── VERIFY OTP ────────────────────────────────────────────────────────────────
exports.verifyOtp = async function (req, res) {
  try {
    var email  = req.body.email;
    var otp    = req.body.otp;
    var action = req.body.action;

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP are required" });

    var cleanEmail = email.toLowerCase().trim();
    var cleanOtp   = String(otp).trim();

    var record = await Otp.findOne({ email: cleanEmail, otp: cleanOtp });
    if (!record)
      return res.status(400).json({ message: "Invalid OTP. Please check and try again." });
    if (record.expiresAt < Date.now())
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });

    if (action === "signup") {
      await User.updateOne({ email: cleanEmail }, { isVerified: true });
      await Otp.deleteMany({ email: cleanEmail });

      var user = await User.findOne({ email: cleanEmail });
      var token = jwt.sign(
        { id: user._id, userType: user.userType },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        message:  "Email verified! Welcome to EduStream.",
        token:    token,
        userType: user.userType,
        username: user.username,
        email:    user.email
      });
    }

    // reset flow — OTP stays for reset-password to consume
    return res.json({ message: "OTP valid" });

  } catch (err) {
    console.error("[verifyOtp] error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.login = async function (req, res) {
  try {
    var email    = req.body.email;
    var password = req.body.password;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    var cleanEmail = email.toLowerCase().trim();
    var user = await User.findOne({ email: cleanEmail });
    if (!user)
      return res.status(404).json({ message: "No account found with this email" });

    if (!user.isVerified) {
      // Auto resend OTP
      await Otp.deleteMany({ email: cleanEmail });
      var otp = generateOtp();
      await Otp.create({ email: cleanEmail, otp: otp, expiresAt: Date.now() + 5 * 60 * 1000 });

      res.status(403).json({
        message:  "Please verify your email first. A new code has been sent.",
        redirect: "/verify-otp",
        email:    cleanEmail
      });

      sendEmailInBackground({
        from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
        to:      cleanEmail,
        subject: "Verify Your EduStream Account",
        html:    otpEmail(otp)
      }, "login-unverified");
      return;
    }

    var match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Incorrect password" });

    var token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message:  "Login successful",
      token:    token,
      userType: user.userType,
      username: user.username || cleanEmail.split("@")[0],
      email:    user.email
    });

  } catch (err) {
    console.error("[login] error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
exports.forgotPassword = async function (req, res) {
  try {
    var email = req.body.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    var cleanEmail = email.toLowerCase().trim();
    var user = await User.findOne({ email: cleanEmail });

    // Always respond same message — don't leak if email exists
    res.json({ message: "If an account with this email exists, a reset link has been sent." });

    if (!user) return;

    var resetToken = jwt.sign(
      { email: user.email, purpose: "reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    var frontendUrl = process.env.FRONTEND_URL || "https://attende-x.vercel.app";
    var resetUrl = frontendUrl +
      "/reset-password?token=" + encodeURIComponent(resetToken) +
      "&email=" + encodeURIComponent(user.email);

    sendEmailInBackground({
      from:    '"EduStream" <' + process.env.EMAIL_USER + '>',
      to:      user.email,
      subject: "Reset Your EduStream Password",
      html:    resetEmail(resetUrl)
    }, "forgot-password");

  } catch (err) {
    console.error("[forgotPassword] error:", err.message);
    if (!res.headersSent) res.status(500).json({ message: "Server error" });
  }
};

// ── VERIFY RESET TOKEN ────────────────────────────────────────────────────────
exports.verifyResetToken = async function (req, res) {
  try {
    var token = req.query.token;
    var email = req.query.email;
    if (!token || !email)
      return res.status(400).json({ message: "Invalid reset link" });

    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== "reset" || decoded.email !== decodeURIComponent(email))
      return res.status(400).json({ message: "Invalid reset link" });

    res.json({ message: "Token valid", email: decoded.email });
  } catch (err) {
    res.status(400).json({ message: "Reset link has expired. Please request a new one." });
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
exports.resetPassword = async function (req, res) {
  try {
    var email       = req.body.email;
    var otp         = req.body.otp;
    var newPassword = req.body.newPassword;
    var token       = req.body.token;

    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    var cleanEmail = email.toLowerCase().trim();

    if (token) {
      try {
        var decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.purpose !== "reset" || decoded.email !== cleanEmail)
          return res.status(400).json({ message: "Invalid reset token" });
      } catch (e) {
        return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
      }
    } else if (otp) {
      var record = await Otp.findOne({ email: cleanEmail, otp: String(otp).trim() });
      if (!record) return res.status(400).json({ message: "Invalid OTP" });
      if (record.expiresAt < Date.now())
        return res.status(400).json({ message: "OTP expired. Please request a new one." });
      await Otp.deleteMany({ email: cleanEmail });
    } else {
      return res.status(400).json({ message: "A reset token or OTP is required" });
    }

    var hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email: cleanEmail }, { password: hashed });

    return res.json({ message: "Password reset successfully. You can now log in." });

  } catch (err) {
    console.error("[resetPassword] error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET PROFILE ───────────────────────────────────────────────────────────────
exports.getProfile = async function (req, res) {
  try {
    var user = await User.findById(req.user.id).select("-password -originalImage");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};