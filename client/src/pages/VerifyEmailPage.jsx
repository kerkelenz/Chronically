import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { login } = useAuth();

  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    axios
      .post(`${import.meta.env.VITE_API_URL}/api/auth/verify-email`, { token })
      .then((res) => {
        login(res.data.user, res.data.token);
        setStatus("success");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Verification failed. Please try again.");
        setStatus("error");
      });
  }, []);

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

        <div
          className="w-full flex flex-col gap-3 p-5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.4)" }}
        >
          {status === "verifying" && (
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
              <p className="text-white text-sm">Verifying your email...</p>
            </div>
          )}

          {status === "success" && (
            <>
              <p className="text-white font-medium text-sm">Email verified!</p>
              <p className="text-white/80 text-xs">Taking you to your dashboard...</p>
            </>
          )}

          {(status === "error" || status === "invalid") && (
            <>
              <p className="text-white font-medium text-sm">Verification failed</p>
              <p className="text-red-200 text-xs">{error || "This link is missing or invalid."}</p>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-2 rounded-full bg-white font-medium text-sm mt-1 hover:scale-105 transition-all duration-200 shockwave-btn"
                style={{ color: "#7C6BAE" }}
              >
                Go to log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
