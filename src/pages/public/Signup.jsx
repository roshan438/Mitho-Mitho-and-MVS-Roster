import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  serverTimestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import { googleProvider } from "../../firebase/authProviders";
import { useToast } from "../../context/ToastContext";
import getFirebaseErrorMessage from "../../utils/getFirebaseErrorMessage";
import "./Signup.css";

export default function Signup() {
  const nav = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);

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
      { label: "Strong", color: "#52c41a" },
    ];

    return { score, ...(results[score - 1] || results[0]) };
  }, [pass]);

  function validateProfileFields() {
    if (!firstName.trim()) return "First name is required";
    if (!lastName.trim()) return "Last name is required";
    if (!dob) return "Date of birth is required";
    if (!phone.trim()) return "Phone is required";
    if (!addressLine1.trim()) return "Address is required";
    if (!suburb.trim()) return "Suburb is required";
    if (!postcode.trim()) return "Postcode is required";
    if (!emergencyName.trim()) return "Emergency contact name is required";
    if (!emergencyPhone.trim()) return "Emergency contact phone is required";
    if (!emergencyRelationship.trim()) return "Emergency relationship is required";
    return null;
  }

  async function upsertProfile(uid, authEmail) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    const payload = {
      uid,
      email: authEmail || email || "",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob,
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      suburb: suburb.trim(),
      state,
      postcode: postcode.trim(),
      emergencyName: emergencyName.trim(),
      emergencyPhone: emergencyPhone.trim(),
      emergencyRelationship: emergencyRelationship.trim(),
      taxInProgress,
      role: "staff",
      status: "pending",
      profileComplete: true,
      hourlyRate: null,
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(ref, payload, { merge: true });
  }

  async function onEmailSignup(e) {
    e.preventDefault();

    const validationError = validateProfileFields();
    if (validationError) return showToast(validationError, "error");

    if (pass !== confirmPass) {
      return showToast("Passwords do not match", "error");
    }

    if (pass.length < 6) {
      return showToast("Password should be at least 6 characters", "error");
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      await updateProfile(cred.user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });

      await upsertProfile(cred.user.uid, cred.user.email);

      showToast("Account created. Waiting for admin approval.", "success");
      nav("/pending");
    } catch (err) {
      showToast(getFirebaseErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignup() {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);

      const ref = doc(db, "users", cred.user.uid);
      const snap = await getDoc(ref);
      const profile = snap.exists() ? snap.data() : null;

      if (profile?.role === "admin") {
        showToast("Welcome back, admin.", "success");
        nav("/admin/dashboard");
        return;
      }

      showToast("Google sign-in successful. Complete your profile next.", "success", {
        title: "Almost done",
      });
      nav("/complete-profile");
    } catch (err) {
      showToast(getFirebaseErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-wrapper signup-wrapper">
      <div className="auth-container signup-container">
        <header className="auth-header">
          <h1 className="auth-title">Staff Onboarding</h1>
          <p className="auth-subtitle">Create your account to join the team</p>
        </header>

        <main className="auth-card">
          <button
            type="button"
            className="btn-google"
            onClick={onGoogleSignup}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              textAlign: "center",
              marginTop: "10px",
              marginBottom: "6px",
            }}
          >
            Google signup will take you to complete your profile next
          </div>

          <div className="auth-divider">
            <span>or sign up with email</span>
          </div>

          <form onSubmit={onEmailSignup} className="auth-form">
            <h3 className="form-section-title">Personal Information</h3>
            <div className="form-grid">
              <Field label="First Name">
                <input className="auth-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </Field>

              <Field label="Last Name">
                <input className="auth-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </Field>

              <Field label="D.O.B">
                <input className="auth-input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
              </Field>

              <Field label="Phone">
                <input className="auth-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </Field>
            </div>

            <h3 className="form-section-title">Residential Address</h3>
            <Field label="Address Line 1">
              <input className="auth-input" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
            </Field>

            <div className="form-grid">
              <Field label="Suburb">
                <input className="auth-input" value={suburb} onChange={(e) => setSuburb(e.target.value)} required />
              </Field>

              <Field label="State">
                <select className="auth-input" value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="NSW">NSW</option>
                  <option value="VIC">VIC</option>
                  <option value="QLD">QLD</option>
                  <option value="WA">WA</option>
                  <option value="SA">SA</option>
                  <option value="TAS">TAS</option>
                </select>
              </Field>

              <Field label="Postcode">
                <input className="auth-input" value={postcode} onChange={(e) => setPostcode(e.target.value)} required />
              </Field>
            </div>

            <h3 className="form-section-title">Emergency Contact</h3>
            <Field label="Full Name">
              <input className="auth-input" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} required />
            </Field>

            <div className="form-grid">
              <Field label="Phone">
                <input className="auth-input" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} required />
              </Field>

              <Field label="Relationship">
                <input className="auth-input" value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)} required />
              </Field>
            </div>

            <div className="tax-toggle">
              <input type="checkbox" id="tax" checked={taxInProgress} onChange={(e) => setTaxInProgress(e.target.checked)} />
              <label htmlFor="tax">TFN / Tax paperwork in progress</label>
            </div>

            <h3 className="form-section-title">Account Credentials</h3>
            <div className="form-grid">
              <Field label="Email">
                <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>

              <div className="input-group">
                <div className="label-row" style={{ display: "flex", justifyContent: "space-between" }}>
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
                  className="auth-input"
                  type={showPass ? "text" : "password"}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                />

                {pass && (
                  <div className="strength-meter" style={{ marginTop: "8px" }}>
                    <div
                      style={{
                        height: "4px",
                        width: "100%",
                        backgroundColor: "#eee",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(strength.score / 4) * 100}%`,
                          backgroundColor: strength.color,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "11px", color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <Field label="Confirm Password">
                <input
                  className="auth-input"
                  type={showPass ? "text" : "password"}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  required
                />
                {confirmPass && pass !== confirmPass && (
                  <span style={{ fontSize: "11px", color: "#ff4d4d" }}>
                    Passwords do not match
                  </span>
                )}
              </Field>
            </div>

            <button className="btn-brand signup-submit" type="submit" disabled={loading}>
              {loading ? <div className="spinner-small"></div> : "Create Account"}
            </button>
          </form>
        </main>

        <footer className="auth-footer">
          <p>
            Already joined? <Link to="/login" className="text-link">Sign In</Link>
          </p>
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
