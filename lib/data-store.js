import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./auth.js";

const DEFAULT_LOCATION = {
  location: "AIIMS Emergency Wing",
  lat: 28.567,
  lng: 77.21
};

const STOCK_ORDER = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const INITIAL_STOCK = [
  { type: "A+", units: 42, min: 50 },
  { type: "A-", units: 12, min: 20 },
  { type: "B+", units: 35, min: 40 },
  { type: "B-", units: 8, min: 15 },
  { type: "O+", units: 68, min: 80 },
  { type: "O-", units: 2, min: 25 },
  { type: "AB+", units: 18, min: 20 },
  { type: "AB-", units: 5, min: 10 }
];

let INITIAL_DONORS = [];
try {
  const donorsUrl = new URL("../donors.json", import.meta.url);
  const parsed = JSON.parse(fs.readFileSync(donorsUrl, "utf8"));
  INITIAL_DONORS = Array.isArray(parsed) ? parsed : [];
} catch {
  INITIAL_DONORS = [];
}

/*{
    id: "donor-ravi",
    userId: "user-donor-demo",
    name: "Ravi Kumar",
    blood: "O-",
    lat: 28.545,
    lng: 77.19,
    eta: 14,
    status: "Ready",
    responseRate: 0.95,
    donationFrequency: 3,
    lastDonationDaysAgo: 120
  },
  {
    id: "donor-priya",
    name: "Priya Rangan",
    blood: "O-",
    lat: 28.59,
    lng: 77.23,
    eta: 22,
    status: "Preparing",
    responseRate: 0.88,
    donationFrequency: 2,
    lastDonationDaysAgo: 140
  },
  {
    id: "donor-aman",
    name: "Aman Joshi",
    blood: "B-",
    lat: 28.571,
    lng: 77.181,
    eta: 11,
    status: "Queued",
    responseRate: 0.82,
    donationFrequency: 4,
    lastDonationDaysAgo: 160
  },
  {
    id: "donor-meena",
    name: "Meena Kapoor",
    blood: "O-",
    lat: 28.582,
    lng: 77.201,
    eta: 10,
    status: "Ready",
    responseRate: 0.91,
    donationFrequency: 5,
    lastDonationDaysAgo: 200
  }
];
*/
const INITIAL_REQUESTS = [
  {
    id: "REQ-1011",
    patient: "Anjali Verma",
    blood: "O-",
    units: 4,
    fulfilled: 1,
    urgency: "Critical",
    status: "In Transit",
    donorStatus: "accepted",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
  },
  {
    id: "REQ-1012",
    patient: "Rajesh Khanna",
    blood: "B-",
    units: 2,
    fulfilled: 0,
    urgency: "High",
    status: "Matching",
    donorStatus: "pending",
    location: "North Block Coordination Hub",
    lat: 28.617,
    lng: 77.213,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  }
];

const DEMO_USERS = [
  {
    id: "user-hospital-demo",
    email: "hospital@bloodagent.demo",
    password: "hospital123",
    role: "hospital",
    name: "Hospital Ops",
    bloodGroup: null
  },
  {
    id: "user-donor-demo",
    email: "donor@bloodagent.demo",
    password: "donor123",
    role: "donor",
    name: "Ravi Kumar",
    bloodGroup: "O-"
  },
  {
    id: "user-requestor-demo",
    email: "requestor@bloodagent.demo",
    password: "requestor123",
    role: "requestor",
    name: "Request Desk",
    bloodGroup: null
  }
];

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatRelativeTime(value) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    bloodGroup: row.blood_group || null
  };
}

function mapDonor(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id || null,
    name: row.name,
    blood: row.blood_group,
    lat: Number(row.lat),
    lng: Number(row.lng),
    eta: Number(row.eta),
    status: row.status,
    response_rate: Number(row.response_rate),
    donation_frequency: Number(row.donation_frequency),
    last_donation_days_ago: Number(row.last_donation_days_ago)
  };
}

function mapStock(row) {
  return {
    type: row.type,
    units: Number(row.units),
    min: Number(row.min)
  };
}

function mapRequest(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    patient: row.patient,
    blood: row.blood,
    units: Number(row.units),
    fulfilled: Number(row.fulfilled),
    urgency: row.urgency,
    status: row.status,
    time: formatRelativeTime(row.updated_at || row.created_at),
    donorStatus: row.donor_status,
    location: row.location,
    lat: Number(row.lat),
    lng: Number(row.lng),
    ai_data: parseJson(row.ai_data, null),
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createRandomDonorCoordinates() {
  const latOffset = (Math.random() - 0.5) * 0.08;
  const lngOffset = (Math.random() - 0.5) * 0.08;

  return {
    lat: Number((DEFAULT_LOCATION.lat + latOffset).toFixed(6)),
    lng: Number((DEFAULT_LOCATION.lng + lngOffset).toFixed(6))
  };
}

export function createDataStore(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new DatabaseSync(databasePath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      blood_group TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donors (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      name TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      eta INTEGER NOT NULL,
      status TEXT NOT NULL,
      response_rate REAL NOT NULL,
      donation_frequency INTEGER NOT NULL,
      last_donation_days_ago INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS stock (
      type TEXT PRIMARY KEY,
      units INTEGER NOT NULL,
      min INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      patient TEXT NOT NULL,
      blood TEXT NOT NULL,
      units INTEGER NOT NULL,
      fulfilled INTEGER NOT NULL,
      urgency TEXT NOT NULL,
      status TEXT NOT NULL,
      donor_status TEXT NOT NULL,
      location TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      ai_data TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Lightweight migrations for existing DBs created before columns were added.
  const requestColumns = new Set(
    db.prepare("PRAGMA table_info(requests)").all().map((row) => String(row.name))
  );

  if (!requestColumns.has("location")) {
    db.exec(`ALTER TABLE requests ADD COLUMN location TEXT NOT NULL DEFAULT '${DEFAULT_LOCATION.location}'`);
  }

  if (!requestColumns.has("lat")) {
    db.exec(`ALTER TABLE requests ADD COLUMN lat REAL NOT NULL DEFAULT ${DEFAULT_LOCATION.lat}`);
  }

  if (!requestColumns.has("lng")) {
    db.exec(`ALTER TABLE requests ADD COLUMN lng REAL NOT NULL DEFAULT ${DEFAULT_LOCATION.lng}`);
  }

  const countRows = (tableName) => db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;

  if (countRows("users") === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, name, role, password_salt, password_hash, blood_group, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const user of DEMO_USERS) {
      const password = hashPassword(user.password);
      insertUser.run(
        user.id,
        user.email.toLowerCase(),
        user.name,
        user.role,
        password.salt,
        password.hash,
        user.bloodGroup,
        nowIso()
      );
    }
  }

  if (countRows("donors") === 0) {
    const insertDonor = db.prepare(`
      INSERT INTO donors (
        id, user_id, name, blood_group, lat, lng, eta, status,
        response_rate, donation_frequency, last_donation_days_ago, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const donor of INITIAL_DONORS) {
      const timestamp = nowIso();
      insertDonor.run(
        donor.id,
        donor.userId || null,
        donor.name,
        donor.blood,
        donor.lat,
        donor.lng,
        donor.eta,
        donor.status,
        donor.responseRate,
        donor.donationFrequency,
        donor.lastDonationDaysAgo,
        timestamp,
        timestamp
      );
    }
  }

  if (countRows("stock") === 0) {
    const insertStock = db.prepare(`
      INSERT INTO stock (type, units, min, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const item of INITIAL_STOCK) {
      insertStock.run(item.type, item.units, item.min, nowIso());
    }
  }

  if (countRows("requests") === 0) {
    const insertRequest = db.prepare(`
      INSERT INTO requests (
        id, patient, blood, units, fulfilled, urgency, status, donor_status,
        location, lat, lng, ai_data, created_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const request of INITIAL_REQUESTS) {
      insertRequest.run(
        request.id,
        request.patient,
        request.blood,
        request.units,
        request.fulfilled,
        request.urgency,
        request.status,
        request.donorStatus,
        request.location || DEFAULT_LOCATION.location,
        request.lat ?? DEFAULT_LOCATION.lat,
        request.lng ?? DEFAULT_LOCATION.lng,
        request.ai_data ? JSON.stringify(request.ai_data) : null,
        "user-hospital-demo",
        request.createdAt,
        request.updatedAt
      );
    }
  }

  function listRequests() {
    return db
      .prepare("SELECT * FROM requests ORDER BY updated_at DESC")
      .all()
      .map(mapRequest);
  }

  function getRequestById(requestId) {
    return mapRequest(db.prepare("SELECT * FROM requests WHERE id = ?").get(requestId));
  }

  function saveRequest(request) {
    const timestamp = request.updatedAt || nowIso();

    db.prepare(`
      UPDATE requests
      SET patient = ?, blood = ?, units = ?, fulfilled = ?, urgency = ?, status = ?,
          donor_status = ?, location = ?, lat = ?, lng = ?, ai_data = ?, created_by = ?, updated_at = ?
      WHERE id = ?
    `).run(
      request.patient,
      request.blood,
      request.units,
      request.fulfilled,
      request.urgency,
      request.status,
      request.donorStatus,
      request.location,
      request.lat,
      request.lng,
      request.ai_data ? JSON.stringify(request.ai_data) : null,
      request.createdBy || null,
      timestamp,
      request.id
    );

    return getRequestById(request.id);
  }

  function createRequest(request) {
    db.prepare(`
      INSERT INTO requests (
        id, patient, blood, units, fulfilled, urgency, status, donor_status,
        location, lat, lng, ai_data, created_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      request.id,
      request.patient,
      request.blood,
      request.units,
      request.fulfilled,
      request.urgency,
      request.status,
      request.donorStatus,
      request.location,
      request.lat,
      request.lng,
      request.ai_data ? JSON.stringify(request.ai_data) : null,
      request.createdBy || null,
      request.createdAt,
      request.updatedAt
    );

    return getRequestById(request.id);
  }

  function listStock() {
    return db
      .prepare("SELECT * FROM stock")
      .all()
      .map(mapStock)
      .sort((left, right) => STOCK_ORDER.indexOf(left.type) - STOCK_ORDER.indexOf(right.type));
  }

  function getStockByType(type) {
    const row = db.prepare("SELECT * FROM stock WHERE type = ?").get(type);
    return row ? mapStock(row) : null;
  }

  function saveStock(item) {
    db.prepare(`
      INSERT INTO stock (type, units, min, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(type) DO UPDATE SET
        units = excluded.units,
        min = excluded.min,
        updated_at = excluded.updated_at
    `).run(item.type, item.units, item.min, nowIso());

    return getStockByType(item.type);
  }

  function incrementStock(type, delta) {
    const current = getStockByType(type) || { type, units: 0, min: 0 };
    return saveStock({
      ...current,
      units: Math.max(0, current.units + delta)
    });
  }

  function listDonors() {
    return db.prepare("SELECT * FROM donors ORDER BY name ASC").all().map(mapDonor);
  }

  function getDonorById(donorId) {
    return mapDonor(db.prepare("SELECT * FROM donors WHERE id = ?").get(donorId));
  }

  function getDonorByUserId(userId) {
    return mapDonor(db.prepare("SELECT * FROM donors WHERE user_id = ?").get(userId));
  }

  function saveDonor(donor) {
    db.prepare(`
      INSERT INTO donors (
        id, user_id, name, blood_group, lat, lng, eta, status,
        response_rate, donation_frequency, last_donation_days_ago, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        name = excluded.name,
        blood_group = excluded.blood_group,
        lat = excluded.lat,
        lng = excluded.lng,
        eta = excluded.eta,
        status = excluded.status,
        response_rate = excluded.response_rate,
        donation_frequency = excluded.donation_frequency,
        last_donation_days_ago = excluded.last_donation_days_ago,
        updated_at = excluded.updated_at
    `).run(
      donor.id,
      donor.userId || null,
      donor.name,
      donor.blood,
      donor.lat,
      donor.lng,
      donor.eta,
      donor.status,
      donor.response_rate,
      donor.donation_frequency,
      donor.last_donation_days_ago,
      donor.createdAt || nowIso(),
      donor.updatedAt || nowIso()
    );

    return getDonorById(donor.id);
  }

  function getUserByEmail(email) {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase().trim());
  }

  function getUserById(userId) {
    return mapUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
  }

  function createUser({ email, name, role, password, bloodGroup = null }) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const timestamp = nowIso();
    const id = crypto.randomUUID();
    const passwordRecord = hashPassword(password);

    db.prepare(`
      INSERT INTO users (id, email, name, role, password_salt, password_hash, blood_group, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, normalizedEmail, name, role, passwordRecord.salt, passwordRecord.hash, bloodGroup, timestamp);

    const user = getUserById(id);

    if (role === "donor") {
      const coordinates = createRandomDonorCoordinates();
      saveDonor({
        id: crypto.randomUUID(),
        userId: user.id,
        name: user.name,
        blood: bloodGroup,
        lat: coordinates.lat,
        lng: coordinates.lng,
        eta: 12,
        status: "Ready",
        response_rate: 0.7,
        donation_frequency: 1,
        last_donation_days_ago: 120,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    return user;
  }

  function getBootstrapState(user) {
    return {
      user,
      requests: listRequests(),
      donors: listDonors(),
      stock: listStock(),
      liveAiConfigured: Boolean(process.env.GEMINI_API_KEY)
    };
  }

  return {
    db,
    listRequests,
    getRequestById,
    createRequest,
    saveRequest,
    listStock,
    getStockByType,
    saveStock,
    incrementStock,
    listDonors,
    getDonorById,
    getDonorByUserId,
    saveDonor,
    getUserByEmail,
    getUserById,
    createUser,
    getBootstrapState
  };
}
