import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, updateUser } = useAuth();

  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/profile`,
        { username, email },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateUser({ ...user, username, email });
      setSuccess("Profile updated successfully");
      setError("");
    } catch (error) {
      setError(error.response?.data?.error || "Something went wrong");
      setSuccess("");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAF7FF" }}>
      <div
        className="w-full px-6 py-6 flex flex-col items-center gap-2"
        style={{ background: "linear-gradient(135deg, #5C4E8A, #7C6BAE)" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-medium"
          style={{
            background: "rgba(255,255,255,0.25)",
            border: "2px solid rgba(255,255,255,0.5)",
            color: "white",
          }}
        >
          {user?.username?.slice(0, 2).toUpperCase()}
        </div>
        <p
          className="text-white font-medium"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {user?.username}
        </p>
        <p className="text-white/70 text-sm">{user?.email}</p>
      </div>
      {/* settings form */}
      <div className="p-6 flex flex-col gap-4">
        <form onSubmit={handleUpdate} className="flex flex-col gap-3">
          <div
            className="p-4 rounded-2xl"
            style={{ background: "white", border: "1px solid #DDD5EE" }}
          >
            <p
              className="text-xs mb-3 uppercase tracking-wide"
              style={{ color: "#6B5F7A" }}
            >
              Account
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs mb-1" style={{ color: "#6B5F7A" }}>
                  Username
                </p>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200"
                  style={{
                    background: "#F0EBF8",
                    border: "1px solid #DDD5EE",
                    color: "#2D2540",
                  }}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#6B5F7A" }}>
                  Email
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200"
                  style={{
                    background: "#F0EBF8",
                    border: "1px solid #DDD5EE",
                    color: "#2D2540",
                  }}
                />
              </div>
            </div>
          </div>

          {success && (
            <p className="text-xs text-center" style={{ color: "#7FAF8A" }}>
              {success}
            </p>
          )}
          {error && (
            <p className="text-xs text-center" style={{ color: "#B07088" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-full text-white font-medium hover:scale-105 transition-all duration-200"
            style={{ background: "linear-gradient(135deg, #7C6BAE, #9B8EC4)" }}
          >
            Save changes
          </button>
        </form>

        {/* session and danger */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "white", border: "1px solid #DDD5EE" }}
        >
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="w-full px-4 py-3 text-left text-sm flex justify-between items-center hover:bg-gray-50 transition-colors"
            style={{ color: "#6B5F7A", borderBottom: "1px solid #F0EBF8" }}
          >
            Log out
            <span style={{ color: "#DDD5EE" }}>›</span>
          </button>
          <button
            className="w-full px-4 py-3 text-left text-sm flex justify-between items-center hover:bg-gray-50 transition-colors"
            style={{ color: "#B07088" }}
          >
            Delete account
            <span style={{ color: "#B07088" }}>›</span>
          </button>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="text-xs text-center hover:opacity-80 transition-opacity"
          style={{ color: "#6B5F7A" }}
        >
          ← Back to dashboard
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;
