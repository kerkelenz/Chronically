export default function MilestoneBadges({ milestones }) {
  if (!milestones || milestones.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {[...milestones].sort((a, b) => a - b).map((m) => (
        <div
          key={m}
          className="px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "rgba(255,255,255,0.9)",
          }}
        >
          {m}d
        </div>
      ))}
    </div>
  );
}
