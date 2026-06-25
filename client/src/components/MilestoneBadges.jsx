import { MILESTONES, MILESTONE_META } from "../utils/milestones";
import Badge from "./Badge";

export default function MilestoneBadges({ milestones }) {
  const earned = new Set(milestones || []);
  return (
    <div>
      <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
        {earned.size} of {MILESTONES.length} earned
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {MILESTONES.map((m) => {
          const got = earned.has(m);
          return (
            <div key={m} className="flex flex-col items-center text-center gap-1">
              <Badge days={m} earned={got} size={64} />
              <span className="text-xs font-medium" style={{ color: got ? "white" : "rgba(255,255,255,0.55)" }}>
                {MILESTONE_META[m].name}
              </span>
              <span className="text-xs" style={{ color: got ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)" }}>
                {m} days
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
