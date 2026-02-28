"use strict";

// Returns a zero-padded 4-digit OTP string
module.exports = function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
};