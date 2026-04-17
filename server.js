const express = require("express");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Dummy Donor Data (10 entries)
const donors = [
  {
    name: "Ravi",
    blood_group: "O-",
    lat: 17.385,
    lng: 78.486,
    availability: true,
    response_rate: 0.8,
  },
  {
    name: "Anjali",
    blood_group: "O-",
    lat: 17.39,
    lng: 78.48,
    availability: true,
    response_rate: 0.6,
  },
  {
    name: "Kiran",
    blood_group: "A+",
    lat: 17.4,
    lng: 78.49,
    availability: true,
    response_rate: 0.7,
  },
  {
    name: "Suresh",
    blood_group: "B+",
    lat: 17.37,
    lng: 78.47,
    availability: true,
    response_rate: 0.5,
  },
  {
    name: "Meena",
    blood_group: "O-",
    lat: 17.382,
    lng: 78.482,
    availability: true,
    response_rate: 0.9,
  },
  {
    name: "Rahul",
    blood_group: "AB+",
    lat: 17.395,
    lng: 78.495,
    availability: false,
    response_rate: 0.4,
  },
  {
    name: "Divya",
    blood_group: "O-",
    lat: 17.388,
    lng: 78.478,
    availability: true,
    response_rate: 0.75,
  },
  {
    name: "Arjun",
    blood_group: "A+",
    lat: 17.41,
    lng: 78.5,
    availability: true,
    response_rate: 0.65,
  },
  {
    name: "Pooja",
    blood_group: "O-",
    lat: 17.383,
    lng: 78.484,
    availability: true,
    response_rate: 0.85,
  },
  {
    name: "Vikram",
    blood_group: "B-",
    lat: 17.36,
    lng: 78.46,
    availability: true,
    response_rate: 0.55,
  },
];

// Distance function
function getDistance(lat1, lon1, lat2, lon2) {
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
}

// POST API → Emergency Request (UPDATED 🔥)
app.post("/request-blood", (req, res) => {
  const { blood_group, lat, lng, urgency } = req.body;

  console.log("🚨 Emergency Request:", req.body);

  const matchedDonors = donors
    .map((donor) => {
      const distance = getDistance(lat, lng, donor.lat, donor.lng);

      if (
        donor.blood_group === blood_group &&
        donor.availability === true &&
        distance < 0.05
      ) {
        const score =
          donor.response_rate * 50 +
          (1 - distance) * 30 +
          (urgency === "high" ? 20 : 10);

        // 🔥 Priority logic
        let priority = "Medium";
        if (score > 85) priority = "High";
        else if (score < 60) priority = "Low";

        return {
          name: donor.name,
          distance: Number(distance.toFixed(3)),
          score: Math.round(score),
          eta: (distance * 100).toFixed(1) + " mins",
          priority,
        };
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  console.log("📢 Alerts sent to donors...");
  console.log("🏥 Hospitals notified...");

  res.json({
    message: "Emergency request processed",
    urgency,
    donors_found: matchedDonors.length,

    // 🔥 Top 3 donors only
    top_3_donors: matchedDonors.slice(0, 3),

    // 🔥 Decision explanation
    decision:
      "Top donors selected based on proximity, availability, and response history",
  });
});

// Optional: Health API
app.get("/health", (req, res) => {
  res.json({
    status: "System Active",
    services: ["Matching", "Prediction", "Alerts"],
  });
});

// Root route
app.get("/", (req, res) => {
  res.send("Blood Logistics Backend Running 🚀");
});

// Start server
app.listen(3000, () => {
  console.log("Server running on port 3000 🚀");
});
