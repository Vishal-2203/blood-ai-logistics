import crypto from "crypto";

const DEFAULT_TOKEN_TTL_HOURS = 12;
const AUTH_SECRET = process.env.AUTH_SECRET || "blood-agent-dev-secret";

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(encodedPayload).digest("base64url");
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const expected = Buffer.from(expectedHash, "hex");
  const received = Buffer.from(hash, "hex");

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

export function issueAuthToken(user, ttlHours = DEFAULT_TOKEN_TTL_HOURS) {
  const now = Date.now();
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    bloodGroup: user.bloodGroup || null,
    iat: now,
    exp: now + ttlHours * 60 * 60 * 1000
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyAuthToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const expected = Buffer.from(expectedSignature, "utf8");
  const received = Buffer.from(signature, "utf8");

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));

    if (!payload?.sub || !payload?.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getBearerToken(authorizationHeader = "") {
  if (!authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim() || null;
}
