import { computeStreakState, checkInsToNextSave, MILESTONES } from "../utils/streaks";

function FlameIcon({ size = 28 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ color: "white", flexShrink: 0 }}>
      <path d="M12 23c4.4 0 8-3.3 8-7.5 0-2.6-1.4-4.9-3-6.8-.4 1.2-1.5 2-2.7 2 .9-2.3.4-4.9-1.6-6.7-1.3-1.2-2-2.7-2-4.3C8.5 4 6 7.5 6 11.5c0 1 .2 2 .6 2.9C5.6 13.6 5 12.4 5 11c-1.2 1.5-2 3.3-2 5.5C3 19.7 6.6 23 12 23z"/>
    </svg>
  );
}

function ShieldIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ color: "white", flexShrink: 0 }}>
      <path d="M12 2l8 3v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V5l8-3z"/>
    </svg>
  );
}

function StreakCard({ checkIns }) {
  const { currentStreak, longestStreak, saveBalance } = computeStreakState(checkIns);
  const toNextSave = checkInsToNextSave(checkIns);
  const nextTarget = MILESTONES.find((m) => longestStreak < m);

  return (
    <div
      className="p-4 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: flame + streak */}
        <div className="flex items-center gap-3">
          <FlameIcon size={30} />
          <div>
            {currentStreak > 0 ? (
              <>
                <p
                  style={{
                    color: "white",
                    fontFamily: "Playfair Display, Georgia, serif",
                    fontSize: "2rem",
                    fontWeight: "700",
                    lineHeight: "1",
                  }}
                >
                  {currentStreak}
                </p>
                <p className="text-sm font-medium mt-0.5" style={{ color: "white" }}>
                  day streak
                </p>
              </>
            ) : (
              <p className="text-sm font-medium" style={{ color: "white" }}>
                Start your streak
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
              Best: {longestStreak}
            </p>
          </div>
        </div>

        {/* Right: saves indicator */}
        <div className="flex flex-col items-end gap-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <ShieldIcon size={16} />
            <span className="text-sm font-medium" style={{ color: "white" }}>
              {saveBalance}/3
            </span>
          </div>
          {toNextSave !== null && (
            <p className="text-[10px] text-right leading-tight" style={{ color: "rgba(255,255,255,0.6)", maxWidth: "100px" }}>
              {toNextSave} check-in{toNextSave === 1 ? "" : "s"} to next save
            </p>
          )}
        </div>
      </div>

      {/* Milestone badges */}
      <div className="flex gap-1.5 mt-3 flex-wrap">
        {MILESTONES.map((m) => {
          const earned = longestStreak >= m;
          const isNext = m === nextTarget;
          return (
            <div
              key={m}
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                background: earned ? "#C4A882" : "rgba(255,255,255,0.10)",
                color: earned ? "white" : "rgba(255,255,255,0.30)",
                border: isNext
                  ? "1px solid rgba(255,255,255,0.55)"
                  : "1px solid transparent",
              }}
            >
              {m}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StreakCard;
