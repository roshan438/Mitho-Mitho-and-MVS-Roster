export default function getFirebaseErrorMessage(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Try signing in instead, or use a different email.";
    case "auth/invalid-email":
      return "That email address does not look right. Please check it and try again.";
    case "auth/user-not-found":
      return "We could not find an account with that email. Check the spelling or create a new account.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "The email or password does not match. Please try again carefully.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 6 characters so your account stays secure.";
    case "auth/too-many-requests":
      return "There have been too many attempts in a short time. Please wait a moment and try again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed before it finished. Open it again when you are ready.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Please allow pop-ups for this site and try again.";
    case "auth/network-request-failed":
      return "The connection dropped while we were talking to Firebase. Check your internet and try again.";
    case "auth/missing-email":
      return "Please enter your email address first.";
    case "permission-denied":
      return "You do not have permission for that action. If this seems wrong, ask an admin to review your access.";
    case "unavailable":
      return "The service is temporarily unavailable right now. Please wait a little and try again.";
    default:
      return error?.message || "Something went wrong on our side. Please try again in a moment.";
  }
}
