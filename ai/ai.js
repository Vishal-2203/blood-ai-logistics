import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { cleanUserInput, validateBloodGroup } from "./validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

[path.join(__dirname, ".env"), path.join(__dirname, "..", ".env")].forEach((envFile) => {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
});

const aiCache = new Map();

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

function extractBloodGroup(text = "") {
  const match = cleanUserInput(String(text))
    .toUpperCase()
    .match(/(?:^|[^A-Z0-9])((?:AB|A|B|O)[+-])(?=$|[^A-Z0-9])/);
  return validateBloodGroup(match?.[1] || null);
}

function inferLocation(text = "") {
  const match = cleanUserInput(String(text)).match(/\b(?:at|near|in)\s+([A-Za-z][A-Za-z\s-]{2,40})/i);
  return match ? match[1].trim() : null;
}

function inferIntentFallback(data = {}) {
  const fallbackText = cleanUserInput(
    data.text ||
      `${data.urgency || "medium"} request for ${data.bloodGroup || ""} blood ${data.location ? `at ${data.location}` : ""}`
  );

  return {
    blood_group: validateBloodGroup(data.bloodGroup) || extractBloodGroup(fallbackText),
    urgency: normalizeUrgency(data.urgency || fallbackText),
    location: data.location || inferLocation(fallbackText)
  };
}

export async function runPrompt(prompt, fallbackData = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  const hash = crypto.createHash("md5").update(prompt).digest("hex");

  if (aiCache.has(hash)) {
    const cached = aiCache.get(hash);
    if (Date.now() - cached.timestamp < 1800000) {
      return cached.data;
    }
  }

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY missing");
    }

    const systemInstruction = "System: Specialized medical logistics AI. Always return structured JSON.\n\n";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstruction + prompt }] }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    if (response.status === 429) {
      if (fallbackData) {
        console.warn("WARNING: Rate limit reached. Utilizing rule-based fallback.");
        return generateFallback(fallbackData);
      }
      throw new Error("Rate limit exceeded and no fallback provided.");
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("AI response was empty.");
    }

    const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = cleaned;
    }

    aiCache.set(hash, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    if (fallbackData) {
      console.warn(`NOTICE: AI module issue (${err.message}). Reverting to fallback.`);
      return generateFallback(fallbackData);
    }

    throw err;
  }
}

function generateFallback(data) {
  if (data.type === "ranking" && data.donors && data.donors.length > 0) {
    const top = data.donors[0];
    return {
      selected_donor: top.name || "Available Donor",
      reason: `[Rule-Based Fallback] Selected based on highest score (${top.score || "N/A"}) and proximity (${top.distance || "N/A"}km).`
    };
  }

  if (data.type === "intent") {
    return inferIntentFallback(data);
  }

  if (data.type === "audit") {
    const intent = data.intent || {};
    const bloodGroup = validateBloodGroup(data.bloodGroup || intent.blood_group);
    const matchedCount = Math.max(0, Number(data.matchedCount || 0));
    const isRare = ["O-", "AB-"].includes(bloodGroup);
    const shortageDetected = matchedCount < 2;
    const alertStatus = shortageDetected ? "CRITICAL" : isRare ? "WARNING" : "NORMAL";

    return {
      is_rare: isRare,
      shortage_detected: shortageDetected,
      alert_status: alertStatus,
      public_message: shortageDetected
        ? `[Rule-Based Fallback] Only ${matchedCount} eligible donor${matchedCount === 1 ? "" : "s"} found for ${bloodGroup || "the requested blood group"}.`
        : `[Rule-Based Fallback] ${bloodGroup || "Requested blood group"} has stable donor coverage.`
    };
  }

  return { error: "AI Unavailable", status: "offline" };
}
