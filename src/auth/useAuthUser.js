




import { useAuth } from "./AuthProvider";

export function useAuthUser() {
  const { fbUser, profile, loading } = useAuth();

  const role = profile?.role || null;
  const status = profile?.status || null;

  const profileComplete =
    !!profile?.firstName?.trim() &&
    !!profile?.lastName?.trim() &&
    !!profile?.dob &&
    !!profile?.phone?.trim() &&
    !!profile?.addressLine1?.trim() &&
    !!profile?.suburb?.trim() &&
    !!profile?.postcode?.trim() &&
    !!profile?.emergencyName?.trim() &&
    !!profile?.emergencyPhone?.trim() &&
    !!profile?.emergencyRelationship?.trim();

  return {
    fbUser,
    profile,
    role,
    status,
    loading,
    profileComplete,
  };
}