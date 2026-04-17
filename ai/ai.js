import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// In-memory cache to save API quota
const aiCache = new Map();

/**
 * Executes a prompt using Google Gemini (Flash).
 * Includes:
 * 1. Smart Caching (TTL 30 mins)
 * 2. Automatic Retries (429 handling)
 * 3. Safe Fallback Mode
 */
export async function runPrompt(prompt, fallbackData = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Create a hash of the prompt for caching
  const hash = crypto.createHash("md5").update(prompt).digest("hex");
  if (aiCache.has(hash)) {
    const cached = aiCache.get(hash);
    if (Date.now() - cached.timestamp < 1800000) { // 30 mins
      return cached.data;
    }
  }

  try {
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");

    const systemInstruction = "System: Specialized medical logistics AI. Always return structured JSON.\n\n";
    
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstruction + prompt }] }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    // Handle Rate Limits (429)
    if (response.status === 429) {
      if (fallbackData) {
        console.warn("WARNING: Rate limit reached. Utilizing rule-based fallback.");
        return generateFallback(fallbackData);
      }
      throw new Error("Rate limit exceeded and no fallback provided.");
    }

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (e) {
      result = cleaned;
    }

    // Save to cache
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


/**
 * Generates a rule-based response when the AI is unavailable.
 */
function generateFallback(data) {
  if (data.type === "ranking" && data.donors && data.donors.length > 0) {
    const top = data.donors[0];
    return {
      selected_donor: top.name || "Available Donor",
      reason: `[Rule-Based Fallback] Selected based on highest score (${top.score || 'N/A'}) and proximity (${top.distance || 'N/A'}km).`
    };
  }
  
  if (data.type === "intent") {
    return { blood_group: "Unknown", urgency: "medium", location: "Unknown" };
  }

  if (data.type === "audit") {
    return { 
      is_rare: false, 
      shortage_detected: false, 
      alert_status: "NORMAL", 
      public_message: "[Rule-Based Fallback] System status is being monitored." 
    };
  }

  return { error: "AI Unavailable", status: "offline" };
}




