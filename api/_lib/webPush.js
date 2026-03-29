import webpush from "web-push";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.js";
import { shouldDeliverPush } from "./pushPolicy.js";

function assertWebPushEnv() {
  const missing = ["WEB_PUSH_PUBLIC_KEY", "WEB_PUSH_PRIVATE_KEY"].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(`Missing web push env vars: ${missing.join(", ")}`);
  }
}

function configureWebPush() {
  assertWebPushEnv();

  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT || "mailto:admin@example.com",
    process.env.WEB_PUSH_PUBLIC_KEY,
    process.env.WEB_PUSH_PRIVATE_KEY
  );
}

export async function sendPushToUsers(uids, payload) {
  configureWebPush();

  const uniqueUids = [...new Set((uids || []).filter(Boolean))];
  let notified = 0;
  let skipped = 0;

  if (uniqueUids.length === 0) {
    return { notified, skipped, targetedUsers: 0 };
  }

  const payloadJson = JSON.stringify(payload);

  await Promise.all(
    uniqueUids.map(async (uid) => {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      const userProfile = userDoc.exists ? userDoc.data() : {};

      if (!shouldDeliverPush(userProfile, payload)) {
        skipped += 1;
        return;
      }

      const subscriptionSnap = await adminDb
        .collection("users")
        .doc(uid)
        .collection("pushSubscriptions")
        .get();

      if (subscriptionSnap.empty) {
        skipped += 1;
        return;
      }

      await Promise.all(
        subscriptionSnap.docs.map(async (subscriptionDoc) => {
          const subscriptionRecord = subscriptionDoc.data()?.subscription;

          if (!subscriptionRecord?.endpoint) return;

          try {
            await webpush.sendNotification(subscriptionRecord, payloadJson);
            notified += 1;

            await subscriptionDoc.ref.set(
              {
                lastDeliveredAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } catch (error) {
            const statusCode = error?.statusCode || error?.status;

            if (statusCode === 404 || statusCode === 410) {
              await subscriptionDoc.ref.delete();
              return;
            }

            console.error(`Push delivery failed for ${uid}`, error);
          }
        })
      );
    })
  );

  return {
    notified,
    skipped,
    targetedUsers: uniqueUids.length,
  };
}
