/* eslint-disable */
// @ts-nocheck
"use strict";

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");
const axios      = require("axios");
const FormData   = require("form-data");
const fs         = require("fs");
const path       = require("path");
const { createObjectCsvWriter } = require("csv-writer");

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://attende-x.vercel.app",
      "https://attende-x-1.onrender.com",
      "https://attende-x-2.onrender.com"
    ],
    methods: ["GET", "POST"]
  }
});

app.use(express.json({ limit: "50mb" }));

// Serve static files from ./public  (index.html lives there)
app.use(express.static(path.join(__dirname, "public")));

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI_VIDEO || "mongodb://127.0.0.1:27017/videoAttendance")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.warn("MongoDB:", err.message));

// ── Folders ───────────────────────────────────────────────────────────────────
["live", "original"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// ── CSV writer ────────────────────────────────────────────────────────────────
const csvWriter = createObjectCsvWriter({
  path: "attendance_log.csv",
  header: [
    { id: "username", title: "Username" },
    { id: "time",     title: "Time"     },
    { id: "result",   title: "Result"   }
  ],
  append: fs.existsSync("attendance_log.csv")
});

// ── Attendance model ──────────────────────────────────────────────────────────
const Attendance = mongoose.model(
  "Attendance",
  new mongoose.Schema({ username: String, time: Date, result: String })
);

// ── Room store ────────────────────────────────────────────────────────────────
//   rooms[roomId] = { users: [{id, username, isScreenSharing}], emptyAt: number|null }
const rooms = {};

// ── 2-minute empty-room cleanup ───────────────────────────────────────────────
const EMPTY_ROOM_TTL = 2 * 60 * 1000; // ms

setInterval(() => {
  const now = Date.now();
  for (const roomId of Object.keys(rooms)) {
    const room = rooms[roomId];
    if (room.users.length === 0 && room.emptyAt !== null && now - room.emptyAt >= EMPTY_ROOM_TTL) {
      console.log("Cleared empty room:", roomId);
      delete rooms[roomId];
    }
  }
}, 30_000); // run every 30 s

// ── Helper ────────────────────────────────────────────────────────────────────
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return (h ? h + "h " : "") + (m ? m + "m " : "") + s + "s";
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /  →  live status page (plain string concat, no template literals with HTML)
app.get("/", (req, res) => {
  const roomCount  = Object.keys(rooms).length;
  const paxCount   = Object.values(rooms).reduce(function(a, r) { return a + r.users.length; }, 0);
  const uptime     = formatUptime(process.uptime());

  var html = "";
  html += "<!DOCTYPE html><html lang='en'><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>EduStream Video Server</title>";
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
  html += "h1{font-size:23px;font-weight:800;margin-bottom:8px}";
  html += ".sub{color:#94a3b8;font-size:14px;margin-bottom:28px}";
  html += ".stats{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px}";
  html += ".stat{background:#0f172a;border-radius:12px;padding:16px 10px}";
  html += ".val{font-size:30px;font-weight:900;color:#818cf8}";
  html += ".lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}";
  html += ".badge{background:#14532d;color:#86efac;border-radius:999px;";
  html += "       display:inline-block;padding:5px 18px;font-size:13px;font-weight:700}";
  html += ".links{margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}";
  html += ".link{background:#1e3a5f;color:#93c5fd;border-radius:8px;";
  html += "      padding:6px 16px;font-size:12px;font-weight:600;text-decoration:none}";
  html += ".link:hover{background:#1d4ed8;color:#fff}";
  html += ".uptime{margin-top:18px;font-size:12px;color:#475569}";
  html += "</style></head><body>";
  html += "<div class='card'>";
  html += "<h1><span class='pulse'></span>Video Server is Live</h1>";
  html += "<p class='sub'>EduStream &mdash; WebRTC signalling &amp; attendance</p>";
  html += "<div class='stats'>";
  html += "<div class='stat'><div class='val'>" + roomCount + "</div><div class='lbl'>Active Rooms</div></div>";
  html += "<div class='stat'><div class='val'>" + paxCount  + "</div><div class='lbl'>Participants</div></div>";
  html += "</div>";
  html += "<span class='badge'>&#10003;&nbsp; All systems operational</span>";
  html += "<div class='links'>";
  html += "<a class='link' href='/health'>Health JSON</a>";
  html += "<a class='link' href='/live'>Live View</a>";
  html += "</div>";
  html += "<div class='uptime'>Uptime: " + uptime + "</div>";
  html += "</div></body></html>";

  res.type("html").send(html);
});

// GET /health  →  JSON for uptime monitors
app.get("/health", (req, res) => {
  res.json({
    status:       "ok",
    uptime:       process.uptime(),
    rooms:        Object.keys(rooms).length,
    participants: Object.values(rooms).reduce(function(a, r) { return a + r.users.length; }, 0),
    timestamp:    new Date().toISOString()
  });
});

// GET /live  →  browser-based live view (public/index.html)
app.get("/live", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Face verification ─────────────────────────────────────────────────────────
app.post("/verify", async (req, res) => {
  try {
    var image    = req.body.image;
    var username = req.body.username;

    if (!image || !username) return res.json({ error: "Missing data" });

    var buffer       = Buffer.from(image.split(",")[1], "base64");
    var livePath     = path.join("live",     username + ".jpg");
    var originalPath = path.join("original", username + ".jpg");

    fs.writeFileSync(livePath, buffer);

    if (!fs.existsSync(originalPath)) {
      return res.json({ error: "No registered image found for: " + username });
    }

    var formData = new FormData();
    formData.append("live_image",     fs.createReadStream(livePath));
    formData.append("original_image", fs.createReadStream(originalPath));

    var faceVerifyUrl = process.env.FACE_VERIFY_URL || "http://127.0.0.1:8000/verify-face";
    var response = await axios.post(faceVerifyUrl, formData, { headers: formData.getHeaders() });

    var record = { username: username, time: new Date(), result: JSON.stringify(response.data) };
    await Attendance.create(record);
    await csvWriter.writeRecords([record]);

    res.json(response.data);
  } catch (err) {
    console.error("Verify error:", err.message);
    res.json({ error: "Verification failed" });
  }
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on("connection", function(socket) {

  socket.on("join", function(data) {
    var room     = data.room;
    var username = data.username || socket.id;

    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = { users: [], emptyAt: null };
    }

    // Cancel any pending cleanup timer
    rooms[room].emptyAt = null;

    // ── FIX: Deduplicate — if this socket already exists in the room, remove the
    // old entry first. This prevents the "12 copies of the same user" bug that
    // happened when getUserMedia was called inside useEffect([isCameraOff]),
    // triggering socket.emit('join') on every camera toggle.
    rooms[room].users = rooms[room].users.filter(function(u) { return u.id !== socket.id; });

    var user = {
      id: socket.id,
      username: username,
      isScreenSharing: false,
      audioMuted: false,
      videoOff: false
    };
    rooms[room].users.push(user);

    // Send current users list to the new joiner (excluding self)
    var others = rooms[room].users.filter(function(u) { return u.id !== socket.id; });
    socket.emit("users", others);

    // Notify everyone else about the new joiner
    socket.to(room).emit("new-user", { id: socket.id, username: username });

    socket._room     = room;
    socket._username = username;

    console.log("[join] " + username + " → room " + room + " (total: " + rooms[room].users.length + ")");
  });

  socket.on("offer", function(d) {
    io.to(d.target).emit("offer", { offer: d.offer, sender: socket.id });
  });

  socket.on("answer", function(d) {
    io.to(d.target).emit("answer", { answer: d.answer, sender: socket.id });
  });

  socket.on("ice", function(d) {
    io.to(d.target).emit("ice", { candidate: d.candidate, sender: socket.id });
  });

  socket.on("chat-message", function(d) {
    // Only relay to others; sender appends locally
    socket.to(d.room).emit("chat-message", {
      id:       d.id,
      sender:   d.sender,
      senderId: socket.id,
      text:     d.text,
      time:     d.time
    });
  });

  socket.on("screen-sharing", function(d) {
    var roomId = d.room;
    if (rooms[roomId]) {
      var u = rooms[roomId].users.find(function(x) { return x.id === socket.id; });
      if (u) u.isScreenSharing = d.active;
    }
    socket.to(roomId).emit("screen-sharing", { id: socket.id, active: d.active });
  });

  // ── FIX: Relay mic/camera state so other users see the muted/cam-off icons ──
  socket.on("media-state", function(d) {
    var roomId = d.room;
    // Update stored state so late-joining users see correct icons
    if (rooms[roomId]) {
      var u = rooms[roomId].users.find(function(x) { return x.id === socket.id; });
      if (u) {
        u.audioMuted = d.audioMuted;
        u.videoOff   = d.videoOff;
      }
    }
    // Broadcast to everyone else in the room
    socket.to(roomId).emit("media-state", {
      id:         socket.id,
      audioMuted: d.audioMuted,
      videoOff:   d.videoOff
    });
  });

  socket.on("disconnect", function() {
    for (var roomId of Object.keys(rooms)) {
      var room = rooms[roomId];
      var idx  = room.users.findIndex(function(u) { return u.id === socket.id; });
      if (idx === -1) continue;

      var left = room.users.splice(idx, 1)[0];
      io.to(roomId).emit("user-left", { id: socket.id, username: left.username });

      if (room.users.length === 0) {
        room.emptyAt = Date.now();
        console.log("Room '" + roomId + "' is empty — will be cleared in 2 minutes");
      }
      break;
    }
  });

});

// ── Start ─────────────────────────────────────────────────────────────────────
var VIDEO_PORT = process.env.PORT || process.env.VIDEO_PORT || 7000;
var serverUrl  = process.env.RENDER_EXTERNAL_URL || ("http://localhost:" + VIDEO_PORT);

server.listen(VIDEO_PORT, function() {
  console.log("Video server  →  http://localhost:" + VIDEO_PORT);
  console.log("Health check  →  http://localhost:" + VIDEO_PORT + "/health");
  console.log("Live view     →  http://localhost:" + VIDEO_PORT + "/live");

  // ── Keep-alive self-ping (prevents Render free tier cold starts) ──
  var http_mod  = require("http");
  var https_mod = require("https");
  var PING_MS   = 14 * 60 * 1000; // 14 minutes

  function keepAlive() {
    try {
      var url    = serverUrl + "/health";
      var client = url.startsWith("https") ? https_mod : http_mod;
      var req = client.get(url, function(res) {
        console.log("[keep-alive] ping OK — status:", res.statusCode);
        res.resume();
      });
      req.on("error", function(e) { console.warn("[keep-alive] ping failed:", e.message); });
      req.setTimeout(10000, function() { req.destroy(); });
    } catch(e) { console.warn("[keep-alive] error:", e.message); }
  }

  // First ping after 1 minute, then every 14 minutes
  setTimeout(function() {
    keepAlive();
    setInterval(keepAlive, PING_MS);
  }, 60 * 1000);

  console.log("[keep-alive] started — pinging every 14 min to prevent Render cold starts");
});