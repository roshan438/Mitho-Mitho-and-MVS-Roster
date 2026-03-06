export default function getFirebaseErrorMessage(error) {
    const code = error?.code || "";
  
    switch (code) {
      case "auth/email-already-in-use":
        return "That email is already being used.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/user-not-found":
        return "No account found with that email.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email or password is incorrect.";
      case "auth/weak-password":
        return "Password is too weak.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a bit and try again.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled.";
      case "auth/popup-blocked":
        return "Google popup was blocked by your browser.";
      case "auth/network-request-failed":
        return "Network issue. Please check your internet and try again.";
      case "auth/missing-email":
        return "Please enter your email address.";
      default:
        return error?.message || "Something went wrong. Please try again.";
    }
  }