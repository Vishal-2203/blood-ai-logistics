import test from "node:test";
import assert from "node:assert/strict";

import { runPrompt } from "../ai.js";
import { calculateScore, rankDonors } from "../ranking.js";
import { cleanUserInput, validateBloodGroup, validateDonorData } from "../validator.js";

test("validateBloodGroup and cleanUserInput normalize request input", () => {
  assert.equal(validateBloodGroup(" o- "), "O-");
  assert.equal(validateBloodGroup("ZZ"), null);
  assert.equal(cleanUserInput("  Need O- blood  "), "Need O- blood");
});

test("validateDonorData enforces required fields and clamps values", () => {
  assert.throws(
    () => validateDonorData({ name: "Ravi" }),
    /missing distance, response_rate, donation_frequency, last_donation_days_ago/
  );

  const donor = validateDonorData({
    name: "Ravi",
    distance: -4,
    response_rate: 2,
    reliability: -1,
    donation_frequency: 3,
    last_donation_days_ago: 120
  });

  assert.equal(donor.distance, 0);
  assert.equal(donor.response_rate, 1);
  assert.equal(donor.reliability, 0);
});

test("rankDonors prioritizes the best nearby donor for urgent requests", () => {
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
    }
  ];

  const rahulScore = calculateScore(donors[0]);
  assert.equal(rahulScore.final, 0.713);
  assert.equal(rahulScore.prediction, 0.99);

  const ranked = rankDonors(donors, "high");
  assert.equal(ranked[0].name, "Amit");
  assert.equal(ranked[0].score, 0.999);
  assert.equal(ranked[0].confidence_level, "High");
});

test("runPrompt falls back to deterministic intent parsing when the AI key is unavailable", async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";

  try {
    const intent = await runPrompt(`intent-smoke-${Date.now()}`, {
      type: "intent",
      text: "Need AB- blood urgently near Pune"
    });

    assert.deepEqual(intent, {
      blood_group: "AB-",
      urgency: "high",
      location: "Pune"
    });
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
  }
});
