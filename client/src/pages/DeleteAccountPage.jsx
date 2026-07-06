import { useState } from "react";
import axios from "axios";

export default function DeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) { setError("Please enter your account email."); return; }
    setSending(true); setError("");
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/account-deletion`, { email, reason, website });
      setSent(true);
    } catch (e) {
      setError(e.response?.data?.error || "Something went wrong. Please email privacy@mychronically.app.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#7C6BAE,#9B8EC4 55%,#C4A8C0)", padding: "40px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, padding: 32, backdropFilter: "blur(10px)" }}>
        <h1 style={{ fontFamily: "Playfair Display, Georgia, serif", color: "white", fontSize: 30, marginBottom: 16 }}>
          Delete your account
        </h1>
        <p style={{ color: "rgba(255,255,255,0.9)", lineHeight: 1.6, marginBottom: 12 }}>
          You can permanently delete your Chronically account and all of your data at any time. This includes your
          daily check-ins, symptom logs, medications and medication history, doctor appointments, and Spoon Center
          data. Deletion is permanent and cannot be undone — we do not keep a backup copy.
        </p>

        <h2 style={{ fontFamily: "Playfair Display, Georgia, serif", color: "white", fontSize: 20, marginTop: 24, marginBottom: 8 }}>
          The fastest way — in the app
        </h2>
        <p style={{ color: "rgba(255,255,255,0.9)", lineHeight: 1.6, marginBottom: 12 }}>
          If you're signed in, open Chronically, go to <strong>Profile</strong>, and tap <strong>Delete account</strong>.
          Your account and all associated data are removed immediately.
        </p>

        <h2 style={{ fontFamily: "Playfair Display, Georgia, serif", color: "white", fontSize: 20, marginTop: 24, marginBottom: 8 }}>
          Request deletion here
        </h2>
        <p style={{ color: "rgba(255,255,255,0.9)", lineHeight: 1.6, marginBottom: 16 }}>
          If you no longer have the app or can't sign in, enter the email address on your account and we'll delete your
          account and all associated data within 30 days, then confirm by email.
        </p>

        {sent ? (
          <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 14, padding: 20 }}>
            <p style={{ color: "white", lineHeight: 1.6 }}>
              Request received. We'll delete the account associated with <strong>{email}</strong> and confirm by email.
              If you don't hear back within 30 days, contact privacy@mychronically.app.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* honeypot: hidden from users, hidden from screen readers */}
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              value={website} onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
            />
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Your account email"
              style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", color: "white", fontSize: 15 }}
            />
            <textarea
              value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Reason (optional)"
              style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", color: "white", fontSize: 15, resize: "none" }}
            />
            {error && <p style={{ color: "#FFD6D6", fontSize: 14 }}>{error}</p>}
            <button
              onClick={submit} disabled={sending}
              style={{ padding: "12px", borderRadius: 24, border: "none", background: "white", color: "#5A3A60", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: sending ? 0.7 : 1 }}
            >
              {sending ? "Sending…" : "Request deletion"}
            </button>
          </div>
        )}

        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 20 }}>
          Questions? Email privacy@mychronically.app.
        </p>
      </div>
    </div>
  );
}
