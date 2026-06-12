import Navigation, { NavHamburger } from "../components/Navigation";

function MedicationsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAF7FF", overflowX: "hidden" }}>
      <div style={{ background: "linear-gradient(135deg, #5C4E8A, #7C6BAE)" }}>
        <div
          className="px-6 py-4 flex justify-between items-center"
          style={{ maxWidth: "1024px", margin: "0 auto" }}
        >
          <h1
            className="text-white font-medium text-lg"
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            Medications
          </h1>
          <NavHamburger />
        </div>
      </div>

      <div
        className="p-6 pb-20 flex flex-col items-center justify-center"
        style={{ maxWidth: "1024px", margin: "0 auto", minHeight: "60vh" }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span style={{ fontSize: "48px", lineHeight: 1 }}>💊</span>
          <p
            className="text-lg font-medium mt-2"
            style={{ color: "#2D2540", fontFamily: "Playfair Display, Georgia, serif" }}
          >
            Medication tracking coming soon
          </p>
          <p className="text-sm" style={{ color: "#6B5F7A", maxWidth: "280px" }}>
            Log your medications, track adherence, and see how they affect your symptoms.
          </p>
        </div>
      </div>

      <Navigation />
    </div>
  );
}

export default MedicationsPage;
