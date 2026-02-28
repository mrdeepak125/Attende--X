"use strict";

const nodemailer = require("nodemailer");

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("[mail] WARNING: EMAIL_USER or EMAIL_PASS not set in environment variables!");
}

const transporter = nodemailer.createTransport({
  service: "gmail",         // let nodemailer handle gmail's host/port automatically
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  // 16-char App Password ONLY
  },
  tls: { rejectUnauthorized: false }
});

// Verify SMTP connection on startup so errors show in Render logs immediately
transporter.verify((err) => {
  if (err) {
    console.error("[mail] SMTP verify FAILED:", err.message);
    console.error("[mail] Fix: Check EMAIL_USER and EMAIL_PASS in Render environment variables");
    console.error("[mail] Fix: EMAIL_PASS must be a Gmail App Password (16 chars), NOT your login password");
  } else {
    console.log("[mail] SMTP ready ✓ — using:", process.env.EMAIL_USER);
  }
});

module.exports = transporter;