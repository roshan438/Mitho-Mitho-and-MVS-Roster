import { useAuth } from "./AuthProvider";

export function useAuthUser() {
  const { fbUser, profile, loading } = useAuth();

  const role = profile?.role || null;       // "admin" | "staff"
  const status = profile?.status || null;   // "pending" | "approved" | "rejected"

  return { fbUser, profile, role, status, loading };
}