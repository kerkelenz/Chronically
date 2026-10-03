// Copy and resources for the support pathway.
//
// Paired file — must stay byte-identical with its twin:
//   mobile/theme/supportResources.js  <->  client/src/utils/supportResources.js
//
// Shared deliberately: this is the one screen where a wording difference
// between platforms would actually matter. Each platform owns how a resource
// is opened (tel/sms/in-app browser); neither owns what it says.

export const SUPPORT_TITLE = "If today is very hard";

// The most important sentence on the screen. People reasonably assume someone
// is reading what they log. Nobody is, and saying so plainly is the difference
// between a door and a false promise.
export const SUPPORT_INTRO =
  "Chronically is a place to keep track of things — it isn't a monitoring service, and no one here can see what you log or respond to it. If you need another person right now, these will reach one.";

export const SUPPORT_CLOSING =
  "Reaching out is a reasonable thing to do on a hard day. It doesn't have to be an emergency.";

// `kind` tells each platform how to open it; `a11y` is the spoken label, which
// states the action rather than the organisation.
export const SUPPORT_RESOURCES = [
  {
    id: "988",
    name: "988 Suicide & Crisis Lifeline",
    sub: "Call or text 988 · Free, 24/7, US",
    kind: "tel",
    value: "988",
    a11y: "Call 988",
  },
  {
    id: "crisis-text-line",
    name: "Crisis Text Line",
    sub: "Text HOME to 741741 · Free, 24/7, US/Canada/UK/Ireland",
    kind: "sms",
    value: "741741",
    body: "HOME",
    a11y: "Text HOME to 741741",
  },
  {
    id: "find-a-helpline",
    name: "Find a Helpline",
    sub: "findahelpline.com · Free helplines in 130+ countries",
    kind: "url",
    value: "https://findahelpline.com",
    a11y: "Open findahelpline.com",
  },
  {
    id: "emergency",
    name: "Emergency services",
    sub: "Call 911 (or your local emergency number) if you or someone else is in immediate danger",
    kind: "tel",
    value: "911",
    a11y: "Call 911",
  },
];

// The one entry-point label, used by Profile and the worst-tier toast.
export const SUPPORT_ROW_LABEL = "If today is very hard";
export const SUPPORT_TOAST_LINK = "Support options";
