import { collection, doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";

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
