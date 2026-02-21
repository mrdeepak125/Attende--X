const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { createObjectCsvWriter } = require("csv-writer");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "50mb" }));

mongoose.connect("mongodb://127.0.0.1:27017/videoAttendance");

// ===== FOLDERS =====
if (!fs.existsSync("live")) fs.mkdirSync("live");
if (!fs.existsSync("original")) fs.mkdirSync("original");

// ===== CSV =====
const csvWriter = createObjectCsvWriter({
  path: "attendance_log.csv",
  header: [
    { id: "username", title: "Username" },
    { id: "time", title: "Time" },
    { id: "result", title: "Result" }
  ],
  append: fs.existsSync("attendance_log.csv")
});

// ===== MODEL =====
const attendanceSchema = new mongoose.Schema({
  username: String,
  time: Date,
  result: String
});
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ===== ROOM STORE =====
let rooms = {};

// ================= FRONTEND =================
app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Smart Video Attendance</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{margin:0;background:#0f172a;color:white;font-family:sans-serif}
.top{padding:10px;text-align:center;background:#1e293b}
.grid{display:flex;flex-wrap:wrap;justify-content:center}
video{width:280px;margin:10px;border-radius:15px;background:black}
.controls{position:fixed;bottom:0;width:100%;background:#1e293b;padding:10px;text-align:center}
button{padding:10px;margin:5px;border:none;border-radius:50px;cursor:pointer}
#result{position:fixed;top:10px;right:10px;background:#16a34a;padding:8px;border-radius:8px}
.chat{position:fixed;right:0;top:0;width:250px;height:100%;background:#111;padding:10px;overflow:auto}
</style>
</head>
<body>

<div class="top">
<input id="username" placeholder="Username"/>
<input id="room" placeholder="Room Code"/>
<button onclick="join()">Join</button>
</div>

<div class="grid" id="videos">
<video id="localVideo" autoplay playsinline muted></video>
</div>

<div id="result">Waiting verification...</div>

<div class="chat">
<h3>Chat</h3>
<div id="chatBox"></div>
<input id="msg"/>
<button onclick="sendChat()">Send</button>
</div>

<div class="controls">
<button id="muteBtn" onclick="toggleMute()">🎤</button>
<button id="screenBtn" onclick="toggleScreen()">🖥️</button>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>

const socket = io();
let localStream;
let peers={};
let room, username;
let muted=false;
let sharing=false;
let screenTrack;

// ===== START CAMERA =====
async function startCam(){
 try{
  localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  document.getElementById("localVideo").srcObject=localStream;
 }catch{
  alert("Camera Required!");
  return;
 }

 localStream.getVideoTracks()[0].onended=()=>{
  alert("Camera cannot be disabled!");
  location.reload();
 };
}

// ===== JOIN ROOM =====
async function join(){
 username=document.getElementById("username").value;
 room=document.getElementById("room").value;
 if(!username||!room) return alert("Enter details");

 await startCam();
 socket.emit("join",{room,username});

 setInterval(captureFace,600000); // every 10 min
 setTimeout(captureFace,10000);   // first check after 10 sec
}

// ===== FACE CAPTURE =====
function captureFace(){
 const video=document.getElementById("localVideo");
 const canvas=document.createElement("canvas");
 canvas.width=video.videoWidth;
 canvas.height=video.videoHeight;
 canvas.getContext("2d").drawImage(video,0,0);
 const base64=canvas.toDataURL("image/jpeg");

 fetch("/verify",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({image:base64,username})
 })
 .then(res=>res.json())
 .then(data=>{
  document.getElementById("result").innerText="Status: "+JSON.stringify(data);
 });
}

// ===== SOCKET EVENTS =====
socket.on("users",users=>{
 users.forEach(id=>createPeer(id,true));
});

socket.on("new-user",id=>{
 createPeer(id,false);
});

socket.on("offer",async(data)=>{
 createPeer(data.sender,false);
 await peers[data.sender].setRemoteDescription(data.offer);
 const ans=await peers[data.sender].createAnswer();
 await peers[data.sender].setLocalDescription(ans);
 socket.emit("answer",{answer:ans,target:data.sender});
});

socket.on("answer",async(data)=>{
 await peers[data.sender].setRemoteDescription(data.answer);
});

socket.on("ice",data=>{
 peers[data.sender].addIceCandidate(data.candidate);
});

// ===== CREATE PEER =====
function createPeer(id,init){
 const peer=new RTCPeerConnection({
  iceServers:[{urls:"stun:stun.l.google.com:19302"}]
 });
 peers[id]=peer;

 localStream.getTracks().forEach(t=>peer.addTrack(t,localStream));

 peer.ontrack=e=>{
  let v=document.getElementById(id);
  if(!v){
   v=document.createElement("video");
   v.id=id;
   v.autoplay=true;
   v.playsInline=true;
   document.getElementById("videos").appendChild(v);
  }
  v.srcObject=e.streams[0];
 };

 peer.onicecandidate=e=>{
  if(e.candidate){
   socket.emit("ice",{candidate:e.candidate,target:id});
  }
 };

 if(init){
  peer.createOffer().then(o=>{
   peer.setLocalDescription(o);
   socket.emit("offer",{offer:o,target:id});
  });
 }
}

// ===== MUTE =====
function toggleMute(){
 muted=!muted;
 localStream.getAudioTracks()[0].enabled=!muted;
 document.getElementById("muteBtn").innerText=muted?"🔇":"🎤";
}

// ===== SCREEN SHARE =====
async function toggleScreen(){
 if(!sharing){
  const screen=await navigator.mediaDevices.getDisplayMedia({video:true});
  screenTrack=screen.getVideoTracks()[0];

  for(let id in peers){
   const sender=peers[id].getSenders().find(s=>s.track.kind==="video");
   sender.replaceTrack(screenTrack);
  }

  screenTrack.onended=stopScreen;
  document.getElementById("screenBtn").innerText="⛔";
  sharing=true;
 }else{
  stopScreen();
 }
}

function stopScreen(){
 for(let id in peers){
  const sender=peers[id].getSenders().find(s=>s.track.kind==="video");
  sender.replaceTrack(localStream.getVideoTracks()[0]);
 }
 document.getElementById("screenBtn").innerText="🖥️";
 sharing=false;
}

// ===== CHAT =====
function sendChat(){
 const msg=document.getElementById("msg").value;
 socket.emit("chat",{room,msg,username});
}

socket.on("chat",data=>{
 document.getElementById("chatBox").innerHTML+=
 "<p><b>"+data.username+":</b> "+data.msg+"</p>";
});

</script>
</body>
</html>
`);
});

// ================= SOCKET BACKEND =================
io.on("connection",socket=>{

 socket.on("join",({room,username})=>{
  socket.join(room);
  if(!rooms[room]) rooms[room]=[];
  rooms[room].push(socket.id);

  socket.emit("users",rooms[room].filter(id=>id!==socket.id));
  socket.to(room).emit("new-user",socket.id);
 });

 socket.on("offer",d=>{
  io.to(d.target).emit("offer",{offer:d.offer,sender:socket.id});
 });

 socket.on("answer",d=>{
  io.to(d.target).emit("answer",{answer:d.answer,sender:socket.id});
 });

 socket.on("ice",d=>{
  io.to(d.target).emit("ice",{candidate:d.candidate,sender:socket.id});
 });

 socket.on("chat",d=>{
  io.to(d.room).emit("chat",d);
 });

});

// ================= FACE VERIFY =================
app.post("/verify", async (req,res)=>{
 try{
  const { image, username } = req.body;

  if(!image||!username) return res.json({error:"Missing data"});

  const base64Data = image.split(',')[1];
  const buffer=Buffer.from(base64Data,"base64");

  const livePath=path.join("live",username+".jpg");
  const originalPath=path.join("original",username+".jpg");

  fs.writeFileSync(livePath,buffer);

  if(!fs.existsSync(originalPath))
   return res.json({error:"Original image not found"});

  const formData=new FormData();
  formData.append("live_image",fs.createReadStream(livePath));
  formData.append("original_image",fs.createReadStream(originalPath));

  const response=await axios.post(
   "http://127.0.0.1:8000/verify-face",
   formData,
   {headers:formData.getHeaders()}
  );

  const record={
   username,
   time:new Date(),
   result:JSON.stringify(response.data)
  };

  await Attendance.create(record);
  await csvWriter.writeRecords([record]);

  res.json(response.data);

 }catch(err){
  console.log(err);
  res.json({error:"Verification failed"});
 }
});

// ================= START =================
server.listen(3000,()=>console.log("Running on http://localhost:3000"));