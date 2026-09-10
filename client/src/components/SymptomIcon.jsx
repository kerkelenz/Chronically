import { Pill1, Syringe, IntravenousBag, MedicineBottle } from "healthicons-react";
import {
  Sleepy, Fever, Chills, Sweating, Virus, Symptom, Headache, Joints, BackPain,
  Spine, Arm, WalkSupported, Leg, Neurology, Heart, IntestinalPain, Eye, Confused,
  Dizzy, Woozy, Foot, Walking, LowVision, Ear, Deaf, Nauseous, Vomiting, Diarrhea,
  Stomach, Expectorate, Lungs, Coughing, Nose, Mouth, Tissue, Heartbeat, Cardiogram,
  Allergies, Measles, FeverEmotions, Bandaged, Nervous, Angry, Skeleton, Body,
  ThermometerDigital, Bladder, Kidneys, Tongue, Weight,
} from "healthicons-react/outline";
import { symptomIconName } from "../utils/symptomCatalog";

// healthicons has no oval/lozenge tablet — only round pills — so define one
// locally to match the mobile Lozenge and read distinctly from the round Pill
function Lozenge({ width = 24, height = 24 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 7.5C16.1421 7.5 19.5 9.29086 19.5 11.5C19.5 13.7091 16.1421 15.5 12 15.5C7.85786 15.5 4.5 13.7091 4.5 11.5C4.5 9.29086 7.85786 7.5 12 7.5ZM12 9C8.96243 9 6.5 10.1193 6.5 11.5C6.5 12.8807 8.96243 14 12 14C15.0376 14 17.5 12.8807 17.5 11.5C17.5 10.1193 15.0376 9 12 9Z" />
      <path d="M12 8.5C12.2761 8.5 12.5 8.72386 12.5 9V14C12.5 14.2761 12.2761 14.5 12 14.5C11.7239 14.5 11.5 14.2761 11.5 14V9C11.5 8.72386 11.7239 8.5 12 8.5Z" />
    </svg>
  );
}

// symptom icons come from healthicons (shared cross-platform with mobile)
const SYMPTOM_REGISTRY = {
  Sleepy, Fever, Chills, Sweating, Virus, Symptom, Headache, Joints, BackPain,
  Spine, Arm, WalkSupported, Leg, Neurology, Heart, IntestinalPain, Eye, Confused,
  Dizzy, Woozy, Foot, Walking, LowVision, Ear, Deaf, Nauseous, Vomiting, Diarrhea,
  Stomach, Expectorate, Lungs, Coughing, Nose, Mouth, Tissue, Heartbeat, Cardiogram,
  Allergies, Measles, FeverEmotions, Bandaged, Nervous, Angry, Skeleton, Body,
  ThermometerDigital, Bladder, Kidneys, Tongue, Weight,
};

// Newer forms — hand-drawn line glyphs (same 48 viewBox + outline weight as the
// Lozenge). Stroked with currentColor so the wrapping span's color drives them.
const MED_STROKE = {
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
};

function Tube({ width = 24, height = 24 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="7" width="8" height="5" rx="1.5" {...MED_STROKE} />
      <path d="M15 20 Q15 13 24 13 Q33 13 33 20 V38 H15 Z" {...MED_STROKE} />
      <line x1="15" y1="34" x2="33" y2="34" {...MED_STROKE} />
    </svg>
  );
}

function PatchIcon({ width = 24, height = 24 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="12" width="24" height="24" rx="4" {...MED_STROKE} />
      <path d="M30 12 L30 18 L36 18" {...MED_STROKE} />
      <path d="M30 18 L36 12" {...MED_STROKE} />
      <circle cx="19" cy="25" r="1.3" fill="currentColor" />
      <circle cx="25" cy="29" r="1.3" fill="currentColor" />
      <circle cx="18" cy="31" r="1.3" fill="currentColor" />
    </svg>
  );
}

function Gummy({ width = 24, height = 24 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 34 Q13 15 24 15 Q35 15 35 34 Z" {...MED_STROKE} />
      <path d="M18 26 Q24 21 30 26" {...MED_STROKE} />
    </svg>
  );
}

function Droplet({ width = 24, height = 24 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 9 C24 9 32 20 32 28 A8 8 0 1 1 16 28 C16 20 24 9 24 9 Z" {...MED_STROKE} />
      <path d="M20 31 Q19 27 22 25" {...MED_STROKE} />
    </svg>
  );
}

const MEDICATION_TYPE_ICON_MAP = {
  pill:       Pill1,
  injection:  Syringe,
  infusion:   IntravenousBag,
  supplement: MedicineBottle,
  sublingual: Lozenge,
  topical:    Tube,
  patch:      PatchIcon,
  gummy:      Gummy,
  drops:      Droplet,
};

export function SymptomIcon({ name, size = 24, color = "white", style: extraStyle, ...props }) {
  if (!name) return null;
  const Icon = SYMPTOM_REGISTRY[symptomIconName(name)] || Symptom;
  return (
    <span
      title={name}
      style={{ color, display: "inline-flex", flexShrink: 0, ...extraStyle }}
      {...props}
    >
      <Icon width={size} height={size} />
    </span>
  );
}

export function MedicationTypeIcon({ type, size = 22, color = "white", style: extraStyle, ...props }) {
  const Icon = MEDICATION_TYPE_ICON_MAP[type];
  if (!Icon) return null;
  return (
    <span
      title={type}
      style={{ color, display: "inline-flex", flexShrink: 0, ...extraStyle }}
      {...props}
    >
      <Icon width={size} height={size} />
    </span>
  );
}
