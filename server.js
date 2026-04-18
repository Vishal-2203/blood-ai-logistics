import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { runPrompt } from "./ai/ai.js";
import { intentPrompt, rankingPrompt, shortagePrompt } from "./ai/prompts.js";
import { rankDonors } from "./ai/ranking.js";
import { cleanUserInput, validateBloodGroup } from "./ai/validator.js";
import { createDataStore } from "./lib/data-store.js";
import { getBearerToken, issueAuthToken, verifyAuthToken, verifyPassword } from "./lib/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

[path.join(__dirname, ".env"), path.join(__dirname, "ai", ".env")].forEach((envFile) => {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
});

const PORT = Number(process.env.PORT) || 4000;
const dataDirectory = process.env.DATA_DIR
  ? path.resolve(__dirname, process.env.DATA_DIR)
  : path.join(__dirname, "data");
const frontendBuildPath = path.join(__dirname, "frontend", "build");
const hasFrontendBuild = fs.existsSync(path.join(frontendBuildPath, "index.html"));
const store = createDataStore(path.join(dataDirectory, "blood-agent.sqlite"));
const movementTimers = new Map();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"]
  }
});

app.use(cors());
app.use(express.json());

if (hasFrontendBuild) {
  app.use(express.static(frontendBuildPath));
}

function normalizeUrgency(value = "medium") {
  const normalized = String(value).toLowerCase();

  if (normalized.includes("critical") || normalized.includes("urgent") || normalized.includes("high")) {
    return "high";
  }

  if (normalized.includes("low")) {
    return "low";
  }

  return "medium";
}

function formatUrgencyLabel(value = "medium") {
  const normalized = normalizeUrgency(value);
  if (normalized === "high") {
    return "Critical";
  }

  if (normalized === "low") {
    return "Low";
  }

  return "Normal";
}

function getDistance(lat1, lon1, lat2, lon2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2);
}

function sanitizeName(value, fallback) {
  const cleaned = String(value || "").trim();
  return cleaned || fallback;
}

function parseRequestBody(body = {}) {
  const bloodGroup = validateBloodGroup(body.bloodGroup || body.blood);
  const patient = sanitizeName(body.patient, "Anonymous Patient");
  const location = sanitizeName(body.location, "AIIMS Emergency Wing");
  const units = Math.max(1, Number(body.units) || 1);
  const normalizedUrgency = normalizeUrgency(body.urgency);

  return {
    patient,
    bloodGroup,
    urgency: formatUrgencyLabel(body.urgency || normalizedUrgency),
    urgencyLevel: normalizedUrgency,
    units,
    location,
    lat: Number(body.lat ?? 28.567),
    lng: Number(body.lng ?? 77.21),
    text: cleanUserInput(
      body.text ||
        `${body.urgency || normalizedUrgency} request for ${units} unit${units > 1 ? "s" : ""} of ${bloodGroup || "blood"} for ${patient} at ${location}`
    )
  };
}

function buildInsights(activeRequest, stock = store.listStock()) {
  const normalizedRequest = activeRequest || {};
  const aiData = normalizedRequest.ai_data || {};
  const shortage = stock
    .filter((item) => Number(item.units) < Number(item.min))
    .sort((left, right) => (left.units / left.min) - (right.units / right.min))[0];
  const requestBlood = validateBloodGroup(normalizedRequest.blood || normalizedRequest.bloodGroup);
  const localMatches = requestBlood
    ? store
        .listDonors()
        .filter((donor) => donor.blood === requestBlood && donor.last_donation_days_ago >= 90)
        .map((donor) => ({
          ...donor,
          distance: getDistance(
            Number(normalizedRequest.lat ?? 28.567),
            Number(normalizedRequest.lng ?? 77.21),
            donor.lat,
            donor.lng
          )
        }))
    : [];
  const rankedFallback = localMatches.length > 0 ? rankDonors(localMatches, normalizeUrgency(normalizedRequest.urgency)) : [];
  const topDonor = aiData.top_3_donors?.[0] || rankedFallback[0];
  const alertStatus = aiData.system_health?.alert_status || (shortage ? "WARNING" : "NORMAL");

  return [
    {
      type: shortage ? "warning" : "success",
      icon: "drop",
      title: shortage ? "Critical Stock Alert" : "Stock Stable",
      description: shortage
        ? `${shortage.type} is at ${shortage.units}/${shortage.min} units and needs replenishment.`
        : "All tracked blood groups are above their minimum thresholds.",
      priority: shortage ? "high" : "low"
    },
    {
      type: topDonor ? "info" : "insight",
      icon: topDonor ? "navigation" : "clock",
      title: topDonor ? "Top Donor Match" : "Awaiting Match Data",
      description: topDonor
        ? `${topDonor.name} leads the match list with score ${topDonor.score} at approximately ${Number(topDonor.distance || 0).toFixed(2)} km.`
        : "No ranked donors are available yet for the current request.",
      priority: topDonor ? "medium" : "low"
    },
    {
      type: alertStatus === "CRITICAL" ? "warning" : "success",
      icon: alertStatus === "CRITICAL" ? "alert" : "check",
      title: "System Health",
      description: aiData.system_health?.public_message || `Current alert status: ${alertStatus}.`,
      priority: alertStatus === "CRITICAL" ? "high" : "low"
    },
    {
      type: "insight",
      icon: "clock",
      title: "Decision Summary",
      description:
        aiData.decision?.reason ||
        `Tracking ${normalizedRequest.patient || "the active request"} while donor and inventory signals update.`,
      priority: "medium"
    }
  ];
}

function createSessionPayload(user) {
  const sessionState = store.getBootstrapState(user);
  return {
    token: issueAuthToken(user),
    ...sessionState
  };
}

function getRequestRoom(requestId) {
  return `tracking:${requestId}`;
}

function emitRequestCreated(request) {
  io.emit("request_created", request);
}

function emitRequestUpdated(request) {
  io.emit("request_updated", request);
  io.to(getRequestRoom(request.id)).emit("request_updated", request);
}

function emitStockUpdated(stockItem) {
  io.emit("stock_updated", stockItem);
}

function emitDonorLocationUpdate(payload) {
  io.emit("donor_location_update", payload);
  io.to(getRequestRoom(payload.requestId)).emit("donor_location_update", payload);
}

function clearMovementTimer(requestId) {
  const timer = movementTimers.get(requestId);
  if (timer) {
    clearInterval(timer);
    movementTimers.delete(requestId);
  }
}

function simulateDonorMovement(request, donor) {
  clearMovementTimer(request.id);

  let currentStep = 0;
  const totalSteps = 4;
  const originLat = donor.lat;
  const originLng = donor.lng;

  const timer = setInterval(() => {
    currentStep += 1;

    const progress = currentStep / totalSteps;
    const eta = Math.max(2, Math.round((donor.eta || 10) * (1 - progress)));
    const nextDonor = store.saveDonor({
      ...donor,
      lat: Number((originLat + (request.lat - originLat) * progress).toFixed(6)),
      lng: Number((originLng + (request.lng - originLng) * progress).toFixed(6)),
      eta,
      status: currentStep >= totalSteps ? "Arrived" : "En Route",
      updatedAt: new Date().toISOString()
    });

    emitDonorLocationUpdate({
      requestId: request.id,
      donor: nextDonor
    });

    if (currentStep >= totalSteps) {
      clearMovementTimer(request.id);
    }
  }, 4000);

  movementTimers.set(request.id, timer);
}

async function verifyLiveGeminiPath() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const result = await runPrompt(
    `Return ONLY valid JSON for a production health check: {"provider":"gemini","status":"ok","checkedAt":"${new Date().toISOString()}"}.`
  );

  return {
    verified: true,
    result
  };
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req.headers.authorization || "");
  const payload = verifyAuthToken(token);

  if (!payload?.sub) {
    return res.status(401).json({ error: "Authentication is required." });
  }

  const user = store.getUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: "Your session is no longer valid." });
  }

  req.authToken = token;
  req.user = user;
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }

    return next();
  };
}

io.use((socket, next) => {
  const payload = verifyAuthToken(socket.handshake.auth?.token);
  if (!payload?.sub) {
    next(new Error("Unauthorized"));
    return;
  }

  const user = store.getUserById(payload.sub);
  if (!user) {
    next(new Error("Unauthorized"));
    return;
  }

  socket.user = user;
  next();
});

io.on("connection", (socket) => {
  socket.join(`role:${socket.user.role}`);
  socket.emit("socket_ready", { user: socket.user });

  socket.on("join_tracking", (requestId) => {
    if (requestId) {
      socket.join(getRequestRoom(requestId));
    }
  });

  socket.on("disconnect", () => {
    // No-op: connection status is reflected on the client.
  });
});

app.post("/register", (req, res) => {
  try {
    const role = String(req.body?.role || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const name = sanitizeName(req.body?.name, email.split("@")[0] || role);
    const bloodGroup = validateBloodGroup(req.body?.bloodGroup);

    if (!["hospital", "donor", "requestor"].includes(role)) {
      return res.status(400).json({ error: "Please choose a valid role." });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Passwords must be at least 8 characters long." });
    }

    if (role === "donor" && !bloodGroup) {
      return res.status(400).json({ error: "Donor accounts require a valid blood group." });
    }

    if (store.getUserByEmail(email)) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const user = store.createUser({
      email,
      password,
      role,
      name,
      bloodGroup
    });

    return res.status(201).json(createSessionPayload(user));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/login", (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const requestedRole = String(req.body?.role || "").trim();
    const password = String(req.body?.password || "");
    const userRecord = store.getUserByEmail(email);

    if (!userRecord || !verifyPassword(password, userRecord.password_salt, userRecord.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (requestedRole && requestedRole !== userRecord.role) {
      return res.status(403).json({ error: `This account is registered as ${userRecord.role}.` });
    }

    const user = store.getUserById(userRecord.id);
    return res.json(createSessionPayload(user));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/session/bootstrap", requireAuth, (req, res) => {
  res.json(store.getBootstrapState(req.user));
});

app.post("/ai-insights", requireAuth, (req, res) => {
  const activeRequest = req.body?.activeRequest || null;
  const stock = Array.isArray(req.body?.stock) ? req.body.stock : store.listStock();

  res.json({ insights: buildInsights(activeRequest, stock) });
});

app.post("/ai/verify-live", requireAuth, requireRole("hospital", "requestor"), async (req, res) => {
  try {
    const verification = await verifyLiveGeminiPath();
    res.json({
      ...verification,
      configured: true
    });
  } catch (err) {
    res.status(503).json({
      configured: Boolean(process.env.GEMINI_API_KEY),
      verified: false,
      error: err.message
    });
  }
});

app.post("/request-blood", requireAuth, requireRole("hospital", "requestor"), async (req, res) => {
  try {
    const requestDraft = parseRequestBody(req.body);

    const intent = await runPrompt(intentPrompt(requestDraft.text), {
      type: "intent",
      text: requestDraft.text,
      bloodGroup: requestDraft.bloodGroup,
      urgency: requestDraft.urgencyLevel,
      location: requestDraft.location
    });

    const resolvedIntent = {
      blood_group: validateBloodGroup(intent?.blood_group) || requestDraft.bloodGroup,
      urgency: normalizeUrgency(intent?.urgency || requestDraft.urgencyLevel),
      location: intent?.location || requestDraft.location
    };

    if (!resolvedIntent.blood_group) {
      return res.status(400).json({ error: "Unable to determine a valid blood group for the request." });
    }

    const matched = store
      .listDonors()
      .filter((donor) => donor.blood === resolvedIntent.blood_group && donor.last_donation_days_ago >= 90);

    const enriched = matched.map((donor) => ({
      ...donor,
      distance: getDistance(requestDraft.lat, requestDraft.lng, donor.lat, donor.lng)
    }));

    const ranked = rankDonors(enriched, resolvedIntent.urgency);

    const systemHealth = await runPrompt(shortagePrompt(resolvedIntent, matched.length), {
      type: "audit",
      intent: resolvedIntent,
      matchedCount: matched.length,
      bloodGroup: resolvedIntent.blood_group
    });

    const decision = await runPrompt(rankingPrompt(ranked), {
      type: "ranking",
      donors: ranked
    });

    const requestRecord = store.createRequest({
      id: `REQ-${Date.now().toString().slice(-6)}`,
      patient: requestDraft.patient,
      blood: resolvedIntent.blood_group,
      units: requestDraft.units,
      fulfilled: 0,
      urgency: formatUrgencyLabel(requestDraft.urgency),
      status: ranked.length > 0 ? "Matching" : "Broadcasting",
      donorStatus: "pending",
      location: resolvedIntent.location || requestDraft.location,
      lat: requestDraft.lat,
      lng: requestDraft.lng,
      ai_data: {
        intent: resolvedIntent,
        system_health: systemHealth,
        top_3_donors: ranked.slice(0, 3),
        decision
      },
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    emitRequestCreated(requestRecord);

    res.status(201).json({
      intent: resolvedIntent,
      request: requestRecord,
      system_health: systemHealth,
      top_3_donors: ranked.slice(0, 3),
      decision
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/requests/:id/advance", requireAuth, requireRole("hospital", "requestor"), (req, res) => {
  const request = store.getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  if (request.status === "Fulfilled") {
    return res.json({ request });
  }

  const nextFulfilled = Math.min(request.units, request.fulfilled + 1);
  const updatedRequest = store.saveRequest({
    ...request,
    fulfilled: nextFulfilled,
    status: nextFulfilled >= request.units ? "Fulfilled" : "In Transit",
    donorStatus: nextFulfilled >= request.units ? "accepted" : request.donorStatus,
    updatedAt: new Date().toISOString()
  });

  if (updatedRequest.status === "Fulfilled") {
    clearMovementTimer(updatedRequest.id);
  }

  emitRequestUpdated(updatedRequest);
  return res.json({ request: updatedRequest });
});

app.patch("/requests/:id/location", requireAuth, requireRole("hospital", "requestor"), (req, res) => {
  const request = store.getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const location = sanitizeName(req.body?.location, request.location || "Pinned Location");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Please provide valid numeric lat/lng values." });
  }

  const updatedRequest = store.saveRequest({
    ...request,
    lat,
    lng,
    location,
    updatedAt: new Date().toISOString()
  });

  emitRequestUpdated(updatedRequest);
  return res.json({ request: updatedRequest });
});

app.patch("/requests/:id/resolve", requireAuth, requireRole("hospital", "requestor"), (req, res) => {
  const request = store.getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  const updatedRequest = store.saveRequest({
    ...request,
    fulfilled: request.units,
    status: "Fulfilled",
    donorStatus: "accepted",
    updatedAt: new Date().toISOString()
  });

  clearMovementTimer(updatedRequest.id);
  emitRequestUpdated(updatedRequest);
  return res.json({ request: updatedRequest });
});

app.patch("/requests/:id/respond", requireAuth, requireRole("donor"), (req, res) => {
  const decision = String(req.body?.decision || "").trim().toLowerCase();
  const request = store.getRequestById(req.params.id);
  const donor = store.getDonorByUserId(req.user.id);

  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  if (!donor) {
    return res.status(404).json({ error: "No donor profile is linked to this account yet." });
  }

  if (decision === "accept" && donor.blood !== request.blood) {
    return res.status(403).json({ error: `This request needs ${request.blood}, but your donor profile is ${donor.blood}.` });
  }

  if (decision === "accept") {
    const nextFulfilled = Math.min(request.units, request.fulfilled + 1);
    const updatedRequest = store.saveRequest({
      ...request,
      fulfilled: nextFulfilled,
      status: nextFulfilled >= request.units ? "Fulfilled" : "In Transit",
      donorStatus: "accepted",
      updatedAt: new Date().toISOString()
    });
    const updatedStock = store.incrementStock(request.blood, 1);
    const updatedDonor = store.saveDonor({
      ...donor,
      status: updatedRequest.status === "Fulfilled" ? "Completed" : "En Route",
      eta: Math.max(4, donor.eta - 2),
      updatedAt: new Date().toISOString()
    });

    emitRequestUpdated(updatedRequest);
    emitStockUpdated(updatedStock);
    emitDonorLocationUpdate({
      requestId: updatedRequest.id,
      donor: updatedDonor
    });

    if (updatedRequest.status !== "Fulfilled") {
      simulateDonorMovement(updatedRequest, updatedDonor);
    } else {
      clearMovementTimer(updatedRequest.id);
    }

    return res.json({
      request: updatedRequest,
      stock: updatedStock,
      donor: updatedDonor
    });
  }

  const updatedRequest = store.saveRequest({
    ...request,
    donorStatus: "declined",
    status: request.fulfilled > 0 ? "In Transit" : "Matching",
    updatedAt: new Date().toISOString()
  });
  const updatedDonor = store.saveDonor({
    ...donor,
    status: "Unavailable",
    updatedAt: new Date().toISOString()
  });

  emitRequestUpdated(updatedRequest);
  emitDonorLocationUpdate({
    requestId: updatedRequest.id,
    donor: updatedDonor
  });

  return res.json({
    request: updatedRequest,
    donor: updatedDonor
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "AI system active",
    sockets: io.engine.clientsCount,
    persistence: "sqlite",
    liveAiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

if (hasFrontendBuild) {
  app.use((req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    if (
      req.path.startsWith("/health") ||
      req.path.startsWith("/login") ||
      req.path.startsWith("/register") ||
      req.path.startsWith("/session") ||
      req.path.startsWith("/ai") ||
      req.path.startsWith("/request-blood") ||
      req.path.startsWith("/requests") ||
      req.path.startsWith("/socket.io")
    ) {
      return next();
    }

    return res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
}

httpServer.listen(PORT, () => {
  console.log(`SYSTEM START: ENTERPRISE AI BACKEND ON PORT ${PORT}`);
});
