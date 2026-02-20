const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Simple Video Meet</title>
<style>
body { font-family: Arial; text-align:center; background:#111; color:white; }
video { width:300px; margin:10px; border-radius:10px; }
button,input { padding:10px; margin:5px; }
</style>
</head>
<body>

<h2>Video Meeting App</h2>

<div id="join">
  <input id="roomInput" placeholder="Enter Room Code"/>
  <button onclick="createRoom()">Create Room</button>
  <button onclick="joinRoom()">Join Room</button>
</div>

<h3 id="roomDisplay"></h3>

<div>
  <video id="localVideo" autoplay muted playsinline></video>
  <video id="remoteVideo" autoplay playsinline></video>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>

const socket = io();
let localStream;
let peer;
let roomCode;

function generateRoomCode(){
  const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code="";
  for(let i=0;i<4;i++){
    code+=chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return code;
}

async function startMedia(){
  localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  document.getElementById("localVideo").srcObject = localStream;
}

function createRoom(){
  roomCode = generateRoomCode();
  document.getElementById("roomDisplay").innerText="Room: "+roomCode;
  socket.emit("join-room", roomCode);
  startMedia();
}

function joinRoom(){
  roomCode = document.getElementById("roomInput").value;
  if(!roomCode) return alert("Enter Room Code");
  document.getElementById("roomDisplay").innerText="Room: "+roomCode;
  socket.emit("join-room", roomCode);
  startMedia();
}

socket.on("user-joined", async () => {
  createPeer(true);
});

socket.on("offer", async offer => {
  createPeer(false);
  await peer.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", answer, roomCode);
});

socket.on("answer", async answer => {
  await peer.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", async candidate => {
  if(candidate) await peer.addIceCandidate(new RTCIceCandidate(candidate));
});

function createPeer(isInitiator){
  peer = new RTCPeerConnection();

  localStream.getTracks().forEach(track=>{
    peer.addTrack(track, localStream);
  });

  peer.ontrack = event=>{
    document.getElementById("remoteVideo").srcObject = event.streams[0];
  };

  peer.onicecandidate = event=>{
    if(event.candidate){
      socket.emit("ice-candidate", event.candidate, roomCode);
    }
  };

  if(isInitiator){
    peer.createOffer().then(offer=>{
      peer.setLocalDescription(offer);
      socket.emit("offer", offer, roomCode);
    });
  }
}

</script>
</body>
</html>
  `);
});

io.on("connection", socket => {

  socket.on("join-room", roomCode => {
    socket.join(roomCode);
    socket.to(roomCode).emit("user-joined");
  });

  socket.on("offer", (offer, roomCode) => {
    socket.to(roomCode).emit("offer", offer);
  });

  socket.on("answer", (answer, roomCode) => {
    socket.to(roomCode).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate, roomCode) => {
    socket.to(roomCode).emit("ice-candidate", candidate);
  });

});

server.listen(5000, () => console.log("Server running on http://localhost:5000"));