import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { readBearerToken, sendJson } from "../_lib/http.js";

function makeSubscriptionId(endpoint = "") {
  return crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 40);
}

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
    const { subscription, permission, standalone } = req.body || {};

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return sendJson(res, 400, { error: "Invalid subscription payload" });
    }

    const subscriptionId = makeSubscriptionId(subscription.endpoint);
    const subscriptionRef = adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .collection("pushSubscriptions")
      .doc(subscriptionId);

    await subscriptionRef.set(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        subscription,
        permission: permission || "default",
        standalone: Boolean(standalone),
        userAgent: req.headers["user-agent"] || "",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await adminDb.collection("users").doc(decodedToken.uid).set(
      {
        pushNotificationsEnabled: true,
        pushPermission: permission || "granted",
        pushUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return sendJson(res, 200, { ok: true, subscriptionId });
  } catch (error) {
    console.error("Push subscribe failed", error);
    return sendJson(res, 500, { error: "Failed to save push subscription" });
  }
}
