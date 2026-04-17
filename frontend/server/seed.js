require('dotenv').config();
const mongoose = require('mongoose');
const { Donor, Hospital, Inventory } = require('./models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/blood-agent';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for seeding');

        // Clear existing data
        await Donor.deleteMany({});
        await Hospital.deleteMany({});
        await Inventory.deleteMany({});

        // Create Hospitals with specific coordinates for Delhi
        const hospitals = await Hospital.create([
            {
                name: 'AIIMS Emergency Wing',
                address: 'Ansari Nagar, New Delhi',
                location: { type: 'Point', coordinates: [77.2100, 28.5672] }
            },
            {
                name: 'Fortis Memorial Research Institute',
                address: 'Gurugram, Haryana',
                location: { type: 'Point', coordinates: [77.0725, 28.4595] }
            },
            {
                name: 'Max Super Speciality Hospital',
                address: 'Saket, New Delhi',
                location: { type: 'Point', coordinates: [77.2131, 28.5283] }
            }
        ]);

        console.log('Hospitals seeded');

        // Seed Inventory for each hospital
        for (const hospital of hospitals) {
            const inventoryItems = bloodGroups.map(bg => ({
                hospitalId: hospital._id,
                bloodGroup: bg,
                unitsAvailable: Math.floor(Math.random() * 50) + 5,
                lastUpdated: new Date()
            }));
            await Inventory.insertMany(inventoryItems);
        }
        console.log('Inventory seeded');

        // Create Donors around AIIMS (within 20km)
        const donors = [];
        for (let i = 0; i < 50; i++) {
            // Random coordinates within ~0.2 degrees (roughly 20km)
            const lng = 77.2100 + (Math.random() - 0.5) * 0.4;
            const lat = 28.5672 + (Math.random() - 0.5) * 0.4;
            
            donors.push({
                name: `Donor ${i + 1}`,
                phone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
                bloodGroup: bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
                location: { type: 'Point', coordinates: [lng, lat] },
                lastDonationDate: Math.random() > 0.3 ? new Date(Date.now() - Math.floor(Math.random() * 200) * 24 * 60 * 60 * 1000) : null,
                isAvailable: true,
                reliabilityScore: Math.floor(Math.random() * 40) + 60,
                historicalResponseRate: Math.random(),
                fcmToken: `token_${i}`
            });
        }
        await Donor.insertMany(donors);
        console.log('Donors seeded');

        console.log('Seeding complete! Closing connection...');
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedData();
