import express from "express";
import rateLimit from "express-rate-limit";
import Joi from "joi";
import jwt from "jsonwebtoken";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendAudio } from "./sender.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
//import model
import User from "./model/User.js";
import Admin from "./model/Admin.js";
import Data from "./model/Data.js";

// server init
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_PATIENT_SECRET = process.env.JWT_PATIENT_SECRET || "example";
const JWT_DOCTOR_SECRET = process.env.JWT_DOCTOR_SECRET || "axample";
app.set("trust proxy", 1);

//connetingconst cors = require("cors");

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

//making uploads folder static
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".m4a")) {
        res.setHeader("Content-Type", "audio/m4a");
      }
    },
  }),
);

//Client
app.use((req, res, next) => {
  const ip = req.ip;
  req.clientIp = ip.replace("::ffff:", "");
  next();
});

mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/BoundingBoxers",
  )
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error", err));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per window
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const UserLoginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).max(128).required(),
});

const AdminLoginSchema = Joi.object({
  adminName: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).max(128).required(),
});

app.get("/ping", (req, res) => {
  res.status(200).json({ message: "pong" });
});

app.post("/adminlogin", authLimiter, async (req, res) => {
  const { error } = AdminLoginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  const { adminName, password } = req.body;

  try {
    const admin = await Admin.findOne({ adminName });

    if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ adminId: admin.adminId }, JWT_ADMIN_SECRET, {
      expiresIn: "1d",
    });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/adminsignup", authLimiter, async (req, res) => {
  const { error } = AdminLoginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  const { adminName, password } = req.body;

  if (!adminName || !password)
    return res.status(400).json({ message: "adminName and password required" });

  if (await Admin.findOne({ adminName }))
    return res.status(409).json({ message: "adminName already taken" });

  const passwordHash = await bcrypt.hash(password, 8);
  const adminId = `admin${Date.now()}`;

  const newAdmin = new Admin({ adminId, adminName, passwordHash });
  await newAdmin.save();

  // const newTodo = new Todo({ userId: userId, tasks: {}, comptasks: {} });
  // await newTodo.save();

  const token = jwt.sign({ adminId: adminId }, JWT_ADMIN_SECRET, {
    expiresIn: "1d",
  });
  res.status(201).json({ token });
});

app.get("/adminwhoami", authenticateAdminToken, async (req, res) => {
  const admin = await Admin.findOne({ adminId: req.adminId });
  if (!admin) return res.status(404).json({ message: "invalid token" });

  res.send({ adminId: admin.id, adminName: admin.adminName });
});

app.post("/login", authLimiter, async (req, res) => {
  const { error } = UserLoginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.userId }, JWT_USER_SECRET, {
      expiresIn: "7d",
    });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/signup", authLimiter, async (req, res) => {
  const { error } = UserLoginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Username and password required" });

  if (await User.findOne({ username }))
    return res.status(409).json({ message: "Username already taken" });

  const passwordHash = await bcrypt.hash(password, 8);
  var time = Date.now();
  const userId = `user${time}`;
  // console.log("signed up ",userId);
  const newUser = new User({ userId, username, passwordHash });
  await newUser.save();

  // const newTodo = new Todo({ userId: userId, tasks: {}, comptasks: {} });
  // await newTodo.save();

  const token = jwt.sign({ userId: newUser.userId }, JWT_USER_SECRET, {
    expiresIn: "7d",
  });
  res.json({ token });
});

app.get("/whoami", authenticateUserToken, async (req, res) => {
  const user = await User.findOne({ userId: req.userId });
  if (!user) return res.status(404).json({ message: "invalid token" });

  res.send({ UserId: user.id, username: user.username });
});

function authenticateUserToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, JWT_USER_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.sendStatus(403);
  }
}

function authenticateAdminToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, JWT_ADMIN_SECRET);
    req.adminId = decoded.adminId;
    next();
  } catch {
    res.sendStatus(403);
  }
}

/* uploads */
const uploadsDir = process.env.UPLOADS_DIR || "./uploads";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

//To tell where to store
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) =>
    cb(null, crypto.randomUUID() + (path.extname(file.originalname) || ".mp4")),
});

//Acrually Stores
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* health */
app.get("/health", (req, res) => {
  res.json({
    status: "active",
    timestamp: new Date().toISOString(),
    clientIp: req.clientIp,
  });
});

/* panic */
app.post(
  "/panic",
  authenticateUserToken,
  upload.single("audio"),
  async (req, res) => {
    try {
      const userId = req.userId;

      const user = await User.findOne({ userId });
      if (!user) {
        return res.status(400).json({ message: "UserId mismatch" });
      }

      const prevData = await Data.findOne({ userId });
      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);

      const location =
        !isNaN(latitude) && !isNaN(longitude) ? { latitude, longitude } : null;
      const samples = JSON.parse(req.body.samples || "[]");

      let dangerIndex = prevData?.score || 0;
      let audioEntry = null;

      if (req.file) {
        try {
          const audioResult = await sendAudio(`./uploads/${req.file.filename}`);
          console.log(audioResult);

          const newScore = audioResult.confidence_score || 0;

          if (dangerIndex !== 0) {
            dangerIndex = (dangerIndex + newScore) / 2;
          } else {
            dangerIndex = newScore;
          }
        } catch (err) {
          console.log(err);
        }

        audioEntry = {
          filename: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
          dangerIndex: dangerIndex,
        };
      }

      const pushOps = {};

      if (audioEntry) {
        pushOps.audioFiles = audioEntry;
      }

      if (samples.length) {
        pushOps.motionSamples = samples;
      }

      if (location) {
        pushOps.location = {
          $each: [location],
          $slice: -10,
        };
      }

      await Data.findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            score: dangerIndex,
            updatedAt: new Date(),
          },

          ...(Object.keys(pushOps).length && { $push: pushOps }),

          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      res.json({
        status: "panic_received",
        samplesCount: samples.length,
        audioReceived: !!req.file,
        dangerIndex: Number(dangerIndex.toFixed(2)),
      });

      if (req.file) {
        setTimeout(() => {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        }, 600000);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "panic failed" });
    }
  },
);

/* individual data */
app.post("/admin/data", authenticateAdminToken, async (req, res) => {
  // console.log(req.body)
  const admin = await Admin.findOne({ adminId: req.adminId });
  if (!admin) return res.status(401).json({ message: "Invalid Admin" });
  // if(admin)console.log(admin.adminName);
  const data = await Data.findOne({ userId: req.body.userId });
  // console.log(req.body.userId)
  const user = await User.findOne({ userId: req.body.userId });
  if (!data) return res.status(404).json({ message: "no data" });

  res.json({
    userId: data.userId,
    username: user.username,
    location: data.location,
    score: data.score,
    updatedAt: data.updatedAt,
    createdAt: data.createdAt,
  });
});

/* collective data*/
app.get("/admin/users", authenticateAdminToken, async (req, res) => {
  const admin = await Admin.findOne({ adminId: req.adminId });
  if (!admin) return res.status(401).json({ message: "Invalid Admin" });
  // if(admin)console.log(admin.adminName);
  const users = await Data.find({}, { userId: 1, score: 1, _id: 0 }).sort({
    score: -1,
  });

  res.json(users);
});

/* start */
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
