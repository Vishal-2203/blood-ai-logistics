/**
 * Calculates a donor score based on ML-inspired logistical factors.
 * Weights:
 * - 40% Prediction (Likelihood of responding based on frequency/recency)
 * - 30% Historical Reliability
 * - 30% Distance Impact
 */

export function calculateScore(donor) {
  // Predictive Factor: Higher frequency + more time since last donation = higher probability
  const predictiveFactor = Math.min(1, (donor.donation_frequency * (donor.last_donation_days_ago / 365)));
  
  const distanceScore = 1 / (1 + (donor.distance || 0)); // Smoother decay

  const score =
    0.4 * predictiveFactor +
    0.3 * (donor.response_rate || 0.5) +
    0.3 * distanceScore;

  return {
    final: Number(score.toFixed(3)),
    prediction: Number(predictiveFactor.toFixed(2)) // Output the prediction for transparency
  };
}



/**
 * Ranks a list of donors based on calculated scores.
 * Handles urgency by adjusting weight priorities if needed.
 */
export function rankDonors(donors, urgency = "medium") {
  return donors
    .map(d => {
      const { final, prediction } = calculateScore(d);
      let finalScore = final;
      
      // AI Logic: High urgency priority (Massive distance boost)
      if (urgency === "high" && d.distance < 3) {
        finalScore += 0.4;
      }

      return {
        ...d,
        score: Number(Math.min(1, finalScore).toFixed(3)),
        confidence_level: prediction > 0.7 ? "High" : "Moderate"
      };
    })
    .sort((a, b) => b.score - a.score);
}


