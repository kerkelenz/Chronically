import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, { email });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
      }}
    >
      <div className="petal" style={{ left: "10%", animationDuration: "8s", animationDelay: "0s", bottom: "-10px" }} />
      <div className="petal" style={{ left: "30%", animationDuration: "11s", animationDelay: "2s", bottom: "-10px" }} />
      <div className="petal" style={{ left: "60%", animationDuration: "9s", animationDelay: "4s", bottom: "-10px" }} />
      <div className="petal" style={{ left: "80%", animationDuration: "12s", animationDelay: "1s", bottom: "-10px" }} />

      <div className="absolute rounded-full opacity-30" style={{ width: "200px", height: "200px", background: "#5C4E8A", filter: "blur(60px)", top: "-50px", left: "-50px" }} />
      <div className="absolute rounded-full opacity-30" style={{ width: "150px", height: "150px", background: "#DEC8DA", filter: "blur(50px)", top: "50px", right: "-30px" }} />
      <div className="absolute rounded-full opacity-30" style={{ width: "180px", height: "180px", background: "#9B8EC4", filter: "blur(55px)", bottom: "80px", left: "20px" }} />
      <div className="absolute rounded-full opacity-30" style={{ width: "130px", height: "130px", background: "#C4A8C0", filter: "blur(45px)", bottom: "-20px", right: "40px" }} />

      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-xs px-4">
        <h1 className="text-3xl font-medium text-white" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
          Chronically
        </h1>
        <p className="text-xs text-white opacity-70">your daily companion for the chronic life.</p>

        <div
          className="w-full flex flex-col gap-3 p-5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.4)" }}
        >
          {submitted ? (
            <>
              <p className="text-white font-medium text-sm">Check your email</p>
              <p className="text-white/80 text-xs leading-relaxed">
                If that email is registered, we've sent a reset link. It expires in 1 hour.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-2 rounded-full bg-white font-medium text-sm mt-1 hover:scale-105 transition-all duration-200 shockwave-btn"
                style={{ color: "#7C6BAE" }}
              >
                Back to log in
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-white font-medium text-sm">Reset your password</p>
              <p className="text-white/70 text-xs">Enter your email and we'll send you a reset link.</p>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/60 outline-none glass-input transition-all duration-300"
                style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.32)" }}
              />
              {error && <p className="text-red-200 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-full bg-white font-medium text-sm mt-1 hover:scale-105 transition-all duration-200 shockwave-btn"
                style={{ color: "#7C6BAE", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(124,107,174,0.3)", borderTopColor: "#7C6BAE" }} />
                    Sending...
                  </div>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-white/70 text-xs">
          Remember your password?{" "}
          <span className="text-white cursor-pointer underline" onClick={() => navigate("/login")}>
            Log in
          </span>
        </p>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
