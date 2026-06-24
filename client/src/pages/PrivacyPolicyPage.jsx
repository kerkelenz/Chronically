import { Link } from "react-router-dom";

const LAST_UPDATED = "June 23, 2026";

const SECTIONS = [
  {
    heading: "Who we are",
    paragraphs: [
      'Chronically ("Chronically", "we", "us", "our") is a personal health-tracking app that helps you log daily check-ins, symptoms, medications, and appointments. Chronically is operated by Erkelenz Technology Services, a sole proprietorship based in California, USA.',
      "This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices you have. If you have questions, contact us at privacy@mychronically.app.",
    ],
  },
  {
    heading: "Information we collect",
    paragraphs: ["We only collect information you choose to provide:"],
    bullets: [
      "Account information: your username, email address, password (stored in encrypted/hashed form), and an optional profile photo.",
      "Health and wellness information you enter: daily check-ins (pain, mood, energy, anxiety, and appetite levels), symptom tags, medications (names, types, dosages, schedules, and notes), medication logs (taken, skipped, or missed, and any reasons), and doctor appointments (doctor name, specialty, date, location, reason, your notes, and follow-up dates).",
      "Information needed to operate the app, such as authentication tokens and timestamps.",
    ],
    after: [
      "We do not use third-party analytics, advertising networks, or tracking technologies. We do not collect your precise location, contacts, or device identifiers for advertising.",
    ],
  },
  {
    heading: "How we use your information",
    bullets: [
      "To provide the app's features — recording and displaying your tracking data, generating your doctor-report PDF, and showing in-app reminders.",
      "To create, secure, and authenticate your account.",
      "To send essential transactional emails only, such as email verification and password resets. We do not send marketing email.",
      "To maintain, debug, secure, and improve the app.",
    ],
    after: [
      "We never sell your information, share it for advertising, or use your health data for any purpose other than providing the app to you.",
    ],
  },
  {
    heading: "How your information is stored and protected",
    paragraphs: [
      "Your information is transmitted over encrypted connections (HTTPS) and stored in a PostgreSQL database hosted by Supabase. The application runs on Render, we use Cloudflare for DNS and network protection, and we use Resend to deliver transactional email. These providers process data on our behalf as service providers and are not permitted to use your information for their own purposes.",
      "Data is stored on servers located in the United States. No method of transmission or storage is completely secure, but we take reasonable technical and organizational measures to protect your information.",
    ],
  },
  {
    heading: "How we share information",
    paragraphs: ["We share information only in these limited circumstances:"],
    bullets: [
      "With the service providers listed above, strictly to operate the app.",
      "When required by law, or to protect the rights, safety, or property of you, us, or others.",
      "With your consent or at your direction.",
    ],
    after: [
      "Your health data is yours. The doctor-report PDF is generated at your request and shared only by you, with whomever you choose.",
    ],
  },
  {
    heading: "Your rights and choices",
    bullets: [
      "Access and correct: view and edit your information in the app at any time.",
      "Export: generate a PDF report of your data from within the app.",
      "Delete: delete your account at any time from Profile, then Delete account. This permanently removes your account and all associated data — check-ins, medications, logs, and appointments — from our active database.",
      "Depending on where you live (for example, the EEA, UK, or California), you may have additional rights. Contact us at privacy@mychronically.app to exercise them.",
    ],
  },
  {
    heading: "Data retention",
    paragraphs: [
      "We keep your information for as long as your account is active. When you delete your account, your data is removed from our active systems. Routine backups, if any, are cycled out in the ordinary course of operations.",
    ],
  },
  {
    heading: "Children's privacy",
    paragraphs: [
      "Chronically is not directed to children under 16, and we do not knowingly collect information from them. If you believe a child has provided us information, contact us and we will delete it.",
    ],
  },
  {
    heading: "International users",
    paragraphs: [
      "If you use Chronically from outside the United States, your information will be transferred to and processed in the United States, where data-protection laws may differ from those in your country.",
    ],
  },
  {
    heading: "Not medical advice",
    paragraphs: [
      "Chronically is a personal tracking tool. It is not a medical device and does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional about your health.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      "We may update this policy from time to time. We will post the updated version here with a new date and, for material changes, notify you in the app or by email.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about this policy or your data? Email privacy@mychronically.app.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{
        background:
          "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 sm:p-12">
        <Link
          to="/"
          className="text-sm text-[#7C6BAE] hover:underline"
        >
          &larr; Back to home
        </Link>
        <h1
          className="mt-4 text-3xl text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div
          className="mt-8 space-y-8 text-gray-700 leading-relaxed"
          style={{ fontFamily: "'Lato', sans-serif" }}
        >
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl text-gray-900 mb-3">{s.heading}</h2>
              {s.paragraphs?.map((p, i) => (
                <p key={i} className="mb-3">{p}</p>
              ))}
              {s.bullets && (
                <ul className="list-disc pl-6 space-y-2">
                  {s.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {s.after?.map((p, i) => (
                <p key={i} className="mt-3">{p}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
