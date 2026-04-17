import { runPrompt } from "./gemini.js";
import { intentPrompt, rankingPrompt } from "./prompts.js";
import { rankDonors } from "./ranking.js";

const test = async () => {
  console.log("🚀 SYSTEM START - AI BLOOD LOGISTICS");

  try {
    // 1. Intent Extraction
    const input = "Need O- blood urgently near Andheri";
    console.log(`\n💬 User: "${input}"`);
    
    const intent = await runPrompt(intentPrompt(input));
    console.log("🧠 Extracted Intent:", intent);

    // 2. Mock donors with new reliability factors
    const donors = [
      { name: "Rahul", distance: 5.2, response_rate: 0.9, reliability: 0.8 },
      { name: "Amit", distance: 1.5, response_rate: 0.5, reliability: 0.9 }, // Close but lower response rate
      { name: "Neha", distance: 7.0, response_rate: 0.85, reliability: 0.95 }
    ];

    // 3. Ranking (logic) - Pass urgency high
    const ranked = rankDonors(donors, intent.urgency);

    console.log("\n📊 Ranked Donors (Algorithmic):");
    console.table(ranked);

    // 4. AI reasoning for selection
    console.log("\n🤖 Requesting AI Decision Justification...");
    const decision = await runPrompt(rankingPrompt(ranked));

    console.log("\n✅ AI Final Recommendation:");
    console.log(JSON.stringify(decision, null, 2));

  } catch (err) {
    console.error("\n💥 Test failed:", err.message);
  }
};

test();

