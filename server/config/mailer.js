// Email, with the same `emails.send` shape as the Resend client. With
// RESEND_API_KEY set it is the real client; without one (a local machine) it
// prints each email to the console instead — so sign-up, verification and
// password reset all work locally, links included, and nothing is ever sent.
const { Resend } = require("resend");

function consoleMailer() {
  return {
    emails: {
      send: async ({ from, to, subject, html, text }) => {
        const body = (text || html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        // the links are the point locally (verify, reset), and they live in hrefs
        const links = [...new Set([...(html || "").matchAll(/href="([^"]+)"/g)].map((m) => m[1]))];
        console.log(
          `\n✉  [email not sent — no RESEND_API_KEY]\n   from: ${from}\n   to: ${[].concat(to).join(", ")}\n   subject: ${subject}\n   ${body}\n` +
            links.map((l) => `   link: ${l}\n`).join(""),
        );
        return { data: { id: "local" }, error: null };
      },
    },
  };
}

module.exports = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : consoleMailer();
