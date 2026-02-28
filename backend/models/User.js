"use strict";
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email:         { type: String, unique: true, required: true, lowercase: true, trim: true },
  password:      { type: String, required: true },
  username:      { type: String, trim: true },
  userType:      { type: String, enum: ["student", "teacher", null], default: null },
  isVerified:    { type: Boolean, default: false },
  originalImage: { type: String, default: null }, // base64 for face attendance
  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);