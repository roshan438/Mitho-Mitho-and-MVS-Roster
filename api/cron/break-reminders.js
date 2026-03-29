import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../_lib/firebaseAdmin.js";
import { sendJson } from "../_lib/http.js";
import { sendPushToUsers } from "../_lib/webPush.js";

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const FORTY_MINUTES_MS = 40 * 60 * 1000;

function getDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value.toMillis === "function") return value.toMillis();
  return 0;
}

async function createNotification(uid, title, message, metadata = {}) {
  const ref = adminDb.collection("notifications").doc();
  await ref.set({
    uid,
    title,
    message,
    type: "info",
    link: "/staff/today",
    read: false,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  try {
    const today = getDateString();
    const now = Date.now();
    const snap = await adminDb
      .collection("timesheets")
      .where("date", "==", today)
      .where("status", "in", ["working", "on_break"])
      .get();

    let sent = 0;

    await Promise.all(
      snap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const startActualMs = toMillis(data.startActual);
        const breakStartMs = toMillis(data.breakStartActual);

        if (data.status === "working" && startActualMs && !data.breakStartActual) {
          const workedMs = now - startActualMs;

          if (workedMs >= FIVE_HOURS_MS && !data.breakReminderSentAt) {
            await createNotification(
              data.uid,
              "Break reminder",
              "You have been working for 5 hours. Please take your break.",
              { kind: "break-reminder", timesheetId: docSnap.id }
            );

            const result = await sendPushToUsers([data.uid], {
              title: "Break reminder",
              body: "You have been working for 5 hours. Please take your break.",
              tag: `break-reminder-${docSnap.id}`,
              icon: "/icon-app.svg",
              badge: "/icon-app.svg",
              renotify: false,
              requireInteraction: true,
              timestamp: Date.now(),
              data: {
                url: "/staff/today",
                timesheetId: docSnap.id,
                metadata: {
                  kind: "break-reminder",
                },
              },
            });

            sent += result.notified;

            await docSnap.ref.set(
              {
                breakReminderSentAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
        }

        if (data.status === "on_break" && breakStartMs && !data.breakEndActual) {
          const breakMs = now - breakStartMs;

          if (breakMs >= FORTY_MINUTES_MS && !data.breakEndReminderSentAt) {
            await createNotification(
              data.uid,
              "Break ending reminder",
              "Your break has reached 40 minutes. Please end your break if you are back.",
              { kind: "break-end-reminder", timesheetId: docSnap.id }
            );

            const result = await sendPushToUsers([data.uid], {
              title: "Break ending reminder",
              body: "Your break has reached 40 minutes. Please end your break if you are back.",
              tag: `break-end-reminder-${docSnap.id}`,
              icon: "/icon-app.svg",
              badge: "/icon-app.svg",
              renotify: false,
              requireInteraction: true,
              timestamp: Date.now(),
              data: {
                url: "/staff/today",
                timesheetId: docSnap.id,
                metadata: {
                  kind: "break-end-reminder",
                },
              },
            });

            sent += result.notified;

            await docSnap.ref.set(
              {
                breakEndReminderSentAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
        }
      })
    );

    return sendJson(res, 200, { ok: true, checked: snap.size, sent });
  } catch (error) {
    console.error("Break reminder cron failed", error);
    return sendJson(res, 500, { error: "Failed to process break reminders" });
  }
}
