require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

connectDB();

// CORS configuration
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:7000",
    "http://10.211.180.187:3000",
  ]
}));

app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));

const APP_PORT = process.env.PORT || 5000;
app.listen(APP_PORT, () =>
  console.log(`Server running on port ${APP_PORT}`)
);