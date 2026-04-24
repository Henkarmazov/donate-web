import express from "express";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      isConnected = true;
      console.log("✅ Connected to MongoDB Atlas");
    } catch (err) {
      console.error("❌ MongoDB connection error:", err);
    }
  }
}

// Donation Schema
const donationSchema = new mongoose.Schema({
  name: String,
  email: String,
  amount: Number,
  message: String,
  isPrivate: Boolean,
  createdAt: { type: Date, default: Date.now }
});

const Donation = mongoose.model("Donation", donationSchema);

// API Routes
app.post("/api/donations", async (req, res) => {
  await connectDB();
  try {
    const { name, email, amount, message, isPrivate } = req.body;
    const donation = new Donation({ name, email, amount, message, isPrivate });
    await donation.save();
    res.status(201).json({ success: true, donation });
  } catch (error) {
    console.error("Error saving donation:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.get("/api/donations", async (req, res) => {
  await connectDB();
  try {
    const donations = await Donation.find().sort({ createdAt: -1 }).limit(10);
    res.json(donations);
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen if not running on Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
