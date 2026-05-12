import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
      }}
    >
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

      <div className="relative z-10 flex flex-col items-center gap-4">
        <h1
          className="text-5xl font-medium text-white"
          style={{ fontFamily: "Georgia, serif", letterSpacing: "0.03em" }}
        >
          Chronically
        </h1>
        <p className="text-sm text-white opacity-70 text-center">
          your daily companion for the chronic life.
        </p>
        <div className="flex flex-col gap-3 w-48 mt-4">
          <button
            className="w-full py-3 rounded-full bg-white font-medium text-sm hover:bg-opacity-90 hover:scale-105
            transition-all duration-200 shockwave-btn"
            style={{ color: "#7C6BAE" }}
            onClick={() => navigate("/register")}
          >
            Get Started
          </button>
          <button
            className="w-full py-3 rounded-full font-medium text-sm text-white hover:bg-white hover:bg-opacity-20
            hover:scale-105 transition-all duration-200 hover:bg-white/30 ripple-btn"
            style={{
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.4)",
            }}
            onClick={() => navigate("/login")}
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
