import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation, { NavHamburger } from "../components/Navigation";

function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, updateUser } = useAuth();

  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/users/account`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      logout();
      navigate("/");
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Something went wrong. Please try again.");
      setDeleteLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/profile`,
        { username, email },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateUser({ ...user, username, email: response.data.user.email });
      if (response.data.emailPending) {
        setEmail(user.email);
      }
      setSuccess(response.data.message);
      setError("");
    } catch (error) {
      setError(error.response?.data?.error || "Something went wrong");
      setSuccess("");
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background blobs */}
      <div className="absolute rounded-full opacity-20" style={{ width: "300px", height: "300px", background: "#5C4E8A", filter: "blur(80px)", top: "-50px", left: "-100px", pointerEvents: "none" }} />
      <div className="absolute rounded-full opacity-20" style={{ width: "250px", height: "250px", background: "#DEC8DA", filter: "blur(70px)", top: "200px", right: "-80px", pointerEvents: "none" }} />
      <div className="absolute rounded-full opacity-20" style={{ width: "200px", height: "200px", background: "#C4A8C0", filter: "blur(60px)", bottom: "100px", right: "-30px", pointerEvents: "none" }} />

      {/* Header */}
      <div className="relative z-20">
        <div className="px-6 pt-3 flex justify-end" style={{ maxWidth: "1024px", margin: "0 auto" }}>
          <NavHamburger />
        </div>
        <div className="px-6 pb-6 flex flex-col items-center gap-2" style={{ maxWidth: "480px", margin: "0 auto" }}>
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
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            {user?.username}
          </p>
          <p className="text-white/70 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* Settings form */}
      <div className="relative z-10 p-6 pb-20 flex flex-col gap-4" style={{ maxWidth: "480px", margin: "0 auto" }}>
        <form onSubmit={handleUpdate} className="flex flex-col gap-3">
          <div
            className="p-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            <p
              className="text-xs mb-3 uppercase tracking-wide"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Account
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Username</p>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200 placeholder-white/40"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Email</p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200 placeholder-white/40"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
                />
              </div>
            </div>
          </div>

          {success && (
            <p className="text-xs text-center font-medium" style={{ color: "#7FAF8A" }}>{success}</p>
          )}
          {error && (
            <p className="text-xs text-center" style={{ color: "#B07088" }}>{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-full font-medium hover:opacity-90 transition-all duration-200"
            style={{ background: "white", color: "#7C6BAE" }}
          >
            Save changes
          </button>
        </form>

        {/* Session and danger */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full px-4 py-3 text-left text-sm flex justify-between items-center transition-colors hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.8)", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          >
            Log out
            <span style={{ color: "rgba(255,255,255,0.4)" }}>›</span>
          </button>
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteError(""); }}
            className="w-full px-4 py-3 text-left text-sm flex justify-between items-center transition-colors hover:bg-white/10"
            style={{ color: "#E55A7A" }}
          >
            Delete account
            <span style={{ color: "#E55A7A" }}>›</span>
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <div
            className="w-full max-w-sm mx-4 p-6 rounded-2xl flex flex-col gap-4"
            style={{ background: "white" }}
          >
            <div className="flex flex-col gap-1">
              <p
                className="font-medium"
                style={{ color: "#2D2540", fontFamily: "Playfair Display, Georgia, serif" }}
              >
                Delete your account?
              </p>
              <p className="text-sm" style={{ color: "#6B5F7A" }}>
                This will permanently delete your account and all your check-in data. This cannot be undone.
              </p>
            </div>
            {deleteError && (
              <p className="text-xs" style={{ color: "#B07088" }}>{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="flex-1 py-2 rounded-full text-sm transition-all duration-200"
                style={{ background: "#F0EBF8", color: "#6B5F7A" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="flex-1 py-2 rounded-full text-sm text-white transition-all duration-200"
                style={{ background: "#B07088", opacity: deleteLoading ? 0.7 : 1 }}
              >
                {deleteLoading ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}

export default ProfilePage;
