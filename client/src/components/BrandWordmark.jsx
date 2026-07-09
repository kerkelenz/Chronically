import mark from "../assets/logo-mark.png";

/**
 * "Chronically" with the brand logo (C + lavender sprig) as the C.
 * Em-sized so it inherits the surrounding font-size. Constants measured
 * from the asset: C = 76.9% of image height, baseline at 88.4%.
 */
export default function BrandWordmark({ className = "", style = {} }) {
  return (
    <span className={className} style={{ whiteSpace: "nowrap", ...style }} aria-label="Chronically">
      <img
        src={mark}
        alt=""
        aria-hidden="true"
        style={{
          height: "1.12em",
          width: "auto",
          display: "inline-block",
          verticalAlign: "-0.13em",
          marginRight: "-0.02em",
        }}
      />
      <span aria-hidden="true">hronically</span>
    </span>
  );
}
