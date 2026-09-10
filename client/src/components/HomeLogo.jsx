import { Link } from "react-router-dom";
import mark from "../assets/logo-mark.png";

/**
 * The Chronically brand mark (the C with the lavender sprig), sized for a page
 * header's top-left corner and linking home (the dashboard). Present on every
 * in-app page so the logo doubles as a consistent "back to home" affordance.
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
