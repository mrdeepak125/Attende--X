"use strict";

const express = require("express");
const router  = express.Router();
const auth    = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");

router.post("/signup",              auth.signup);
router.post("/verify-otp",          auth.verifyOtp);
router.post("/resend-otp",          auth.resendOtp);
router.post("/login",               auth.login);
router.post("/forgot-password",     auth.forgotPassword);
router.get ("/verify-reset-token",  auth.verifyResetToken);
router.post("/reset-password",      auth.resetPassword);
router.get ("/profile",   protect,  auth.getProfile);

// Check if email has a pending unverified OTP (used by frontend to recover stuck accounts)
router.get ("/otp-status",          auth.checkOtpStatus);

module.exports = router;