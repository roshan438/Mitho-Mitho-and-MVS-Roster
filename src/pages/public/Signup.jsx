// import { useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
// import { doc, serverTimestamp, setDoc } from "firebase/firestore";
// import { auth, db } from "../../firebase/firebase";
// import { googleProvider } from "../../firebase/authProviders";
// import "./Signup.css";

// export default function Signup() {
//   const nav = useNavigate();
//   const [err, setErr] = useState("");

//   // auth
//   const [email, setEmail] = useState("");
//   const [pass, setPass] = useState("");

//   // onboarding
//   const [firstName, setFirstName] = useState("");
//   const [lastName, setLastName] = useState("");
//   const [dob, setDob] = useState("");
//   const [phone, setPhone] = useState("");

//   const [addressLine1, setAddressLine1] = useState("");
//   const [suburb, setSuburb] = useState("");
//   const [state, setState] = useState("NSW");
//   const [postcode, setPostcode] = useState("");

//   const [emergencyName, setEmergencyName] = useState("");
//   const [emergencyPhone, setEmergencyPhone] = useState("");
//   const [emergencyRelationship, setEmergencyRelationship] = useState("");

//   const [taxInProgress, setTaxInProgress] = useState(true);

//   async function upsertProfile(uid, authEmail) {
//     const ref = doc(db, "users", uid);
//     await setDoc(
//       ref,
//       {
//         email: authEmail || email || "",
//         firstName,
//         lastName,
//         dob,
//         phone,

//         addressLine1,
//         suburb,
//         state,
//         postcode,

//         emergencyName,
//         emergencyPhone,
//         emergencyRelationship,

//         taxInProgress,

//         role: "staff",
//         status: "pending",
//         hourlyRate: null, // admin sets on approval
//         createdAt: serverTimestamp(),
//         updatedAt: serverTimestamp(),
//       },
//       { merge: true }
//     );
//   }

//   async function onEmailSignup(e) {
//     e.preventDefault();
//     setErr("");
//     try {
//       const cred = await createUserWithEmailAndPassword(auth, email, pass);
//       await upsertProfile(cred.user.uid, cred.user.email);
//       nav("/pending");
//     } catch (e) {
//       setErr(e.message);
//     }
//   }

//   async function onGoogleSignup() {
//     setErr("");
//     try {
//       const cred = await signInWithPopup(auth, googleProvider);
//       await upsertProfile(cred.user.uid, cred.user.email);
//       nav("/pending");
//     } catch (e) {
//       setErr(e.message);
//     }
//   }

//   return (
//     <div className="container signup">
//       <div className="card signup-card">
//         <h1 className="h1">Staff Signup</h1>
//         <p className="p">Fill onboarding details. Admin must approve before you can use the dashboard.</p>

//         <div className="spacer" />

//         <button className="btn primary full" onClick={onGoogleSignup}>
//           Continue with Google
//         </button>

//         <div className="spacer" />
//         <div className="divider"><span>or</span></div>
//         <div className="spacer" />

//         <form onSubmit={onEmailSignup}>
//           <div className="grid">
//             <Field label="First name">
//               <input className="input" value={firstName} onChange={(e)=>setFirstName(e.target.value)} required />
//             </Field>
//             <Field label="Last name">
//               <input className="input" value={lastName} onChange={(e)=>setLastName(e.target.value)} required />
//             </Field>
//             <Field label="Date of birth">
//               <input className="input" type="date" value={dob} onChange={(e)=>setDob(e.target.value)} required />
//             </Field>
//             <Field label="Phone">
//               <input className="input" value={phone} onChange={(e)=>setPhone(e.target.value)} required />
//             </Field>

//             <Field label="Address line 1">
//               <input className="input" value={addressLine1} onChange={(e)=>setAddressLine1(e.target.value)} required />
//             </Field>
//             <Field label="Suburb">
//               <input className="input" value={suburb} onChange={(e)=>setSuburb(e.target.value)} required />
//             </Field>
//             <Field label="State">
//               <input className="input" value={state} onChange={(e)=>setState(e.target.value)} />
//             </Field>
//             <Field label="Postcode">
//               <input className="input" value={postcode} onChange={(e)=>setPostcode(e.target.value)} required />
//             </Field>

//             <Field label="Emergency contact name">
//               <input className="input" value={emergencyName} onChange={(e)=>setEmergencyName(e.target.value)} required />
//             </Field>
//             <Field label="Emergency contact phone">
//               <input className="input" value={emergencyPhone} onChange={(e)=>setEmergencyPhone(e.target.value)} required />
//             </Field>
//             <Field label="Relationship">
//               <input className="input" value={emergencyRelationship} onChange={(e)=>setEmergencyRelationship(e.target.value)} required />
//             </Field>

//             <div className="toggle">
//               <input
//                 id="tax"
//                 type="checkbox"
//                 checked={taxInProgress}
//                 onChange={(e)=>setTaxInProgress(e.target.checked)}
//               />
//               <label htmlFor="tax">Working on tax/TFN (in progress)</label>
//             </div>
//           </div>

//           <div className="spacer" />

//           <div className="grid">
//             <Field label="Email">
//               <input className="input" value={email} onChange={(e)=>setEmail(e.target.value)} required />
//             </Field>
//             <Field label="Password">
//               <input className="input" type="password" value={pass} onChange={(e)=>setPass(e.target.value)} required />
//             </Field>
//           </div>

//           {err && <div className="error">{err}</div>}

//           <div className="spacer" />
//           <button className="btn primary full" type="submit">Create account</button>
//         </form>

//         <div className="spacer" />
//         <div className="muted">
//           Already have account? <Link to="/login">Login</Link>
//         </div>
//       </div>
//     </div>
//   );
// }

// function Field({ label, children }) {
//   return (
//     <div className="field">
//       <div className="label">{label}</div>
//       {children}
//     </div>
//   );
// }











// import { useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
// import { doc, serverTimestamp, setDoc } from "firebase/firestore";
// import { auth, db } from "../../firebase/firebase";
// import { googleProvider } from "../../firebase/authProviders";
// import { useToast } from "../../context/ToastContext";
// import "./Signup.css";

// export default function Signup() {
//   const nav = useNavigate();
//   const { showToast } = useToast();
//   const [loading, setLoading] = useState(false);

//   // Auth
//   const [email, setEmail] = useState("");
//   const [pass, setPass] = useState("");

// const [confirmPass, setConfirmPass] = useState("");

//   // Onboarding
//   const [firstName, setFirstName] = useState("");
//   const [lastName, setLastName] = useState("");
//   const [dob, setDob] = useState("");
//   const [phone, setPhone] = useState("");
//   const [addressLine1, setAddressLine1] = useState("");
//   const [suburb, setSuburb] = useState("");
//   const [state, setState] = useState("NSW");
//   const [postcode, setPostcode] = useState("");
//   const [emergencyName, setEmergencyName] = useState("");
//   const [emergencyPhone, setEmergencyPhone] = useState("");
//   const [emergencyRelationship, setEmergencyRelationship] = useState("");
//   const [taxInProgress, setTaxInProgress] = useState(true);

//   async function upsertProfile(uid, authEmail) {
//     const ref = doc(db, "users", uid);
//     await setDoc(ref, {
//       email: authEmail || email || "",
//       firstName, lastName, dob, phone,
//       addressLine1, suburb, state, postcode,
//       emergencyName, emergencyPhone, emergencyRelationship,
//       taxInProgress,
//       role: "staff",
//       status: "pending",
//       hourlyRate: null,
//       createdAt: serverTimestamp(),
//       updatedAt: serverTimestamp(),
//     }, { merge: true });
//   }

//   async function onEmailSignup(e) {
//     e.preventDefault();
//     setLoading(true);
//     try {
//       const cred = await createUserWithEmailAndPassword(auth, email, pass);
//       await upsertProfile(cred.user.uid, cred.user.email);
//       showToast("Profile created! Waiting for approval.", "success");
//       nav("/pending");
//     } catch (err) {
//       showToast(err.message, "error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function onGoogleSignup() {
//     setLoading(true);
//     try {
//       const cred = await signInWithPopup(auth, googleProvider);
//       await upsertProfile(cred.user.uid, cred.user.email);
//       showToast("Google account linked!", "success");
//       nav("/pending");
//     } catch (err) {
//       showToast(err.message, "error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <div className="auth-page-wrapper signup-wrapper">
//       <div className="auth-container signup-container">
//         <header className="auth-header">
//           <h1 className="auth-title">Staff Onboarding</h1>
//           <p className="auth-subtitle">Complete your profile to join the team</p>
//         </header>

//         <main className="auth-card">
//           <button className="btn-google" onClick={onGoogleSignup} disabled={loading}>
//             <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
//             Signup with Google
//           </button>

//           <div className="auth-divider"><span>or fill details</span></div>

//           <form onSubmit={onEmailSignup} className="auth-form">
//             <h3 className="form-section-title">Personal Information</h3>
//             <div className="form-grid">
//               <Field label="First Name"><input className="auth-input" value={firstName} onChange={e=>setFirstName(e.target.value)} required /></Field>
//               <Field label="Last Name"><input className="auth-input" value={lastName} onChange={e=>setLastName(e.target.value)} required /></Field>
//               <Field label="D.O.B"><input className="auth-input" type="date" value={dob} onChange={e=>setDob(e.target.value)} required /></Field>
//               <Field label="Phone"><input className="auth-input" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required /></Field>
//             </div>

//             <h3 className="form-section-title">Residential Address</h3>
//             <Field label="Address Line 1"><input className="auth-input" value={addressLine1} onChange={e=>setAddressLine1(e.target.value)} required /></Field>
//             <div className="form-grid">
//               <Field label="Suburb"><input className="auth-input" value={suburb} onChange={e=>setSuburb(e.target.value)} required /></Field>
//               <Field label="State"><select className="auth-input" value={state} onChange={e=>setState(e.target.value)}><option value="NSW">NSW</option><option value="VIC">VIC</option><option value="QLD">QLD</option><option value="WA">WA</option><option value="SA">SA</option><option value="TAS">TAS</option></select></Field>
//             </div>

//             <h3 className="form-section-title">Emergency Contact</h3>
//             <Field label="Full Name"><input className="auth-input" value={emergencyName} onChange={e=>setEmergencyName(e.target.value)} required /></Field>
//             <div className="form-grid">
//               <Field label="Phone"><input className="auth-input" value={emergencyPhone} onChange={e=>setEmergencyPhone(e.target.value)} required /></Field>
//               <Field label="Relationship"><input className="auth-input" value={emergencyRelationship} onChange={e=>setEmergencyRelationship(e.target.value)} required /></Field>
//             </div>

//             <div className="tax-toggle">
//               <input type="checkbox" id="tax" checked={taxInProgress} onChange={e=>setTaxInProgress(e.target.checked)} />
//               <label htmlFor="tax">TFN / Tax paperwork in progress</label>
//             </div>

//             <h3 className="form-section-title">Account Credentials</h3>
//             <div className="form-grid">
//               <Field label="Email"><input className="auth-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></Field>
//               <Field label="Password"><input className="auth-input" type="password" value={pass} onChange={e=>setPass(e.target.value)} required /></Field>
              {/* <Field label="Confirm Password">
                <input 
                  className="auth-input" 
                  type={showPass ? "text" : "password"} 
                  value={confirmPass} 
                  onChange={e=>setConfirmPass(e.target.value)} 
                  required 
                />
                {confirmPass && pass !== confirmPass && (
                   <span style={{ fontSize: '11px', color: '#ff4d4d' }}>Passwords do not match</span>
                )}
              </Field> */}
//             </div>

//             <button className="btn-brand signup-submit" type="submit" disabled={loading}>
//               {loading ? <div className="spinner-small"></div> : "Create Account"}
//             </button>
//           </form>
//         </main>

//         <footer className="auth-footer">
//           <p>Already joined? <Link to="/login" className="text-link">Sign In</Link></p>
//         </footer>
//       </div>
//     </div>
//   );
// }

// function Field({ label, children }) {
//   return (
//     <div className="input-group">
//       <label>{label}</label>
//       {children}
//     </div>
//   );
// }






import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import { googleProvider } from "../../firebase/authProviders";
import { useToast } from "../../context/ToastContext";
import "./Signup.css";

export default function Signup() {
  const nav = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  // Auth States
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Profile States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("NSW");
  const [postcode, setPostcode] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [taxInProgress, setTaxInProgress] = useState(true);

  // Password Strength Logic
  const strength = useMemo(() => {
    if (!pass) return { score: 0, label: "", color: "#eee" };
    let score = 0;
    if (pass.length > 6) score++;
    if (pass.length > 10) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    const results = [
      { label: "Weak", color: "#ff4d4d" },
      { label: "Fair", color: "#ffa500" },
      { label: "Good", color: "#2db7f5" },
      { label: "Strong", color: "#52c41a" }
    ];
    return { score, ...results[score - 1] || results[0] };
  }, [pass]);

  async function upsertProfile(uid, authEmail) {
    const ref = doc(db, "users", uid);
    await setDoc(ref, {
      email: authEmail || email || "",
      firstName, lastName, dob, phone,
      addressLine1, suburb, state, postcode,
      emergencyName, emergencyPhone, emergencyRelationship,
      taxInProgress,
      role: "staff",
      status: "pending",
      hourlyRate: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async function onEmailSignup(e) {
    e.preventDefault();
    if (pass !== confirmPass) return showToast("Passwords do not match", "error");
    if (pass.length < 6) return showToast("Password should be at least 6 characters", "error");

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await upsertProfile(cred.user.uid, cred.user.email);
      showToast("Profile created! Waiting for approval.", "success");
      nav("/pending");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignup() {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await upsertProfile(cred.user.uid, cred.user.email);
      showToast("Google account linked!", "success");
      nav("/pending");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-wrapper signup-wrapper">
      <div className="auth-container signup-container">
        <header className="auth-header">
          <h1 className="auth-title">Staff Onboarding</h1>
          <p className="auth-subtitle">Complete your profile to join the team</p>
        </header>

        <main className="auth-card">
          {/* <button className="btn-google" onClick={onGoogleSignup} disabled={loading}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Signup with Google
          </button> */}

          <div className="auth-divider"><span>or fill details</span></div>

          <form onSubmit={onEmailSignup} className="auth-form">
            <h3 className="form-section-title">Personal Information</h3>
            <div className="form-grid">
              <Field label="First Name"><input className="auth-input" value={firstName} onChange={e=>setFirstName(e.target.value)} required /></Field>
              <Field label="Last Name"><input className="auth-input" value={lastName} onChange={e=>setLastName(e.target.value)} required /></Field>
              <Field label="D.O.B"><input className="auth-input" type="date" value={dob} onChange={e=>setDob(e.target.value)} required /></Field>
              <Field label="Phone"><input className="auth-input" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required /></Field>
            </div>

            <h3 className="form-section-title">Residential Address</h3>
            <Field label="Address Line 1"><input className="auth-input" value={addressLine1} onChange={e=>setAddressLine1(e.target.value)} required /></Field>
            <div className="form-grid">
              <Field label="Suburb"><input className="auth-input" value={suburb} onChange={e=>setSuburb(e.target.value)} required /></Field>
              <Field label="State">
                <select className="auth-input" value={state} onChange={e=>setState(e.target.value)}>
                  <option value="NSW">NSW</option>
                  <option value="VIC">VIC</option>
                  <option value="QLD">QLD</option>
                  <option value="WA">WA</option>
                  <option value="SA">SA</option>
                  <option value="TAS">TAS</option>
                </select>
              </Field>
              <Field label="Postcode"><input className="auth-input" value={postcode} onChange={e=>setPostcode(e.target.value)} required /></Field>
            </div>

            <h3 className="form-section-title">Emergency Contact</h3>
            <Field label="Full Name"><input className="auth-input" value={emergencyName} onChange={e=>setEmergencyName(e.target.value)} required /></Field>
            <div className="form-grid">
              <Field label="Phone"><input className="auth-input" value={emergencyPhone} onChange={e=>setEmergencyPhone(e.target.value)} required /></Field>
              <Field label="Relationship"><input className="auth-input" value={emergencyRelationship} onChange={e=>setEmergencyRelationship(e.target.value)} required /></Field>
            </div>

            <div className="tax-toggle">
              <input type="checkbox" id="tax" checked={taxInProgress} onChange={e=>setTaxInProgress(e.target.checked)} />
              <label htmlFor="tax">TFN / Tax paperwork in progress</label>
            </div>

            <h3 className="form-section-title">Account Credentials</h3>
            <div className="form-grid">
              <Field label="Email"><input className="auth-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></Field>
              
              <div className="input-group">
                <div className="label-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>Password</label>
                  <button type="button" className="text-link small" onClick={() => setShowPass(!showPass)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
                <input 
                  className="auth-input" 
                  type={showPass ? "text" : "password"} 
                  value={pass} 
                  onChange={e=>setPass(e.target.value)} 
                  required 
                />
                {pass && (
                  <div className="strength-meter" style={{ marginTop: '8px' }}>
                    <div style={{ height: '4px', width: '100%', backgroundColor: '#eee', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(strength.score / 4) * 100}%`, backgroundColor: strength.color, transition: 'width 0.3s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '11px', color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </div>

              <Field label="Confirm Password">
                <input 
                  className="auth-input" 
                  type={showPass ? "text" : "password"} 
                  value={confirmPass} 
                  onChange={e=>setConfirmPass(e.target.value)} 
                  required 
                />
                {confirmPass && pass !== confirmPass && (
                   <span style={{ fontSize: '11px', color: '#ff4d4d' }}>Passwords do not match</span>
                )}
              </Field>
            </div>

            <button className="btn-brand signup-submit" type="submit" disabled={loading}>
              {loading ? <div className="spinner-small"></div> : "Create Account"}
            </button>
          </form>
        </main>

        <footer className="auth-footer">
          <p>Already joined? <Link to="/login" className="text-link">Sign In</Link></p>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="input-group">
      <label>{label}</label>
      {children}
    </div>
  );
}