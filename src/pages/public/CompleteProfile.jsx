import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import { useToast } from "../../context/ToastContext";
import getFirebaseErrorMessage from "../../utils/getFirebaseErrorMessage";

export default function CompleteProfile() {
  const nav = useNavigate();
  const { showToast } = useToast();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    async function loadExistingData() {
      if (!user) return;

      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setDob(data.dob || "");
        setPhone(data.phone || "");
        setAddressLine1(data.addressLine1 || "");
        setSuburb(data.suburb || "");
        setState(data.state || "NSW");
        setPostcode(data.postcode || "");
        setEmergencyName(data.emergencyName || "");
        setEmergencyPhone(data.emergencyPhone || "");
        setEmergencyRelationship(data.emergencyRelationship || "");
        setTaxInProgress(data.taxInProgress ?? true);
      }
    }

    loadExistingData();
  }, [user]);

  function validateFields() {
    if (!firstName.trim()) return "First name is required";
    if (!lastName.trim()) return "Last name is required";
    if (!dob) return "Date of birth is required";
    if (!phone.trim()) return "Phone number is required";
    if (!addressLine1.trim()) return "Address is required";
    if (!suburb.trim()) return "Suburb is required";
    if (!postcode.trim()) return "Postcode is required";
    if (!emergencyName.trim()) return "Emergency contact name is required";
    if (!emergencyPhone.trim()) return "Emergency contact phone is required";
    if (!emergencyRelationship.trim()) return "Emergency relationship is required";
    return null;
  }

  async function onSave(e) {
    e.preventDefault();

    if (!user) {
      showToast("Session expired. Please login again.", "error");
      return nav("/login");
    }

    const error = validateFields();
    if (error) {
      return showToast(error, "warning", { title: "Missing information" });
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const existingSnap = await getDoc(userRef);
      const existingData = existingSnap.exists() ? existingSnap.data() : {};

      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
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
          profileComplete: true,
          role: existingData.role || "staff",
          status: existingData.status || "pending",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast("Profile completed successfully.", "success", {
        title: "All set",
      });

      nav("/pending");
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
          <h1 className="auth-title">Complete Your Profile</h1>
          <p className="auth-subtitle">
            Please finish your details to continue.
          </p>
        </header>

        <main className="auth-card">
          <form onSubmit={onSave} className="auth-form">

            <Section title="Personal Information">
              <Field label="First Name">
                <input className="auth-input" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </Field>

              <Field label="Last Name">
                <input className="auth-input" value={lastName} onChange={e => setLastName(e.target.value)} />
              </Field>

              <Field label="Date of Birth">
                <input type="date" className="auth-input" value={dob} onChange={e => setDob(e.target.value)} />
              </Field>

              <Field label="Phone">
                <input className="auth-input" value={phone} onChange={e => setPhone(e.target.value)} />
              </Field>
            </Section>

            <Section title="Address">
              <Field label="Address Line 1">
                <input className="auth-input" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
              </Field>

              <Field label="Suburb">
                <input className="auth-input" value={suburb} onChange={e => setSuburb(e.target.value)} />
              </Field>

              <Field label="State">
                <select className="auth-input" value={state} onChange={e => setState(e.target.value)}>
                  <option value="NSW">NSW</option>
                  <option value="VIC">VIC</option>
                  <option value="QLD">QLD</option>
                  <option value="WA">WA</option>
                  <option value="SA">SA</option>
                  <option value="TAS">TAS</option>
                </select>
              </Field>

              <Field label="Postcode">
                <input className="auth-input" value={postcode} onChange={e => setPostcode(e.target.value)} />
              </Field>
            </Section>

            <Section title="Emergency Contact">
              <Field label="Full Name">
                <input className="auth-input" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} />
              </Field>

              <Field label="Phone">
                <input className="auth-input" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} />
              </Field>

              <Field label="Relationship">
                <input className="auth-input" value={emergencyRelationship} onChange={e => setEmergencyRelationship(e.target.value)} />
              </Field>
            </Section>

            <div className="tax-toggle">
              <input
                type="checkbox"
                checked={taxInProgress}
                onChange={e => setTaxInProgress(e.target.checked)}
              />
              <label>TFN / Tax paperwork in progress</label>
            </div>

            <button className="btn-brand" type="submit" disabled={loading}>
              {loading ? <div className="spinner-small"></div> : "Save & Continue"}
            </button>

          </form>
        </main>
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

function Section({ title, children }) {
  return (
    <>
      <h3 className="form-section-title">{title}</h3>
      <div className="form-grid">{children}</div>
    </>
  );
}
