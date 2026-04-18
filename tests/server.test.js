import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

let serverProcess;
let baseUrl;
let tempDataDir;
let hospitalToken;
let donorToken;

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the server is available.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("Timed out waiting for the backend server to start.");
}

async function login(email, password, role) {
  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      role
    })
  });

  const payload = await response.json();
  assert.equal(response.status, 200);
  return payload;
}

before(async () => {
  const port = await getAvailablePort();
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "blood-agent-test-"));
  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: tempDataDir,
      AUTH_SECRET: "test-secret",
      GEMINI_API_KEY: ""
    }
  });

  await waitForServer(baseUrl);

  const hospitalSession = await login("hospital@bloodagent.demo", "hospital123", "hospital");
  const donorSession = await login("donor@bloodagent.demo", "donor123", "donor");

  hospitalToken = hospitalSession.token;
  donorToken = donorSession.token;
});

after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    await once(serverProcess, "exit");
  }

  if (tempDataDir) {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
});

test("serves the built frontend shell", async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<div id="root"><\/div>/i);
});

test("login returns a token and bootstrapped session state", async () => {
  const payload = await login("hospital@bloodagent.demo", "hospital123", "hospital");

  assert.equal(payload.user.role, "hospital");
  assert.equal(typeof payload.token, "string");
  assert.ok(payload.requests.length >= 1);
  assert.ok(payload.stock.length >= 1);
  assert.ok(payload.donors.length >= 1);
});

test("protected bootstrap requires authentication", async () => {
  const response = await fetch(`${baseUrl}/session/bootstrap`);
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.match(payload.error, /authentication/i);
});

test("ai-insights returns four cards for an authenticated dashboard panel", async () => {
  const response = await fetch(`${baseUrl}/ai-insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hospitalToken}`
    },
    body: JSON.stringify({
      activeRequest: {
        id: "REQ-2001",
        patient: "Maya Singh",
        blood: "O-",
        units: 2,
        status: "Matching",
        location: "AIIMS Emergency Wing",
        lat: 28.567,
        lng: 77.21
      },
      stock: [
        { type: "O-", units: 2, min: 25 },
        { type: "A+", units: 45, min: 50 }
      ]
    })
  });

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.insights.length, 4);
  assert.equal(payload.insights[0].title, "Critical Stock Alert");
});

test("request-blood persists a request and returns ranked donors through the fallback pipeline", async () => {
  const response = await fetch(`${baseUrl}/request-blood`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hospitalToken}`
    },
    body: JSON.stringify({
      patient: "Maya Singh",
      bloodGroup: "O-",
      units: 2,
      urgency: "Critical",
      location: "AIIMS Emergency Wing",
      lat: 28.567,
      lng: 77.21,
      text: "Critical request for 2 units of O- blood for Maya Singh at AIIMS Emergency Wing"
    })
  });

  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.intent.blood_group, "O-");
  assert.equal(payload.intent.urgency, "high");
  assert.equal(payload.top_3_donors.length, 3);
  assert.equal(payload.request.patient, "Maya Singh");
  assert.match(payload.decision.reason, /\[Rule-Based Fallback\]/);

  const bootstrapResponse = await fetch(`${baseUrl}/session/bootstrap`, {
    headers: {
      Authorization: `Bearer ${hospitalToken}`
    }
  });
  const bootstrapPayload = await bootstrapResponse.json();

  assert.equal(bootstrapResponse.status, 200);
  assert.ok(bootstrapPayload.requests.some((request) => request.patient === "Maya Singh"));
});

test("donor responses update request fulfillment and inventory", async () => {
  const createResponse = await fetch(`${baseUrl}/request-blood`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hospitalToken}`
    },
    body: JSON.stringify({
      patient: "Second Patient",
      bloodGroup: "O-",
      units: 1,
      urgency: "Critical",
      location: "AIIMS Emergency Wing"
    })
  });
  const createdPayload = await createResponse.json();

  const respondResponse = await fetch(`${baseUrl}/requests/${createdPayload.request.id}/respond`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${donorToken}`
    },
    body: JSON.stringify({
      decision: "accept"
    })
  });

  const respondPayload = await respondResponse.json();

  assert.equal(respondResponse.status, 200);
  assert.equal(respondPayload.request.status, "Fulfilled");
  assert.equal(respondPayload.request.fulfilled, 1);
  assert.equal(respondPayload.stock.type, "O-");
  assert.ok(respondPayload.stock.units >= 1);
});

test("request-blood rejects requests when a valid blood group cannot be resolved", async () => {
  const response = await fetch(`${baseUrl}/request-blood`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hospitalToken}`
    },
    body: JSON.stringify({
      patient: "Unknown Patient",
      bloodGroup: "ZZ",
      text: "Need some blood"
    })
  });

  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /valid blood group/i);
});
