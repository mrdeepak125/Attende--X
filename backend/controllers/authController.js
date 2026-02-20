const User = require("../models/User");
const Otp = require("../models/Otp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const transporter = require("../config/mail");
const generateOtp = require("../utils/generateOtp");

// SEND OTP
const sendOtpEmail = async (email, otp) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP Code",
    html: `<h3>Your OTP is: ${otp}</h3>`
  });
};

// SIGNUP
exports.signup = async (req, res) => {
  const { email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.json({ message: "User already exists" });

  const hashed = await bcrypt.hash(password, 10);

  await User.create({ email, password: hashed });

  const otp = generateOtp();

  await Otp.create({
    email,
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  await sendOtpEmail(email, otp);

  res.json({ message: "OTP sent to email" });
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const record = await Otp.findOne({ email, otp });

  if (!record) return res.json({ message: "Invalid OTP" });

  if (record.expiresAt < Date.now())
    return res.json({ message: "OTP expired" });

  await User.updateOne({ email }, { isVerified: true });
  await Otp.deleteMany({ email });

  res.json({ message: "Email verified successfully" });
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if body data exists
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(500).json({ message: "User password missing in DB" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify email first" });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ message: "Login successful", token });

  } catch (error) {
    console.log("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ message: "User not found" });

  const otp = generateOtp();

  await Otp.create({
    email,
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  await sendOtpEmail(email, otp);

  res.json({ message: "Reset OTP sent" });
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const record = await Otp.findOne({ email, otp });
  if (!record) return res.json({ message: "Invalid OTP" });

  if (record.expiresAt < Date.now())
    return res.json({ message: "OTP expired" });

  const hashed = await bcrypt.hash(newPassword, 10);

  await User.updateOne({ email }, { password: hashed });

  await Otp.deleteMany({ email });

  res.json({ message: "Password reset successful" });
};