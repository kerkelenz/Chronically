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

const MEDICATION_TYPE_ICON_MAP = {
  pill:       Pill1,
  injection:  Syringe,
  infusion:   IntravenousBag,
  supplement: MedicineBottle,
  sublingual: Lozenge,
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
