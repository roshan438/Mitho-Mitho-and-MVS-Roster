import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

export const KITCHEN_STOCK_STATUSES = [
  { value: "full", label: "Full", badge: "Full", rank: 5, quantityLabel: "100%" },
  { value: "half", label: "Half", badge: "Half", rank: 3, quantityLabel: "50%" },
  { value: "low", label: "Low", badge: "Low", rank: 2, quantityLabel: "Low" },
  { value: "custom", label: "Custom", badge: "Custom", rank: 0, quantityLabel: "Custom" },
  { value: "out", label: "Out of Stock", badge: "Out", rank: 0, quantityLabel: "0%" },
];

export const DEFAULT_KITCHEN_STOCK_SETTINGS = {
  enabled: true,
  requireAfterClockOn: false,
  completionRule: "once_per_day",
  managerCanReopen: true,
};

export function normalizeKitchenStockSettings(raw) {
  return {
    ...DEFAULT_KITCHEN_STOCK_SETTINGS,
    ...(raw || {}),
    completionRule: "once_per_day",
    enabled: raw?.enabled !== false,
    requireAfterClockOn: Boolean(raw?.requireAfterClockOn),
    managerCanReopen: raw?.managerCanReopen !== false,
  };
}

export function parseKitchenQuickStockQr(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("KQS:")) return null;
  const itemId = text.slice(4).trim();
  return itemId ? { itemId } : null;
}

export function isKitchenStockLow(status, customRatio = null) {
  if (status === "low" || status === "out") return true;
  if (status === "custom" && Number.isFinite(Number(customRatio))) {
    return Number(customRatio) <= 0.3;
  }
  return false;
}

export function getKitchenStatusMeta(status) {
  return (
    KITCHEN_STOCK_STATUSES.find((option) => option.value === status) ||
    KITCHEN_STOCK_STATUSES[0]
  );
}

export function getKitchenSessionScopeId({ date }) {
  return `day:${date}`;
}

export function canRunKitchenQuickStock({ department, shift, timesheet }) {
  const normalizedDepartment = String(department || shift?.department || "").toLowerCase();
  const isKitchen = normalizedDepartment === "kitchen";
  return Boolean(
    isKitchen &&
      shift?.storeId &&
      timesheet?.startActual &&
      !timesheet?.endActual
  );
}

function normalizeStoreKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getStoreKeyParts(value) {
  return normalizeStoreKey(value)
    .split("_")
    .filter(Boolean);
}

export function kitchenStoreMatches(itemStoreId, currentStoreId) {
  const left = normalizeStoreKey(itemStoreId);
  const right = normalizeStoreKey(currentStoreId);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftParts = getStoreKeyParts(left);
  const rightParts = getStoreKeyParts(right);
  const shared = leftParts.filter((part) => rightParts.includes(part));

  // Accept legacy/current aliases like "kitchen" <-> "kitchen_homebush"
  // while still requiring at least one meaningful shared token.
  return shared.length >= 1;
}

export function filterKitchenInventoryItems(items, storeId) {
  return items
    .filter(
      (item) =>
        item &&
        kitchenStoreMatches(item.storeId, storeId) &&
        String(item.department || "").toLowerCase() === "kitchen" &&
        item.active !== false
    )
    .sort((a, b) => {
      const locationA = String(a.location || a.shelf || "").toLowerCase();
      const locationB = String(b.location || b.shelf || "").toLowerCase();
      if (locationA !== locationB) return locationA.localeCompare(locationB);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

export async function loadKitchenStoreSettings(storeId) {
  const snap = await getDoc(doc(db, "storeSettings", storeId));
  return normalizeKitchenStockSettings(snap.data()?.kitchenQuickStockTake);
}

export async function findKitchenSession({
  storeId,
  date,
  userId,
  shiftId,
  completionRule,
}) {
  let sessionQuery = query(
    collection(db, "stockTakeSessions"),
    where("storeId", "==", storeId),
    where("date", "==", date),
    where("userId", "==", userId),
    where("department", "==", "kitchen"),
    where("scopeId", "==", getKitchenSessionScopeId({ completionRule, date, shiftId })),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snap = await getDocs(sessionQuery);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createKitchenSession({
  userId,
  userName,
  role,
  storeId,
  storeLabel,
  date,
  shift,
  settings,
}) {
  const sessionRef = await addDoc(collection(db, "stockTakeSessions"), {
    userId,
    userName: userName || "Kitchen Staff",
    role: role || "staff",
    storeId,
    storeLabel: storeLabel || storeId,
    date,
    shiftId: shift?.id || null,
    shiftStart: shift?.startPlanned || "",
    shiftEnd: shift?.endPlanned || "",
    scopeId: getKitchenSessionScopeId({
      completionRule: settings.completionRule,
      date,
      shiftId: shift?.id,
    }),
    department: "kitchen",
    status: "in_progress",
    completionRule: settings.completionRule,
    startedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lowStockCount: 0,
    itemCount: 0,
    completedCount: 0,
    reopenedCount: 0,
    reopenedAt: null,
    reopenedBy: null,
  });

  return sessionRef.id;
}

export async function ensureKitchenSession({
  userId,
  userName,
  role,
  storeId,
  storeLabel,
  date,
  shift,
  settings,
}) {
  const existing = await findKitchenSession({
    storeId,
    date,
    userId,
    shiftId: shift?.id,
    completionRule: settings.completionRule,
  });

  if (existing) return existing;

  const sessionId = await createKitchenSession({
    userId,
    userName,
    role,
    storeId,
    storeLabel,
    date,
    shift,
    settings,
  });

  const created = await getDoc(doc(db, "stockTakeSessions", sessionId));
  return { id: sessionId, ...created.data() };
}

export async function loadKitchenSessionEntries(sessionId) {
  const snap = await getDocs(
    query(collection(db, "stockTakeSessions", sessionId, "entries"), orderBy("updatedAt", "asc"))
  );
  return snap.docs.map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() }));
}

export async function saveKitchenSessionEntry({
  sessionId,
  date,
  item,
  status,
  customRatio,
  customValue,
  note,
  userId,
  userName,
}) {
  const entryRef = doc(db, "stockTakeSessions", sessionId, "entries", item.id);
  await setDoc(
    entryRef,
    {
      itemId: item.id,
      itemName: item.name || item.id,
      itemCode: item.code || "",
      location: item.location || item.shelf || "",
      shelf: item.shelf || "",
      category: item.category || "",
      storeId: item.storeId,
      sessionId,
      date,
      department: "kitchen",
      status,
      customRatio: Number.isFinite(Number(customRatio)) ? Number(customRatio) : null,
      customValue: customValue || "",
      note: note || "",
      lowStock: isKitchenStockLow(status, customRatio),
      enteredBy: userId,
      enteredByName: userName || "Kitchen Staff",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function syncKitchenSessionSummary(sessionId, itemCount) {
  const entries = await loadKitchenSessionEntries(sessionId);
  const completedCount = entries.filter((entry) => entry.status).length;
  const lowStockCount = entries.filter((entry) => entry.lowStock).length;
  const status = itemCount > 0 && completedCount >= itemCount ? "completed" : "in_progress";

  await updateDoc(doc(db, "stockTakeSessions", sessionId), {
    itemCount,
    completedCount,
    lowStockCount,
    status,
    completedAt: status === "completed" ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });

  return {
    completedCount,
    lowStockCount,
    status,
  };
}

export async function reopenKitchenSession({ sessionId, reopenedBy }) {
  await updateDoc(doc(db, "stockTakeSessions", sessionId), {
    status: "in_progress",
    reopenedAt: serverTimestamp(),
    reopenedBy: reopenedBy || "Manager",
    reopenedCount: 1,
    completedAt: null,
    updatedAt: serverTimestamp(),
  });
}
