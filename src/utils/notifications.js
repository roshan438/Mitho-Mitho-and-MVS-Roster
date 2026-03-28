import { collection, doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { auth } from "../firebase/firebase";

function uniqueTruthy(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function createNotification(db, notification) {
  const uid = notification?.uid;
  if (!uid) return;

  const ref = doc(collection(db, "notifications"));
  await setDoc(
    ref,
    {
      uid,
      title: notification.title || "Update",
      message: notification.message || "",
      type: notification.type || "info",
      link: notification.link || "",
      read: false,
      metadata: notification.metadata || {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function notifyUsers(db, uids, notification) {
  const recipients = uniqueTruthy(uids);
  if (recipients.length === 0) return;

  const batch = writeBatch(db);

  recipients.forEach((uid) => {
    const ref = doc(collection(db, "notifications"));
    batch.set(
      ref,
      {
        uid,
        title: notification.title || "Update",
        message: notification.message || "",
        type: notification.type || "info",
        link: notification.link || "",
        read: false,
        metadata: notification.metadata || {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}

export async function pushUsers(uids, notification) {
  const recipients = uniqueTruthy(uids);
  if (recipients.length === 0) return;
  if (!auth.currentUser) return;

  const idToken = await auth.currentUser.getIdToken();

  const response = await fetch("/api/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      uids: recipients,
      notification,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to send push notifications");
  }

  return response.json();
}
