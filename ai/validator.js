/**
 * Validates and cleans data for the AI logistics module.
 */

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function validateBloodGroup(group) {
  if (!group) return null;
  const normalized = group.toUpperCase().trim();
  return VALID_BLOOD_GROUPS.includes(normalized) ? normalized : null;
}

export function validateDonorData(donor) {
  const required = ["name", "distance", "response_rate", "donation_frequency", "last_donation_days_ago"];
  const missing = required.filter(field => donor[field] === undefined || donor[field] === null);
  
  if (missing.length > 0) {
    throw new Error(`Invalid donor data: missing ${missing.join(", ")}`);
  }

  return {
    ...donor,
    distance: Math.max(0, Number(donor.distance)),
    response_rate: Math.min(1, Math.max(0, Number(donor.response_rate))),
    reliability: Math.min(1, Math.max(0, Number(donor.reliability || 0.5))),
    donation_frequency: Math.max(0, Number(donor.donation_frequency)),
    last_donation_days_ago: Math.max(0, Number(donor.last_donation_days_ago))
  };
}


export function cleanUserInput(text) {
  return text.trim().substring(0, 500); // Prevent injection/overload
}
