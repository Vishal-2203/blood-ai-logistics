import { runPrompt } from "./ai.js";
import { intentPrompt, rankingPrompt, shortagePrompt } from "./prompts.js";
import { rankDonors } from "./ranking.js";

const test = async () => {
  console.log("SYSTEM START: BLOOD LOGISTICS SERVICE");

  try {
    // 1. Intent Extraction
    const input = "Need O- blood urgently near Mumbai";
    console.log(`User Input: "${input}"`);
    
    const intent = await runPrompt(intentPrompt(input), { type: "intent" });
    console.log("Extracted Intent:", intent);

    // 2. Mock donors with predictive factors
    const donors = [
      { 
        name: "Rahul", 
        distance: 5.2, 
        response_rate: 0.9, 
        reliability: 0.8,
        donation_frequency: 3,
        last_donation_days_ago: 120
      },
      { 
        name: "Amit", 
        distance: 1.5, 
        response_rate: 0.5, 
        reliability: 0.9,
        donation_frequency: 1, 
        last_donation_days_ago: 300
      },
      { 
        name: "Neha", 
        distance: 7.0, 
        response_rate: 0.85, 
        reliability: 0.95,
        donation_frequency: 4, 
        last_donation_days_ago: 10
      }
    ];

    // 3. Status Audit
    console.log("Running System Audit...");
    const audit = await runPrompt(shortagePrompt(intent, donors.length), { type: "audit" });
    console.log("Audit Report:", audit);

    // 4. Ranking (logic)
    const ranked = rankDonors(donors, intent.urgency);

    console.log("Ranked Donors:");
    console.table(ranked.map(d => ({
      name: d.name,
      score: d.score,
      confidence: d.confidence_level
    })));

    // 5. AI reasoning for selection (with safe fallback)
    console.log("Requesting AI Decision Justification...");
    const decision = await runPrompt(rankingPrompt(ranked), { 
      type: "ranking", 
      donors: ranked 
    });

    console.log("AI Final Recommendation:");
    console.log(JSON.stringify(decision, null, 2));

  } catch (err) {
    console.error("Critical Test Failure:", err.message);
  }
};

test();
