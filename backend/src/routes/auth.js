import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import config, { isAuthEnabled } from "../config.js";
import { getDb, logEvent } from "../database/db.js";
import { AppError, errorResponse } from "../utils/errors.js";
import { SESSION_COOKIE, createSessionToken } from "../utils/session.js";
import { LOCAL_USER_ID, getSessionUser } from "../middleware/requireAuth.js";

const router = Router();

let oauthClient;

function getOauthClient() {
  if (!oauthClient) {
    oauthClient = new OAuth2Client(config.googleClientId);
  }
  return oauthClient;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture
  };
}

router.get("/config", (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: isAuthEnabled(),
      google_client_id: isAuthEnabled() ? config.googleClientId : null
    }
  });
});

router.get("/me", (req, res) => {
  try {
    if (!isAuthEnabled()) {
      res.json({ success: true, data: { user: null, enabled: false } });
      return;
    }
    const user = getSessionUser(req);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Belum login.", 401);
    }
    res.json({ success: true, data: { user: publicUser(user), enabled: true } });
  } catch (err) {
    errorResponse(res, err);
  }
});

router.post("/google", async (req, res) => {
  try {
    if (!isAuthEnabled()) {
      throw new AppError("VALIDATION_ERROR", "Login Google tidak diaktifkan di server ini.", 400);
    }
    const credential = req.body?.credential;
    if (!credential || typeof credential !== "string") {
      throw new AppError("VALIDATION_ERROR", "Credential Google wajib dikirim.");
    }

    let payload;
    try {
      const ticket = await getOauthClient().verifyIdToken({
        idToken: credential,
        audience: config.googleClientId
      });
      payload = ticket.getPayload();
    } catch {
      throw new AppError("UNAUTHORIZED", "Token Google tidak valid atau kedaluwarsa.", 401);
    }
    if (!payload?.sub) {
      throw new AppError("UNAUTHORIZED", "Token Google tidak berisi identitas valid.", 401);
    }

    const db = getDb();
    const now = new Date().toISOString();
    const googleUserCount = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE google_sub IS NOT NULL")
      .get().count;

    let user = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(payload.sub);
    if (user) {
      db.prepare(
        "UPDATE users SET email = ?, name = ?, picture = ?, last_login_at = ? WHERE id = ?"
      ).run(payload.email || null, payload.name || null, payload.picture || null, now, user.id);
    } else {
      const userId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO users (id, google_sub, email, name, picture, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(userId, payload.sub, payload.email || null, payload.name || null, payload.picture || null, now, now);
      if (googleUserCount === 0) {
        db.prepare(
          "UPDATE voices SET user_id = ? WHERE user_id IS NULL OR user_id = ?"
        ).run(userId, LOCAL_USER_ID);
        db.prepare(
          "UPDATE generated_audios SET user_id = ? WHERE user_id IS NULL OR user_id = ?"
        ).run(userId, LOCAL_USER_ID);
        logEvent("auth_data_adopted", "Data lama diadopsi oleh user Google pertama.", { userId });
      }
    }
    user = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(payload.sub);

    const token = createSessionToken(user.id);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: config.cookieSameSite,
      secure: config.cookieSecure || config.cookieSameSite === "none",
      path: "/",
      maxAge: config.sessionTtlHours * 60 * 60 * 1000
    });

    logEvent("auth_login", `Login Google: ${user.email || user.id}`, { userId: user.id });
    res.json({ success: true, data: { user: publicUser(user) } });
  } catch (err) {
    errorResponse(res, err);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, {
    path: "/",
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure || config.cookieSameSite === "none"
  });
  res.json({ success: true, data: { logged_out: true } });
});

export default router;
