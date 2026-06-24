import { Link } from "react-router-dom";

const LAST_UPDATED = "June 23, 2026";

const SECTIONS = [
  {
    heading: "Acceptance of these terms",
    paragraphs: [
      'By creating an account or using Chronically (the "app"), you agree to these Terms of Service. If you do not agree, please do not use the app. Chronically is operated by Erkelenz Technology Services, a sole proprietorship based in California, USA.',
    ],
  },
  {
    heading: "What Chronically is",
    paragraphs: [
      "Chronically is a personal tool for logging and reviewing your own health information — daily check-ins, symptoms, medications, and appointments — and for generating a report you can share with your healthcare providers.",
    ],
  },
  {
    heading: "Not medical advice",
    paragraphs: [
      "Chronically is not a medical device and does not provide medical advice, diagnosis, or treatment, and it is not a substitute for professional medical care. Always seek the advice of a qualified healthcare professional with any questions about your health. Never disregard professional advice or delay seeking it because of something in the app. If you think you may have a medical emergency, call your doctor or your local emergency number immediately. You are responsible for any decisions you make based on your use of the app.",
    ],
  },
  {
    heading: "Your account",
    paragraphs: [
      "You are responsible for keeping your login credentials secure and for the accuracy of the information you enter. You must be at least 16 years old to use Chronically. You are responsible for all activity under your account.",
    ],
  },
  {
    heading: "Acceptable use",
    paragraphs: [
      "You agree not to misuse the app: do not attempt to disrupt or attack the service, access other users' data, reverse-engineer the app, or use it for any unlawful purpose.",
    ],
  },
  {
    heading: "Your content",
    paragraphs: [
      "You own the information you enter into Chronically. You grant us a limited license to store and process that information solely to provide the app to you. You can export your data as a PDF and delete it by deleting your account at any time.",
    ],
  },
  {
    heading: "Availability and changes",
    paragraphs: [
      'The app is provided on an "as is" and "as available" basis. We may modify, suspend, or discontinue features at any time, and we do not guarantee uninterrupted or error-free operation.',
    ],
  },
  {
    heading: "Limitation of liability",
    paragraphs: [
      "To the fullest extent permitted by law, Chronically and Erkelenz Technology Services will not be liable for any indirect, incidental, or consequential damages, or for any health-related decisions or outcomes, arising from your use of the app. The app is a tool and is not a healthcare provider.",
    ],
  },
  {
    heading: "Termination",
    paragraphs: [
      "You may stop using the app and delete your account at any time. We may suspend or terminate accounts that violate these terms.",
    ],
  },
  {
    heading: "Governing law",
    paragraphs: [
      "These terms are governed by the laws of the State of California, USA, without regard to its conflict-of-laws rules.",
    ],
  },
  {
    heading: "Changes to these terms",
    paragraphs: [
      "We may update these terms from time to time. We will post the updated version here with a new date. Continued use of the app after changes means you accept the updated terms.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: ["Questions about these terms? Email privacy@mychronically.app."],
  },
];

export default function TermsPage() {
  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{
        background:
          "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 sm:p-12">
        <Link to="/" className="text-sm text-[#7C6BAE] hover:underline">
          &larr; Back to home
        </Link>
        <h1
          className="mt-4 text-3xl text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Terms of Service
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
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
