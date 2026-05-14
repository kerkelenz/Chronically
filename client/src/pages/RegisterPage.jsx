import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/register`,
        { username, email, password },
      );
      login(response.data.user, response.data.token);
      navigate("/dashboard");
    } catch (error) {
      setError(
        error.response?.data?.error ||
          "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
      }}
    >
      <div
        className="petal"
        style={{
          left: "10%",
          animationDuration: "8s",
          animationDelay: "0s",
          bottom: "-10px",
        }}
      />
      <div
        className="petal"
        style={{
          left: "25%",
          animationDuration: "11s",
          animationDelay: "2s",
          bottom: "-10px",
        }}
      />
      <div
        className="petal"
        style={{
          left: "50%",
          animationDuration: "9s",
          animationDelay: "4s",
          bottom: "-10px",
        }}
      />
      <div
        className="petal"
        style={{
          left: "70%",
          animationDuration: "12s",
          animationDelay: "1s",
          bottom: "-10px",
        }}
      />
      <div
        className="petal"
        style={{
          left: "85%",
          animationDuration: "10s",
          animationDelay: "3s",
          bottom: "-10px",
        }}
      />

      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: "200px",
          height: "200px",
          background: "#5C4E8A",
          filter: "blur(60px)",
          top: "-50px",
          left: "-50px",
        }}
      />
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: "150px",
          height: "150px",
          background: "#DEC8DA",
          filter: "blur(50px)",
          top: "50px",
          right: "-30px",
        }}
      />
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: "180px",
          height: "180px",
          background: "#9B8EC4",
          filter: "blur(55px)",
          bottom: "80px",
          left: "20px",
        }}
      />
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: "130px",
          height: "130px",
          background: "#C4A8C0",
          filter: "blur(45px)",
          bottom: "-20px",
          right: "40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-xs px-4">
        <h1
          className="text-3xl font-medium text-white"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Chronically
        </h1>
        <p className="text-xs text-white opacity-70">
          your daily companion for the chronic life.
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col gap-3 p-5 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.22)",
            border: "1px solid rgba(255,255,255,0.4)",
          }}
        >
          <p className="text-white font-medium text-sm">Create account</p>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/60 outline-none glass-input transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.32)",
            }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/60 outline-none glass-input transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.32)",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/60 outline-none glass-input transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.32)",
            }}
          />

          {error && <p className="text-red-200 text-xs">{error}</p>}

          <button
            type="submit"
            className="w-full py-2 rounded-full bg-white font-medium text-sm mt-1 hover:scale-105 transition-all duration-200 shockwave-btn"
            style={{ color: "#7C6BAE" }}
          >
            Create Account
          </button>
        </form>

        <p className="text-white/70 text-xs">
          Already have an account?{" "}
          <span
            className="text-white cursor-pointer underline"
            onClick={() => navigate("/login")}
          >
            Log in
          </span>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
