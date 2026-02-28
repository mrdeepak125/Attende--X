// @ts-nocheck
"use strict";

require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const connectDB = require("./config/db");

const app = express();

connectDB();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    var allowed = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://attende-x.vercel.app",
      "https://attende-x-1.onrender.com",
      "https://attende-x-2.onrender.com"
    ];
    if (allowed.indexOf(origin) !== -1) return callback(null, true);
    // Also allow any *.vercel.app or *.onrender.com subdomain for previews
    if (/\.vercel\.app$/.test(origin) || /\.onrender\.com$/.test(origin))
      return callback(null, true);
    return callback(null, true); // permissive in prod — tighten if needed
  },
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));

// ── Status page ───────────────────────────────────────────────────────────────
app.get("/", function (req, res) {
  var uptime = process.uptime();
  var h = Math.floor(uptime / 3600);
  var m = Math.floor((uptime % 3600) / 60);
  var s = Math.floor(uptime % 60);
  var u = (h ? h + "h " : "") + (m ? m + "m " : "") + s + "s";

  res.type("html").send(
    "<!DOCTYPE html><html><head><meta charset=UTF-8>" +
    "<title>EduStream Auth</title>" +
    "<style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}" +
    ".c{background:#1e293b;border:1px solid #334155;border-radius:20px;padding:40px;max-width:420px;width:90%;text-align:center}" +
    ".dot{display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:50%;margin-right:8px;animation:p 1.5s infinite}" +
    "@keyframes p{0%,100%{opacity:1}50%{opacity:.2}}" +
    "h1{font-size:22px;font-weight:800;margin:0 0 8px}" +
    "p{color:#94a3b8;font-size:14px;margin:0 0 24px}" +
    ".b{background:#14532d;color:#86efac;border-radius:999px;padding:5px 18px;font-size:13px;font-weight:700}" +
    ".ut{margin-top:20px;font-size:12px;color:#475569}" +
    "</style></head><body>" +
    "<div class=c>" +
    "<h1><span class=dot></span>Auth Server is Live</h1>" +
    "<p>EduStream &mdash; Auth &amp; User Management</p>" +
    "<span class=b>&#10003; All systems operational</span>" +
    "<div class=ut>Uptime: " + u + "</div>" +
    "</div></body></html>"
  );
});

// ── Health check (used by keep-alive ping below) ──────────────────────────────
app.get("/health", function (req, res) {
  res.json({ status: "ok", uptime: process.uptime(), ts: new Date().toISOString() });
});

// ── Auth routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use(function (req, res) {
  res.status(404).json({ message: "Route not found" });
});

// ── Start server ──────────────────────────────────────────────────────────────
var PORT = process.env.PORT || 5000;
var serverUrl = process.env.RENDER_EXTERNAL_URL || ("http://localhost:" + PORT);

var httpServer = app.listen(PORT, function () {
  console.log("Auth server running on port " + PORT);
  console.log("URL: " + serverUrl);

  // ── KEEP-ALIVE PING ─────────────────────────────────────────────────────────
  // Render free tier spins down after 15 min of inactivity → 30-50s cold start.
  // This pings our own /health every 14 minutes to keep the instance warm.
  // Result: first user request responds in <500ms instead of timing out.
  //
  // NOTE: Render free tier will still show a "spinning down" warning in the
  // dashboard, but the server won't actually spin down while this is running.
  var PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

  var http  = require("http");
  var https = require("https");

  function keepAlive() {
    try {
      var url    = serverUrl + "/health";
      var client = url.startsWith("https") ? https : http;

      var req = client.get(url, function (res) {
        console.log("[keep-alive] ping OK — status:", res.statusCode);
        res.resume(); // drain response body
      });

      req.on("error", function (err) {
        console.warn("[keep-alive] ping failed:", err.message);
      });

      req.setTimeout(10000, function () {
        req.destroy();
        console.warn("[keep-alive] ping timed out");
      });
    } catch (e) {
      console.warn("[keep-alive] error:", e.message);
    }
  }

  // Start pinging after 1 minute (give server time to fully initialise)
  setTimeout(function () {
    keepAlive(); // first ping
    setInterval(keepAlive, PING_INTERVAL);
  }, 60 * 1000);

  console.log("[keep-alive] started — pinging every 14 minutes to prevent cold starts");
});

module.exports = app;