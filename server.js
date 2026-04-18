const express = require("express");
const cors = require("cors");
const donors = require("./donors.json");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

console.log("📦 Backend loading...");

// -------------------------------
// HOME ROUTE
// -------------------------------
app.get("/", (req, res) => {
  res.send("🚑 Blood Logistics Backend is Running");
});

// -------------------------------
// GET ALL DONORS
// -------------------------------
app.get("/api/donors", (req, res) => {
  res.json({
    total: donors.length,
    donors,
  });
});

// -------------------------------
// GET DONOR BY ID
// -------------------------------
app.get("/api/donors/:id", (req, res) => {
  const donor = donors.find((d) => d.id == req.params.id);

  if (!donor) {
    return res.status(404).json({ message: "Donor not found" });
  }

  res.json(donor);
});

// -------------------------------
// MATCH DONORS (CORE FEATURE)
// -------------------------------
app.post("/api/match/donors", (req, res) => {
  const { bloodGroup, lat, lng } = req.body;

  if (!bloodGroup || !lat || !lng) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // distance formula (Haversine simplified)
  function distance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const matches = donors
    .filter((d) => d.bloodGroup === bloodGroup && d.available === true)
    .map((d) => {
      const dist = distance(lat, lng, d.location.lat, d.location.lng);
      return { ...d, distance: dist.toFixed(2) };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  res.json({
    count: matches.length,
    matches,
  });
});

// -------------------------------
// BASIC DONOR RESPONSE PREDICTION
// -------------------------------
app.post("/api/predict", (req, res) => {
  const { donorId, distance } = req.body;

  const donor = donors.find((d) => d.id == donorId);

  if (!donor) {
    return res.status(404).json({ message: "Donor not found" });
  }

  // simple scoring model
  let score = 100;

  if (distance > 10) score -= 30;
  if (!donor.available) score -= 50;

  const lastDonationDate = new Date(donor.lastDonation);
  const monthsSince =
    (new Date() - lastDonationDate) / (1000 * 60 * 60 * 24 * 30);

  if (monthsSince < 3) score -= 20;

  if (score < 0) score = 0;

  res.json({
    donorId,
    responseProbability: score,
  });
});

// -------------------------------
// START SERVER
// -------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
