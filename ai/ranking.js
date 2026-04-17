/**
 * Calculates a donor score based on multiple logistical factors.
 * Weights:
 * - 50% Historical Response Rate
 * - 30% Historical Reliability (Success rate)
 * - 20% Distance (Using smoother decay: 1/(1+d))
 */

export function calculateScore(donor) {
  const distanceScore = 1 / (1 + (donor.distance || 0)); // smoother decay

  const score =
    0.5 * (donor.response_rate || 0) +
    0.3 * (donor.reliability || 0.5) +
    0.2 * distanceScore;

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

