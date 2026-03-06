// import { useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
// import { auth } from "../../firebase/firebase";
// import { googleProvider } from "../../firebase/authProviders";
// import { useToast } from "../../context/ToastContext";
// import Forgot from "./Forgot";
// import "./Login.css";

// export default function Login() {
//   const nav = useNavigate();
//   const { showToast } = useToast();
//   const [email, setEmail] = useState("");
//   const [pass, setPass] = useState("");
//   const [showPass, setShowPass] = useState(false);
//   const [loading, setLoading] = useState(false);

//   async function onEmailLogin(e) {
//     e.preventDefault();
//     if (!email || !pass) return showToast("Please fill in all fields", "info");
    
//     setLoading(true);
//     try {
//       await signInWithEmailAndPassword(auth, email, pass);
//       showToast("Welcome back!", "success");
//       nav("/"); 
//     } catch (err) {
//       showToast(err?.message || "Login failed", "error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function onGoogle() {
//     setLoading(true);
//     try {
//       await signInWithPopup(auth, googleProvider);
//       showToast("Signed in with Google", "success");
//       nav("/");
//     } catch (err) {
//       showToast(err?.message || "Google sign-in failed", "error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <div className="auth-page-wrapper">
//       <div className="auth-container">
//         <header className="auth-header">
//           <div className="brand-logo"></div>
//           <h1 className="auth-title">Welcome back</h1>
//           <p className="auth-subtitle">Sign in to go to your Dashboard.</p>
//         </header>

//         <main className="auth-card">
//           {/* <button className="btn-google" onClick={onGoogle} disabled={loading}>
//             <svg width="20" height="20" viewBox="0 0 24 24">
//               <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
//               <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
//               <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
//               <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
//             </svg>
//             Continue with Google
//           </button> */}

//           <div className="auth-divider"><span>or email</span></div>

//           <form className="auth-form" onSubmit={onEmailLogin}>
//             <div className="input-group login">
//               <label>Email Address</label>
//               <input 
//                 type="email" 
//                 className="auth-input" 
//                 placeholder="name@company.com"
//                 value={email} 
//                 onChange={(e)=>setEmail(e.target.value)} 
//                 disabled={loading}
//               />
//             </div>

//             <div className="input-group login">
//               <div className="label-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//                 <label>Password</label>
//                 <div style={{ display: 'flex', gap: '10px' }}>
//                   <button 
//                     type="button" 
//                     className="text-link small" 
//                     onClick={() => setShowPass(!showPass)}
//                     style={{ background: 'none', border: 'none', cursor: 'pointer' }}
//                   >
//                     {showPass ? "Hide" : "Show"}
//                   </button>
//                 </div>
//               </div>
//               <input 
//                 type={showPass ? "text" : "password"} 
//                 className="auth-input" 
//                 placeholder="••••••••"
//                 value={pass} 
//                 onChange={(e)=>setPass(e.target.value)} 
//                 disabled={loading}
//               />
//             </div>

//             <button className="btn-brand auth-submit" type="submit" disabled={loading}>
//               {loading ? <div className="spinner-small"></div> : "Sign In"}
//             </button>

//             <Link  to="/forgot" className="text-link small" >Forgot?</Link>
//           </form>
//         </main>

//         <footer className="auth-footer">
//           <p>New staff member? <Link to="/signup" className="text-link">Create an account</Link></p>
//         </footer>
//       </div>
//     </div>
//   );
// }










import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import { googleProvider } from "../../firebase/authProviders";
import { useToast } from "../../context/ToastContext";
import getFirebaseErrorMessage from "../../utils/getFirebaseErrorMessage";
import "./Login.css";

export default function Login() {
  const nav = useNavigate();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function routeUser(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    const profile = snap.exists() ? snap.data() : null;

    if (!profile?.profileComplete) {
      showToast("Please complete your profile to continue.", "info", {
        title: "Profile incomplete",
      });
      nav("/complete-profile");
      return;
    }

    if (profile?.role === "admin") {
      showToast("Welcome back, admin.", "success", {
        title: "Signed in",
      });
      nav("/admin/dashboard");
      return;
    }

    if (profile?.status === "approved") {
      showToast("Welcome back.", "success", {
        title: "Signed in",
      });
      nav("/staff/today");
      return;
    }

    if (profile?.status === "rejected") {
      showToast("Your account is not approved right now.", "warning", {
        title: "Access limited",
      });
      nav("/pending");
      return;
    }

    showToast("Your account is waiting for approval.", "info", {
      title: "Pending approval",
    });
    nav("/pending");
  }

  async function onEmailLogin(e) {
    e.preventDefault();

    if (!email.trim() || !pass.trim()) {
      return showToast("Please enter both email and password.", "warning", {
        title: "Missing details",
      });
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      await routeUser(cred.user.uid);
    } catch (err) {
      showToast(getFirebaseErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      showToast("Google sign-in successful.", "success", {
        title: "Signed in",
      });
      await routeUser(cred.user.uid);
    } catch (err) {
      showToast(getFirebaseErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        <header className="auth-header">
          <div className="brand-logo"></div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to continue to your dashboard.</p>
        </header>

        <main className="auth-card">
          <button
            className="btn-google"
            onClick={onGoogle}
            disabled={loading}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="auth-divider">
            <span>or sign in with email</span>
          </div>

          <form className="auth-form" onSubmit={onEmailLogin}>
            <div className="input-group login">
              <label>Email Address</label>
              <input
                type="email"
                className="auth-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="input-group login">
              <div
                className="label-row"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <label>Password</label>
                <button
                  type="button"
                  className="text-link small"
                  onClick={() => setShowPass(!showPass)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>

              <input
                type={showPass ? "text" : "password"}
                className="auth-input"
                placeholder="••••••••"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <button className="btn-brand auth-submit" type="submit" disabled={loading}>
              {loading ? <div className="spinner-small"></div> : "Sign In"}
            </button>

            <Link to="/forgot" className="text-link small">
              Forgot password?
            </Link>
          </form>
        </main>

        <footer className="auth-footer">
          <p>
            New staff member? <Link to="/signup" className="text-link">Create an account</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}