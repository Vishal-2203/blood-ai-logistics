import { runPrompt } from "../ai/ai.js";

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required to verify the live Gemini path.");
  process.exit(1);
}

try {
  const result = await runPrompt(
    `Return ONLY valid JSON for a production health check: {"provider":"gemini","status":"ok","checkedAt":"${new Date().toISOString()}"}.`
  );

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
