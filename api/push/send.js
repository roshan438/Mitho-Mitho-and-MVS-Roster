import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { readBearerToken, sendJson } from "../_lib/http.js";
import { sendPushToUsers } from "../_lib/webPush.js";
import { getPushMeta } from "../_lib/pushPolicy.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const bearerToken = readBearerToken(req);
    if (!bearerToken) {
      return sendJson(res, 401, { error: "Missing auth token" });
    }

    const decodedToken = await adminAuth.verifyIdToken(bearerToken);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    const userProfile = userDoc.exists ? userDoc.data() : null;

    if (userProfile?.role !== "admin") {
      return sendJson(res, 403, { error: "Admins only" });
    }

    const { uids, notification } = req.body || {};

    if (!Array.isArray(uids) || uids.length === 0 || !notification) {
      return sendJson(res, 400, { error: "uids and notification are required" });
    }

    const pushMeta = getPushMeta(notification);

    const result = await sendPushToUsers(uids, {
      title: notification.title || "RAS Roster",
      body: notification.message || "Open the app to see the latest update.",
      tag: notification.metadata?.kind || notification.title || "ras-roster",
      icon: "/icon-app.svg",
      badge: "/icon-app.svg",
      renotify: false,
      requireInteraction: pushMeta.priority >= 3,
      timestamp: Date.now(),
      data: {
        url: notification.link || "/",
        metadata: notification.metadata || {},
        priority: pushMeta.priority,
      },
    });

    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error("Push send failed", error);
    return sendJson(res, 500, { error: "Failed to send push notification" });
  }
}
