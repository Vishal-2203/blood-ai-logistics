require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

// Import MongoDB Schemas
const { Donor, Hospital, Request, Inventory } = require('./models');

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
const io = new Server(server, { 
    cors: { origin: '*' } 
});

app.use(cors());
app.use(express.json());

// ─── DATABASE CONNECTION ──────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/blood-agent';
mongoose.connect(MONGO_URI)
 .then(() => console.log('✅ MongoDB connected'))
 .catch(err => console.log('❌ DB Connection Error:', err));


// ─── RESTFUL API ENDPOINTS ────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({ status: 'active', message: 'Blood Agent API is online.' });
});

// 1. Raise Emergency Request
app.post('/api/requests', async (req, res) => {
    const { hospitalId, bloodGroup, unitsRequired, urgency } = req.body;
    try {
        const newReq = await Request.create({ 
           hospitalId, bloodGroup, unitsRequired, urgency 
        });
        
        console.log(`[ALERT] ${urgency} ${bloodGroup} request raised by Hospital ${hospitalId}`);

        io.emit('emergency_alert', newReq);

        res.status(201).json({ success: true, message: 'Request broadcasted successfully.', data: newReq });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Fetch Active Requests
app.get('/api/requests', async (req, res) => {
    try {
        const { hospitalId } = req.query;
        let query = {};
        if (hospitalId) query.hospitalId = hospitalId;
        const requests = await Request.find(query).populate('hospitalId');
        res.json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/requests/:id
app.get('/api/requests/:id', async (req, res) => {
    try {
        const request = await Request.findById(req.params.id).populate('hospitalId').populate('assignedDonors.donorId');
        res.json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/requests/:id/status
app.patch('/api/requests/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const request = await Request.findByIdAndUpdate(req.params.id, { status }, { new: true });
        io.to(`tracking_${req.params.id}`).emit('request_status_update', request);
        res.json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/donors/match/:requestId
app.get('/api/donors/match/:requestId', async (req, res) => {
    try {
        const dbRequest = await Request.findById(req.params.requestId).populate('hospitalId');
        if (!dbRequest) return res.status(404).json({ error: 'Request not found' });
        
        const hospitalLocation = dbRequest.hospitalId.location; 
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const matched = await Donor.aggregate([
            {
                $geoNear: {
                    near: hospitalLocation,
                    distanceField: "distance",
                    maxDistance: 15000, // 15km
                    spherical: true
                }
            },
            {
                $match: {
                    bloodGroup: dbRequest.bloodGroup,
                    isAvailable: true,
                    $or: [{ lastDonationDate: { $lte: sixMonthsAgo } }, { lastDonationDate: null }]
                }
            },
            {
                $addFields: {
                    score: {
                        $subtract: [
                            { $add: [100, { $ifNull: ["$reliabilityScore", 100] }] },
                            { $divide: ["$distance", 100] } 
                        ]
                    }
                }
            },
            { $sort: { score: -1 } },
            { $limit: dbRequest.unitsRequired * 3 }
        ]);

        res.json({ success: true, count: matched.length, matches: matched });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/donors/respond
app.post('/api/donors/respond', async (req, res) => {
    try {
         const { requestId, donorId, status } = req.body;
         const request = await Request.updateOne(
             { _id: requestId, "assignedDonors.donorId": donorId },
             { $set: { "assignedDonors.$.status": status } }
         );
         res.json({ success: true, data: request });
    } catch (error) {
         res.status(500).json({ error: error.message });
    }
});

// GET /api/inventory/hospitals
app.get('/api/inventory/hospitals', async (req, res) => {
    try {
         const inventory = await Inventory.find().populate('hospitalId');
         res.json({ success: true, data: inventory });
    } catch (error) {
         res.status(500).json({ error: error.message });
    }
});

// PATCH /api/donors/:id/location
app.patch('/api/donors/:id/location', async (req, res) => {
    try {
         const { lat, lng } = req.body;
         const donor = await Donor.findByIdAndUpdate(req.params.id, { 
             location: { type: 'Point', coordinates: [lng, lat] }
         }, { new: true });
         res.json({ success: true, data: donor });
    } catch (error) {
         res.status(500).json({ error: error.message });
    }
});

// ─── REAL-TIME WEBSOCKETS (SOCKET.IO) ───────────────────────
io.on('connection', (socket) => {
    console.log(`🟢 Platform connected: ${socket.id}`);

    // Join tracking room for an active request
    socket.on('join_tracking', (requestId) => {
        socket.join(`tracking_${requestId}`);
        console.log(`Hospital subscribed to tracking_${requestId}`);
    });

    // Receive live donor GPS coords and broadcast to hospital dashboard
    socket.on('donor_location_update', (data) => {
        // data expects: { requestId, donorId, lat, lng, eta }
        io.to(`tracking_${data.requestId}`).emit('donor_movement_update', data);
    });

    socket.on('disconnect', () => {
        console.log(`🔴 Platform disconnected: ${socket.id}`);
    });
});

// ─── START SERVER ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`[System Architecture] Node.js Engine active on port ${PORT}`);
});
