const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Donors Collection
const DonorSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, unique: true, required: true },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], index: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [longitude, latitude]
  },
  lastDonationDate: { type: Date, default: null },
  isAvailable: { type: Boolean, default: true },
  reliabilityScore: { type: Number, default: 100 },
  historicalResponseRate: { type: Number, default: 0.0 }, // 0.0 to 1.0
  fcmToken: String // For Firebase push notifications
});
DonorSchema.index({ location: '2dsphere' });

// Hospitals Collection
const HospitalSchema = new Schema({
  name: { type: String, required: true },
  address: String,
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  adminUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
});
HospitalSchema.index({ location: '2dsphere' });

// Blood Requests Collection
const BloodRequestSchema = new Schema({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
  bloodGroup: { type: String, required: true },
  unitsRequired: { type: Number, required: true },
  unitsFulfilled: { type: Number, default: 0 },
  urgency: { type: String, enum: ['Normal', 'High', 'Critical'] },
  status: { type: String, enum: ['Pending', 'Partially Fulfilled', 'Fulfilled', 'Cancelled'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  assignedDonors: [{
    donorId: { type: Schema.Types.ObjectId, ref: 'Donor' },
    status: { type: String, enum: ['Notified', 'Accepted', 'En_Route', 'Arrived', 'Donated', 'Declined'] },
    estimatedETA: Number // stored in minutes
  }]
});

// Inventory Collection (Per Hospital Snapshot)
const InventorySchema = new Schema({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  bloodGroup: String,
  unitsAvailable: Number,
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = {
  Donor: mongoose.model('Donor', DonorSchema),
  Hospital: mongoose.model('Hospital', HospitalSchema),
  Request: mongoose.model('BloodRequest', BloodRequestSchema),
  Inventory: mongoose.model('Inventory', InventorySchema)
};
