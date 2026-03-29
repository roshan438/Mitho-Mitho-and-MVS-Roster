const PREFIX = "mvs_admin_saved_views";
const MAX_VIEWS = 6;

function storageKey(scope) {
  return `${PREFIX}:${scope}`;
}

export function loadSavedViews(scope) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedView(scope, name, filters) {
  if (typeof window === "undefined") return [];

  const existing = loadSavedViews(scope).filter((view) => view.name !== name);
  const next = [
    {
      id: `${Date.now()}`,
      name,
      filters,
      updatedAt: Date.now(),
    },
    ...existing,
  ].slice(0, MAX_VIEWS);

  window.localStorage.setItem(storageKey(scope), JSON.stringify(next));
  return next;
}

export function deleteSavedView(scope, id) {
  if (typeof window === "undefined") return [];
  const next = loadSavedViews(scope).filter((view) => view.id !== id);
  window.localStorage.setItem(storageKey(scope), JSON.stringify(next));
  return next;
}
