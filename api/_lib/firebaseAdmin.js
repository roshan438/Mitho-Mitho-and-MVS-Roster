import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function assertFirebaseAdminEnv() {
  const missing = [
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing Firebase admin env vars: ${missing.join(", ")}`);
  }
}

function getPrivateKey() {
  const rawValue = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!rawValue) return rawValue;

  const normalizedValue = rawValue
    .trim()
    .replace(/^"(.*)"$/s, "$1")
    .replace(/^'(.*)'$/s, "$1")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");

  if (!normalizedValue.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_ADMIN_PRIVATE_KEY is malformed. Paste the full Firebase private_key value, including BEGIN/END PRIVATE KEY lines."
    );
  }

  return normalizedValue;
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  assertFirebaseAdminEnv();

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
  });
}

const app = getFirebaseAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
