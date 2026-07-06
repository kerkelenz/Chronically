import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cropper from "react-easy-crop";
import { useAuth } from "../hooks/useAuth";
import Navigation, { NavHamburger } from "../components/Navigation";
import Avatar from "../components/Avatar";
import MilestoneBadges from "../components/MilestoneBadges";

function getCroppedImg(imageSrc, croppedAreaPixels) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        256,
        256,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Crop modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState("Bug");
  const [reportMessage, setReportMessage] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSent, setReportSent] = useState(false);

  // Crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [cropError, setCropError] = useState("");

  const hasChanges =
    username !== (user?.username || "") || email !== (user?.email || "");

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) {
      setCropError("Please select an image file.");
      setShowCropModal(true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCropError("Image must be under 10 MB.");
      setShowCropModal(true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropError("");
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSaveAvatar = async () => {
    if (!croppedAreaPixels) return;
    setSavingAvatar(true);
    setCropError("");
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/avatar`,
        { image: croppedImage },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateUser({ ...user, avatar: res.data.avatar });
      setShowCropModal(false);
      setImageSrc(null);
    } catch (err) {
      setCropError(err.response?.data?.error || "Failed to save photo. Please try again.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/users/avatar`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateUser({ ...user, avatar: null });
    } catch (err) {
      setError("Failed to remove photo. Please try again.");
    }
  };

  const handleSendReport = async () => {
    if (!reportMessage.trim()) { setReportError("Please describe the problem."); return; }
    setReportSending(true);
    setReportError("");
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/feedback`,
        { message: reportMessage, category: reportCategory, platform: "web" },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setReportSent(true);
      setReportMessage("");
    } catch (err) {
      setReportError("Couldn't send just now — please try again.");
    } finally {
      setReportSending(false);
    }
  };

  const closeCropModal = () => {
    setShowCropModal(false);
    setImageSrc(null);
    setCropError("");
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
          <button
            onClick={() => fileInputRef.current.click()}
            className="rounded-full transition-opacity hover:opacity-80"
            aria-label="Change profile photo"
          >
            <Avatar user={user} size={64} />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current.click()}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)", color: "white" }}
            >
              {user?.avatar ? "Change photo" : "Add photo"}
            </button>
            {user?.avatar && (
              <button
                onClick={handleRemoveAvatar}
                className="px-4 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.7)" }}
              >
                Remove
              </button>
            )}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Settings form */}
      <div className="relative z-10 p-6 pb-20 flex flex-col gap-4" style={{ maxWidth: "480px", margin: "0 auto" }}>
        {(user?.celebratedMilestones || []).length > 0 && (
          <div
            className="p-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            <p className="text-xs mb-3 uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
              Achievements
            </p>
            <MilestoneBadges milestones={user.celebratedMilestones} />
          </div>
        )}

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
                  onChange={(e) => { setUsername(e.target.value); setSuccess(""); setError(""); }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200 placeholder-white/40"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
                />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Email</p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setSuccess(""); setError(""); }}
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
            <p className="text-xs text-center" style={{ color: "#FF6B8A" }}>{error}</p>
          )}

          {hasChanges && (
            <button
              type="submit"
              className="w-full py-3 rounded-full font-medium hover:opacity-90 transition-all duration-200"
              style={{ background: "white", color: "#7C6BAE" }}
            >
              Save changes
            </button>
          )}
        </form>

        {/* Session and danger */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          <button
            onClick={() => navigate("/privacy")}
            className="w-full px-4 py-3 text-left text-sm flex justify-between items-center transition-colors hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.8)", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          >
            Privacy Policy
            <span style={{ color: "rgba(255,255,255,0.4)" }}>›</span>
          </button>
          <button
            onClick={() => navigate("/terms")}
            className="w-full px-4 py-3 text-left text-sm flex justify-between items-center transition-colors hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.8)", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          >
            Terms of Service
            <span style={{ color: "rgba(255,255,255,0.4)" }}>›</span>
          </button>
          <button
            onClick={() => { setShowReportModal(true); setReportError(""); setReportSent(false); }}
            className="w-full px-4 py-3 text-left text-sm flex justify-between items-center transition-colors hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.8)", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          >
            Send feedback
            <span style={{ color: "rgba(255,255,255,0.4)" }}>›</span>
          </button>
          <a
            href="https://buymeacoffee.com/chronicallyapp"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-3 text-left text-sm flex justify-between items-center transition-colors hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.8)", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          >
            Support Chronically
            <span style={{ color: "rgba(255,255,255,0.4)" }}>›</span>
          </a>
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
            className="w-full px-4 py-3 text-left text-sm font-medium flex justify-between items-center transition-colors"
            style={{ color: "white", background: "rgba(220,50,80,0.25)" }}
          >
            Delete account
            <span style={{ color: "rgba(255,160,170,0.8)" }}>›</span>
          </button>
        </div>
      </div>

      {/* Crop modal */}
      {showCropModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden flex flex-col"
            style={{ background: "white" }}
          >
            {imageSrc && !cropError ? (
              <>
                {/* Crop area */}
                <div style={{ position: "relative", width: "100%", height: 300, background: "#1a1a2e" }}>
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium" style={{ color: "#6B5F7A" }}>Zoom</p>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full"
                      style={{ accentColor: "#7C6BAE" }}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={closeCropModal}
                      disabled={savingAvatar}
                      className="flex-1 py-2 rounded-full text-sm transition-all duration-200"
                      style={{ background: "#F0EBF8", color: "#6B5F7A" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAvatar}
                      disabled={savingAvatar}
                      className="flex-1 py-2 rounded-full text-sm text-white transition-all duration-200"
                      style={{ background: "#7C6BAE", opacity: savingAvatar ? 0.7 : 1 }}
                    >
                      {savingAvatar ? "Saving…" : "Save photo"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 flex flex-col gap-4">
                <p className="font-medium" style={{ color: "#2D2540", fontFamily: "Playfair Display, Georgia, serif" }}>
                  Photo error
                </p>
                <p className="text-sm" style={{ color: "#B07088" }}>{cropError}</p>
                <button
                  onClick={closeCropModal}
                  className="w-full py-2 rounded-full text-sm transition-all duration-200"
                  style={{ background: "#F0EBF8", color: "#6B5F7A" }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-sm mx-4 p-6 rounded-2xl flex flex-col gap-4" style={{ background: "white" }}>
            {reportSent ? (
              <>
                <p className="font-medium text-center" style={{ color: "#2D2540", fontFamily: "Playfair Display, Georgia, serif" }}>
                  Thank you — we've got it 💜
                </p>
                <p className="text-sm text-center" style={{ color: "#6B5F7A" }}>
                  We read every message. It helps us make Chronically better.
                </p>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="py-2 rounded-full text-sm text-white transition-all duration-200"
                  style={{ background: "#7C6BAE" }}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <p className="font-medium" style={{ color: "#2D2540", fontFamily: "Playfair Display, Georgia, serif" }}>
                    Send feedback
                  </p>
                  <p className="text-sm" style={{ color: "#6B5F7A" }}>
                    Something not working, or have an idea? Tell us — it helps us make Chronically better.
                  </p>
                </div>
                <div className="flex gap-2">
                  {["Bug", "Suggestion", "Other"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setReportCategory(c)}
                      className="px-3 py-1.5 rounded-full text-xs transition-all"
                      style={reportCategory === c
                        ? { background: "#7C6BAE", color: "white" }
                        : { background: "#F0EBF8", color: "#6B5F7A" }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  rows={4}
                  placeholder="Describe what happened…"
                  className="w-full p-3 rounded-xl text-sm resize-none"
                  style={{ background: "#F7F4FC", color: "#2D2540", border: "1px solid #E4DCF0" }}
                />
                {reportError && <p className="text-xs" style={{ color: "#B07088" }}>{reportError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReportModal(false)}
                    disabled={reportSending}
                    className="flex-1 py-2 rounded-full text-sm transition-all duration-200"
                    style={{ background: "#F0EBF8", color: "#6B5F7A" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendReport}
                    disabled={reportSending}
                    className="flex-1 py-2 rounded-full text-sm text-white transition-all duration-200"
                    style={{ background: "#7C6BAE", opacity: reportSending ? 0.7 : 1 }}
                  >
                    {reportSending ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
