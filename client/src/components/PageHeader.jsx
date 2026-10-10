import HomeLogo from "./HomeLogo";
import { NavHamburger } from "./Navigation";

/**
 * The top row of every in-app page: something on the left, a title, optional
 * actions, and the menu button on the right.
 *
 * Eight pages used to hand-write this row, and the copies had drifted — the gap
 * before the menu button was 8px on two pages and 12px on two others. Spacing
 * lives here now, so it can only be wrong in one place (CLAUDE.md: fix layout
 * in the kit, never as a per-screen override).
 *
 * The brand mark is the default `leading`, because it doubles as the way back
 * to the dashboard. A page that has a better reason opts out explicitly:
 *
 *   leading={null}            no mark (Profile)
 *   leading={<BackButton />}  a different way back (From Chronicle)
 *   leading={<Avatar />}      the dashboard, which is already home
 *
 * Renders only the row. Each page keeps its own `relative z-20` wrapper, which
 * on some pages holds more than the header.
 */
export default function PageHeader({ title, subtitle, leading = <HomeLogo />, actions }) {
  const heading = title ? (
    <h1
      className="text-white font-medium text-lg"
      style={{ fontFamily: "Playfair Display, Georgia, serif" }}
    >
      {title}
    </h1>
  ) : null;

  return (
    <div
      className="px-6 py-4 flex justify-between items-center"
      style={{ maxWidth: "1024px", margin: "0 auto" }}
    >
      <div className="flex items-center gap-2.5">
        {leading}
        {subtitle ? (
          <div>
            {heading}
            <p className="text-white/70 text-xs mt-1">{subtitle}</p>
          </div>
        ) : heading}
      </div>
      {actions ? (
        <div className="flex items-center gap-3">
          {actions}
          <NavHamburger />
        </div>
      ) : (
        <NavHamburger />
      )}
    </div>
  );
}
