import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../auth/AuthProvider";
import {
  getExistingPushSubscription,
  getPushPromptCopy,
  isPushSupported,
  isStandaloneDisplay,
  requiresStandaloneInstallForPush,
  subscribeToPush,
} from "../utils/pushNotifications";
import "./PushNotificationPrompt.css";

const PUSH_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;

export default function PushNotificationPrompt() {
  const { fbUser, profile } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined" ? "default" : Notification.permission
  );
  const promptCopy = getPushPromptCopy();

  const canPrompt =
    fbUser &&
    profile?.status === "approved" &&
    profile?.role !== "admin" &&
    isPushSupported();

  useEffect(() => {
    if (!canPrompt || permission !== "granted" || synced) return;

    syncExistingSubscription().catch((error) => {
      console.error("Failed to sync push subscription", error);
    });
  }, [canPrompt, permission, synced]);

  async function syncExistingSubscription() {
    if (!PUSH_PUBLIC_KEY || !fbUser) return;

    const subscription = await getExistingPushSubscription();
    if (!subscription) return;

    await saveSubscription(subscription);
    setSynced(true);
  }

  async function handleEnableNotifications() {
    if (!PUSH_PUBLIC_KEY) {
      showToast("Push key missing in Vercel environment", "error");
      return;
    }

    if (requiresStandaloneInstallForPush() && !isStandaloneDisplay()) {
      showToast(promptCopy.blockedMessage, "info");
      return;
    }

    setBusy(true);

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        showToast("Notifications were not allowed", "warning");
        return;
      }

      const subscription = await subscribeToPush(PUSH_PUBLIC_KEY);
      await saveSubscription(subscription);
      setSynced(true);
      showToast("Notifications enabled", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to enable notifications", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveSubscription(subscription) {
    const idToken = await fbUser.getIdToken();
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        permission: Notification.permission,
        standalone: isStandaloneDisplay(),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to save subscription");
    }
  }

  if (!canPrompt || permission === "granted") {
    return null;
  }

  return (
    <div className="push-prompt">
      <div>
        <strong>Turn on roster alerts</strong>
        <p>{promptCopy.description}</p>
      </div>
      <button className="push-prompt-button" onClick={handleEnableNotifications} disabled={busy}>
        {busy ? "Enabling..." : "Enable notifications"}
      </button>
    </div>
  );
}
