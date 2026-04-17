/**
 * Prompt for explaining the ranking decision.
 */
export const rankingPrompt = (donors) => `
You are a Blood Logistics Coordinator AI. Your job is to justify why the top-ranked donor was chosen.

Donors (Ranked):
${JSON.stringify(donors, null, 2)}

Instructions:
- Reference the "score" and "distance" in your reasoning.
- Be concise and professional.
- Return ONLY a JSON object.

Example Output:
{
  "selected_donor": "Jane Doe",
  "reason": "Top Choice: Jane has the highest reliability score (0.95) and is only 2km away, ensuring fastest delivery."
}

Result:`;

/**
 * Prompt for extracting intent from user messages.
 */
export const intentPrompt = (input) => `
System: Emergency Blood Logistics Intent Extractor
Task: Parse user input for blood requests.

Strict Rules:
1. blood_group: A+, A-, B+, B-, AB+, AB-, O+, O-. If not found, null.
2. urgency: "high", "medium", "low". Default to "medium".
3. location: Extract city or area. Default null.

Examples:
- "Need O+ blood urgently at City Hospital" -> {"blood_group": "O+", "urgency": "high", "location": "City Hospital"}
- "Anyone for B- donor near Bandra?" -> {"blood_group": "B-", "urgency": "medium", "location": "Bandra"}

Current User Input:
"${input}"

Output JSON:`;


/**
 * Prompt for detecting system shortages and rarity.
 */
export const shortagePrompt = (intent, matchedCount) => `
You are a Medical Resource Auditor. 
Analyze the current blood request and the available donor pool.

Request: ${intent.blood_group} (Urgency: ${intent.urgency})
Available Donors: ${matchedCount}

Tasks:
1. Is this a rare blood group (O- or AB-)?
2. If donors are < 2, is this a critical shortage?
3. Provide a system-level alert status: "NORMAL", "WARNING", or "CRITICAL".

Output JSON:
{
  "is_rare": boolean,
  "shortage_detected": boolean,
  "alert_status": string,
  "public_message": "Friendly but urgent message for the UI"
}

Result:`;
