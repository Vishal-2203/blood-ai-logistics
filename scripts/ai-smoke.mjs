import assert from "node:assert/strict";

import { runPrompt } from "../ai/ai.js";
import { calculateScore, rankDonors } from "../ai/ranking.js";
import { cleanUserInput, validateBloodGroup, validateDonorData } from "../ai/validator.js";

function withTempEnv(name, value, fn) {
  const prev = process.env[name];
  process.env[name] = value;

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = prev;
      }
    });
}

assert.equal(validateBloodGroup(" o- "), "O-");
assert.equal(validateBloodGroup("ZZ"), null);
assert.equal(cleanUserInput("  Need O- blood  "), "Need O- blood");

assert.throws(
  () => validateDonorData({ name: "Ravi" }),
  /missing distance, response_rate, donation_frequency, last_donation_days_ago/
);

{
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
}

{
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
}

await withTempEnv("GEMINI_API_KEY", "", async () => {
  const intent = await runPrompt(`intent-smoke-${Date.now()}`, {
    type: "intent",
    text: "Need AB- blood urgently near Pune"
  });

  assert.deepEqual(intent, {
    blood_group: "AB-",
    urgency: "high",
    location: "Pune"
  });
});

console.log("[ai-smoke] OK");
