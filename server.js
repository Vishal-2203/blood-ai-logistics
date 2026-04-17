import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
console.log("ENV KEY:", process.env.GEMINI_API_KEY);
import express from "express";
import cors from "cors";

import { runPrompt } from "./ai/ai.js";
import { intentPrompt, rankingPrompt, shortagePrompt } from "./ai/prompts.js";
import { rankDonors } from "./ai/ranking.js";

import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Dummy donors
// Enhanced Dummy Donors with Historical Data for ML/AI Scope
const donors = [
  { 
    name: "Ravi", blood_group: "O-", lat: 17.385, lng: 78.486, 
    last_donation_days_ago: 120, donation_frequency: 3, 
    response_rate: 0.95 
  },
  { 
    name: "Anjali", blood_group: "O-", lat: 17.39, lng: 78.48, 
    last_donation_days_ago: 45, donation_frequency: 1, 
    response_rate: 0.6 
  },
  { 
    name: "Meena", blood_group: "O-", lat: 17.382, lng: 78.482, 
    last_donation_days_ago: 200, donation_frequency: 5, 
    response_rate: 0.9 
  },
  { 
    name: "Divya", blood_group: "O-", lat: 17.388, lng: 78.478, 
    last_donation_days_ago: 10, donation_frequency: 2, 
    response_rate: 0.75 
  },
  { 
    name: "Pooja", blood_group: "O-", lat: 17.383, lng: 78.484, 
    last_donation_days_ago: 300, donation_frequency: 1, 
    response_rate: 0.85 
  }
];

// Distance
function getDistance(lat1, lon1, lat2, lon2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2);
}

// Socket.io handlers
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  
  socket.on("join_tracking", (requestId) => {
    socket.join(requestId);
    console.log(`Socket ${socket.id} joined tracking for ${requestId}`);
  });

  socket.on("emergency_request_raised", (data) => {
    console.log("Emergency Broadcast:", data);
    socket.broadcast.emit("new_emergency_alert", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// 🔥 AI-powered route
app.post("/request-blood", async (req, res) => {
  try {
    console.log("🚨 Request received:", req.body);

    // 1. AI Intent Extraction (with fallback)
    const intent = await runPrompt(intentPrompt(req.body.text), { type: "intent" });
    
    // 2. Filter donors (Basic Eligibility: At least 90 days since last donation)
    const matched = donors.filter(
      (d) => d.blood_group === intent.blood_group && d.last_donation_days_ago >= 90
    );

    // 3. Add distance (Mapping to rankDonors format)
    const enriched = matched.map((d) => ({
      ...d,
      distance: getDistance(req.body.lat, req.body.lng, d.lat, d.lng)
    }));


    // 4. Rank
    const ranked = rankDonors(enriched, intent.urgency);

    // 5. System Health Check (with fallback)
    const systemHealth = await runPrompt(shortagePrompt(intent, matched.length), { type: "audit" });

    // 6. AI decision/Justification (with fallback)
    const decision = await runPrompt(rankingPrompt(ranked), { 
      type: "ranking", 
      donors: ranked 
    });
      
    // Added: Emit event when request is processed
    io.emit("emergency_request_raised", { type: "AI_PROCESSED", data: req.body });

    res.json({
      intent,
      system_health: systemHealth,
      top_3_donors: ranked.slice(0, 3),
      decision
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Health
app.get("/health", (req, res) => {
  res.json({ status: "AI system active", sockets: io.engine.clientsCount });
});

httpServer.listen(3000, () => {
  console.log("SYSTEM START: ENTERPRISE AI BACKEND ON PORT 3000");
});
