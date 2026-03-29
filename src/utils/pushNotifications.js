const SERVICE_WORKER_URL = "/sw.js";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator?.standalone === true
  );
}

export function requiresStandaloneInstallForPush() {
  return isAppleMobileDevice();
}

export function getPushPromptCopy() {
  if (requiresStandaloneInstallForPush()) {
    return {
      description:
        "On iPhone and iPad, install this app to your Home Screen first, then enable priority roster alerts.",
      blockedMessage: "Install to Home Screen first on iPhone, then reopen the app.",
    };
  }

  return {
    description:
      "Enable notifications to get priority roster alerts on this device, even when the browser or screen is not open.",
    blockedMessage: "",
  };
}

export async function registerPushServiceWorker() {
  return navigator.serviceWorker.register(SERVICE_WORKER_URL);
}

export async function getExistingPushSubscription() {
  const registration = await registerPushServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(publicKey) {
  const registration = await registerPushServiceWorker();
  const existingSubscription = await registration.pushManager.getSubscription();

  if (existingSubscription) return existingSubscription;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
