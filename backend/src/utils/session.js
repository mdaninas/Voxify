import crypto from "node:crypto";
import config from "../config.js";

export const SESSION_COOKIE = "voxify_session";

const runtimeSecret = crypto.randomBytes(32).toString("hex");

function secret() {
  return config.sessionSecret || runtimeSecret;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId, ttlMs = config.sessionTtlHours * 60 * 60 * 1000) {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${userId}.${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  let payload;
  try {
    payload = Buffer.from(parts[0], "base64url").toString();
  } catch {
    return null;
  }
  const expected = sign(payload);
  const given = parts[1];
  if (
    expected.length !== given.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))
  ) {
    return null;
  }
  const splitAt = payload.lastIndexOf(".");
  if (splitAt < 1) {
    return null;
  }
  const userId = payload.slice(0, splitAt);
  const expiresAt = Number(payload.slice(splitAt + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }
  return userId;
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      cookies[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return cookies;
}
