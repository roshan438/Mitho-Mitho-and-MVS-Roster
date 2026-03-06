// import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
// import { onAuthStateChanged } from "firebase/auth";
// import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
// import { auth, db } from "../firebase/firebase";

// const AuthCtx = createContext(null);

// export function AuthProvider({ children }) {
//   const [fbUser, setFbUser] = useState(null);
//   const [profile, setProfile] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, async (u) => {
//       setFbUser(u);
//       setProfile(null);

//       if (!u) {
//         setLoading(false);
//         return;
//       }

//       const ref = doc(db, "users", u.uid);
//       const snap = await getDoc(ref);

//       if (!snap.exists()) {
//         await setDoc(
//           ref,
//           {
//             email: u.email || "",
//             role: "staff",
//             status: "pending",
//             createdAt: serverTimestamp(),
//             updatedAt: serverTimestamp(),
//           },
//           { merge: true }
//         );
//         const newSnap = await getDoc(ref);
//         setProfile(newSnap.data());
//       } else {
//         setProfile(snap.data());
//       }

//       setLoading(false);
//     });

//     return () => unsub();
//   }, []);

//   const value = useMemo(() => ({ fbUser, profile, loading }), [fbUser, profile, loading]);

//   return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
// }

// export function useAuth() {
//   return useContext(AuthCtx);
// }





import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

const AuthCtx = createContext(null);

function splitDisplayName(displayName = "") {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setFbUser(u);
      setProfile(null);

      if (!u) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          const name = splitDisplayName(u.displayName || "");

          await setDoc(
            ref,
            {
              uid: u.uid,
              email: u.email || "",
              firstName: name.firstName,
              lastName: name.lastName,
              dob: "",
              phone: "",
              addressLine1: "",
              suburb: "",
              state: "NSW",
              postcode: "",
              emergencyName: "",
              emergencyPhone: "",
              emergencyRelationship: "",
              taxInProgress: true,
              role: "staff",
              status: "pending",
              profileComplete: false,
              hourlyRate: null,
              provider: u.providerData?.[0]?.providerId || "unknown",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const newSnap = await getDoc(ref);
          setProfile(newSnap.data());
        } else {
          setProfile(snap.data());
        }
      } catch (err) {
        console.error("AuthProvider profile load error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(() => ({ fbUser, profile, loading }), [fbUser, profile, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}