








import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { DEFAULT_NOTIFICATION_SETTINGS, normalizeNotificationSettings } from "../utils/notificationSettings";

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

const LAST_ACTIVITY_KEY = "mvs_last_activity";
const STAFF_TIMEOUT_MS = 1000 * 60 * 60 * 2; // 12 hours
const ADMIN_TIMEOUT_MS = 1000 * 60 * 60 * 4;  // 4 hours

export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef(null);

  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const getTimeoutForRole = useCallback((role) => {
    return role === "admin" ? ADMIN_TIMEOUT_MS : STAFF_TIMEOUT_MS;
  }, []);

  const markActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }, []);

  const forceLogoutIfExpired = useCallback(async (role) => {
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
    const timeoutMs = getTimeoutForRole(role);

    if (!lastActivity) {
      markActivity();
      return false;
    }

    const expired = Date.now() - lastActivity > timeoutMs;
    if (expired) {
      clearLogoutTimer();
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      await signOut(auth);
      return true;
    }

    return false;
  }, [clearLogoutTimer, getTimeoutForRole, markActivity]);

  const startInactivityWatcher = useCallback((role) => {
    clearLogoutTimer();

    const timeoutMs = getTimeoutForRole(role);
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
    const remaining = Math.max(timeoutMs - (Date.now() - lastActivity), 1000);

    logoutTimerRef.current = setTimeout(async () => {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      await signOut(auth);
    }, remaining);
  }, [clearLogoutTimer, getTimeoutForRole]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setFbUser(u);
      setProfile(null);
      clearLogoutTimer();

      if (!u) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        let nextProfile = null;

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
              notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const newSnap = await getDoc(ref);
          nextProfile = newSnap.data();
        } else {
          nextProfile = snap.data();
        }

        nextProfile = {
          ...nextProfile,
          notificationSettings: normalizeNotificationSettings(nextProfile?.notificationSettings),
        };
        setProfile(nextProfile);

        const expired = await forceLogoutIfExpired(nextProfile?.role || "staff");
        if (!expired) {
          markActivity();
          startInactivityWatcher(nextProfile?.role || "staff");
        }
      } catch (err) {
        console.error("AuthProvider profile load error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      clearLogoutTimer();
      unsub();
    };
  }, [clearLogoutTimer, forceLogoutIfExpired, markActivity, startInactivityWatcher]);

  useEffect(() => {
    if (!fbUser || !profile?.role) return;

    const events = ["click", "keydown", "touchstart", "mousemove", "scroll"];

    const handleActivity = () => {
      markActivity();
      startInactivityWatcher(profile.role);
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [fbUser, markActivity, profile?.role, startInactivityWatcher]);

  const value = useMemo(
    () => ({ fbUser, profile, loading }),
    [fbUser, profile, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
