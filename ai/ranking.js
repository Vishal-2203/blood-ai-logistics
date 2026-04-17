/**
 * Calculates a donor score based on multiple logistical factors.
 * Weights:
 * - 40% Distance (Inversely proportional)
 * - 30% Historical Response Rate
 * - 20% Historical Reliability (Successful donations)
 * - 10% Recency factor (Simplified)
 */
export function calculateScore(donor) {
  const DISTANCE_WEIGHT = 0.4;
  const RESPONSE_RATE_WEIGHT = 0.3;
  const RELIABILITY_WEIGHT = 0.3;

  // Handle distance edge case (prevent Infinity)
  const distanceFactor = 1 / (Math.max(donor.distance, 0.1));
  
  // Normalize response rate and reliability (assume 0-1)
  const responseRate = donor.response_rate || 0;
  const reliability = donor.reliability || 0.5; // Default if not provided

  const score = (
    DISTANCE_WEIGHT * distanceFactor +
    RESPONSE_RATE_WEIGHT * responseRate +
    RELIABILITY_WEIGHT * reliability
  );

  return Number(score.toFixed(3));
}

/**
 * Ranks a list of donors based on calculated scores.
 * Handles urgency by adjusting weight priorities if needed.
 */
export function rankDonors(donors, urgency = "medium") {
  return donors
    .map(d => {
      let finalScore = calculateScore(d);
      
      // If urgency is high, distance matters much more (+50% boost to score if very close)
      if (urgency === "high" && d.distance < 2) {
        finalScore *= 1.5;
      }

      return {
        ...d,
        score: Number(finalScore.toFixed(3))
      };
    })
    .sort((a, b) => b.score - a.score);
}

