<!-- ...existing code... -->
# 🎯 VisionGuard AI

AI-Powered Smart Attendance & Proxy Detection System  
Enigma’26 — Hackathon Project

---

## TL;DR
VisionGuard AI prevents proxy/fake attendance in online/hybrid classes using face recognition, multi-stage validation, activity tracking and real-time teacher monitoring. Exports attendance reports (CSV / Excel).

---

## Features
- Face descriptor matching (face-api.js)
- Multi-stage checks: start, mid, random, end
- Join/leave tracking and total active duration
- Live teacher dashboard (WebRTC + Socket.io)
- Exportable CSV / Excel reports
- JWT auth and role-based access

---

## Tech Stack
- Frontend: React, Tailwind CSS, WebRTC, face-api.js, Socket.io
- Backend: Node.js, Express, MongoDB, Socket.io, JWT
- Reports: json2csv, exceljs

---

## Quick Start

1. Clone
   - git clone <repo-url>
2. Server
   - cd server
   - npm install
   - create .env (see below)
   - npm run dev
3. Client
   - cd client
   - npm install
   - npm start

---

## Environment Variables (server/.env)
- MONGO_URI=your_mongo_connection_string
- JWT_SECRET=your_jwt_secret
- PORT=5000

---

## Project Structure (summary)
visionguard-ai/
- client/ — React frontend (components, pages, utils)
- server/ — Express API (controllers, models, routes, socket handlers)
- README.md

Key server files:
- server/controllers: authController.js, classController.js, attendanceController.js
- server/models: User.js, Class.js, AttendanceLog.js
- server/utils: generateRoomCode.js, exportReport.js
- server/socket: socketHandler.js
- server/server.js

Key client files:
- client/src/components: TeacherDashboard.jsx, StudentDashboard.jsx, ClassRoom.jsx, FaceScanner.jsx, ReportTable.jsx
- client/src/utils: socket.js, api.js
- client/src/pages: Login.jsx, Register.jsx, Home.jsx

---

## Database Schemas (summary)
User: { name, email, password, role, faceDescriptor[], createdAt }  
Class: { title, teacherId, duration, roomCode, maxStudents, startTime, endTime }  
AttendanceLog: { classId, studentId, joinTime, leaveTime, faceMatchCount, matchTimestamps[], status }

---

## Attendance Flow
1. Student joins with room code and camera permission.  
2. Face descriptor compared to stored profile.  
3. Checks occur at multiple stages; system logs matches, timestamps and active duration.  
4. Status assigned: Present / Suspicious / Absent.

---

## API (high-level)
- POST /api/auth/register
- POST /api/auth/login
- POST /api/classes
- GET /api/classes/:code
- POST /api/attendance
- GET /api/reports/:classId

---

## Running Tests
- Server: cd server && npm test  
- Client: cd client && npm test (if tests present)

---

## Contribution
- Open an issue for bugs/features.
- Fork, create a branch, implement changes and submit a PR.

---

## Future Work
- Emotion detection, eye/tab-switch tracking, LMS integrations, behavior scoring.

---

## License
Developed during Enigma’26 Hackathon. All rights reserved.