import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * 1) Create Firebase project
 * 2) Add a Web app
 * 3) Paste config below
 */
const firebaseConfig = {
  apiKey: "AIzaSyCQi6w1sBcWnASrEDp_cfJj98Nypz2N7XQ",
  authDomain: "ras-roster-app.firebaseapp.com",
  projectId: "ras-roster-app",
  storageBucket: "ras-roster-app.firebasestorage.app",
  messagingSenderId: "431100698096",
  appId: "1:431100698096:web:6ae7cd7321b2c089b99135"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);