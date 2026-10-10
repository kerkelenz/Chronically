import { Link } from "react-router-dom";
import mark from "../assets/logo-mark.png";

/**
 * The Chronically brand mark (the C with the lavender sprig), sized for a page
 * header's top-left corner and linking home (the dashboard), so the logo
 * doubles as a "back to home" affordance.
 *
 * Which pages show it is decided in one place: it is PageHeader's default
 * `leading`, and a page opts out there (see PageHeader for which do and why).
 */
export default function HomeLogo() {
  return (
    <Link
      to="/dashboard"
      aria-label="Chronically home"
      className="flex-shrink-0 transition-opacity hover:opacity-80"
    >
      <img
        src={mark}
        alt=""
        aria-hidden="true"
        style={{ height: 32, width: "auto", display: "block" }}
      />
    </Link>
  );
}
