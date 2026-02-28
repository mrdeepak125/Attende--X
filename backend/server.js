// @ts-nocheck
"use strict";

require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const connectDB  = require("./config/db");

const app = express();

connectDB();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:7000",
    "https://attende-x.vercel.app",
    "https://attende-x-1.onrender.com",
    "https://attende-x-2.onrender.com",
    "http://auth.attendex.xyz",
    "https://attendex.xyz",
    "https://api.attendex.xyz"
  ],
  credentials: true
}));

app.use(express.json({ limit: "10mb" })); // allow base64 image uploads

// ── Root status page ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  var uptime = process.uptime();
  var h = Math.floor(uptime / 3600);
  var m = Math.floor((uptime % 3600) / 60);
  var s = Math.floor(uptime % 60);
  var uptimeStr = (h ? h + "h " : "") + (m ? m + "m " : "") + s + "s";

  var html = "";
  html += "<!DOCTYPE html><html lang='en'><head>";
  html += "<meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>EduStream Auth Server</title>";
  html += "<style>";
  html += "*{box-sizing:border-box;margin:0;padding:0}";
  html += "body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;";
  html += "     min-height:100vh;display:flex;align-items:center;justify-content:center}";
  html += ".card{background:#1e293b;border:1px solid #334155;border-radius:20px;";
  html += "      padding:44px 52px;max-width:440px;width:92%;text-align:center}";
  html += ".pulse{display:inline-block;width:11px;height:11px;border-radius:50%;";
  html += "       background:#22c55e;margin-right:8px;vertical-align:middle;";
  html += "       animation:blink 1.6s ease-in-out infinite}";
  html += "@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}";
  html += "h1{font-size:22px;font-weight:800;margin-bottom:8px}";
  html += ".sub{color:#94a3b8;font-size:14px;margin-bottom:28px}";
  html += ".badge{background:#14532d;color:#86efac;border-radius:999px;";
  html += "       display:inline-block;padding:5px 18px;font-size:13px;font-weight:700}";
  html += ".links{margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}";
  html += ".link{background:#1e3a5f;color:#93c5fd;border-radius:8px;";
  html += "      padding:6px 16px;font-size:12px;font-weight:600;text-decoration:none}";
  html += ".link:hover{background:#1d4ed8;color:#fff}";
  html += ".uptime{margin-top:18px;font-size:12px;color:#475569}";
  html += "</style></head><body>";
  html += "<div class='card'>";
  html += "<h1><span class='pulse'></span>Auth Server is Live</h1>";
  html += "<p class='sub'>EduStream &mdash; Authentication &amp; User Management</p>";
  html += "<span class='badge'>&#10003;&nbsp; All systems operational</span>";
  html += "<div class='links'>";
  html += "<a class='link' href='/health'>Health JSON</a>";
  html += "<a class='link' href='/api/auth/profile'>Profile</a>";
  html += "</div>";
  html += "<div class='uptime'>Uptime: " + uptimeStr + "</div>";
  html += "</div></body></html>";

  res.type("html").send(html);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:    "ok",
    service:   "auth-server",
    uptime:    process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ── Auth routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// ── Start ──────────────────────────────────────────────────────────────────────
const APP_PORT = process.env.PORT || 5000;
app.listen(APP_PORT, () => {
  console.log("Auth server  →  http://localhost:" + APP_PORT);
  console.log("Health       →  http://localhost:" + APP_PORT + "/health");
});