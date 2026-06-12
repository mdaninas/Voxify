import { isAuthEnabled } from "../config.js";
import { getDb } from "../database/db.js";
import { AppError, errorResponse } from "../utils/errors.js";
import { SESSION_COOKIE, parseCookies, verifySessionToken } from "../utils/session.js";

export const LOCAL_USER_ID = "local-user";

export function getOrCreateLocalUser() {
  const db = getDb();
  let user = db.prepare("SELECT * FROM users WHERE id = ?").get(LOCAL_USER_ID);
  if (!user) {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, google_sub, email, name, picture, created_at, last_login_at) VALUES (?, NULL, NULL, 'Pengguna Lokal', NULL, ?, ?)"
    ).run(LOCAL_USER_ID, now, now);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(LOCAL_USER_ID);
  }
  return user;
}

export function getSessionUser(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const userId = verifySessionToken(token);
  if (!userId) {
    return null;
  }
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(userId) || null;
}

export function requireAuth(req, res, next) {
  if (!isAuthEnabled()) {
    req.user = getOrCreateLocalUser();
    next();
    return;
  }
  const user = getSessionUser(req);
  if (!user) {
    errorResponse(res, new AppError("UNAUTHORIZED", "Login dengan Google diperlukan.", 401));
    return;
  }
  req.user = user;
  next();
}
