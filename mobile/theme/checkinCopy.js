// Verbatim copy of affirmation/toast copy from client/src/components/CheckInModal.jsx

export const AFFIRMATIONS = [
  { title: "Well done 💙", message: "You showed up today. That matters." },
  { title: "Check-in complete 🌿", message: "Tracking your health is an act of self-care. Keep going." },
  { title: "You did it ✨", message: "Living with chronic illness takes real strength. You have it." },
  { title: "That took courage 💜", message: "Even on the hard days, you checked in. That's resilience." },
  { title: "Proud of you 🌸", message: "You're paying attention to yourself. That's more powerful than it sounds." },
  { title: "One more day 🌙", message: "Small steps still count. You're here, and that's enough." },
  { title: "You're doing the work 💫", message: "Every check-in adds up. Your future self will thank you." },
  { title: "Be gentle with yourself 🤍", message: "Rest is productive too. You're allowed to take it slow." },
  { title: "You know your body 🌱", message: "This check-in helps you listen. Keep tuning in." },
  { title: "Progress is progress 💙", message: "It looks different every day. Today's chapter is written." },
  { title: "Take a breath 🕊️", message: "You just took care of yourself. That's worth something." },
  { title: "You're not alone 💜", message: "Millions of people live with chronic illness. You're tracking, and that's taking charge." },
];

export const TOAST_MESSAGES = {
  best: [
    "That's a good sign. Hold onto this one. 💙",
    "A bright spot in the data. You earned it. 💙",
    "Good days matter. So does noticing them. 💙",
    "This is what progress can look like. 💙",
    "Your body gave you a good one today. 💙",
    "Celebrate the small wins. This is one of them. 💙",
    "Moments like this are worth tracking. 💙",
    "A good reading on a hard journey. Take it in. 💙",
    "This is what a better day feels like. Remember it. 💙",
    "You're doing something right. 💙",
    "Good numbers mean something. This one does too. 💙",
    "Log it, feel it, keep going. 💙",
  ],
  highMid: [
    "That's a solid reading. You're doing okay. 💙",
    "Better than the middle — that counts. 💙",
    "A good direction. Keep going. 💙",
    "Not perfect, but genuinely good. 💙",
    "This is a positive sign. Take it. 💙",
    "Above the line today. That matters. 💙",
    "You're trending in the right direction. 💙",
    "A good reading for a hard journey. 💙",
    "This is worth noticing. 💙",
    "Not every day is great, but this one is pretty good. 💙",
    "High-mid is still high. Take that. 💙",
    "You're holding up well. 💙",
  ],
  mid: [
    "Steady is its own kind of strength. 💙",
    "You're in the middle and still moving. That counts. 💙",
    "Holding the middle ground takes effort too. 💙",
    "Not every day needs to be a high. Mid days matter. 💙",
    "You're managing. That's real. 💙",
    "Staying steady when things are hard is underrated. 💙",
    "Mid readings mean you're still in the fight. 💙",
    "You showed up for a mid day. That's something. 💙",
    "Middle of the road is still moving forward. 💙",
    "Consistent and present. That's worth something. 💙",
    "You're here, you're tracking, you're managing. 💙",
    "A steady day. Steady adds up. 💙",
  ],
  lowMid: [
    "That's a harder reading. You're still tracking it. 💙",
    "Not your best, but you're still here. 💙",
    "Low-mid days are real. So is your resilience. 💙",
    "A tougher reading today. Be kind to yourself. 💙",
    "Harder days deserve acknowledgment. This is yours. 💙",
    "This reading tells a story. You're still writing it. 💙",
    "A difficult marker today. You logged it anyway. 💙",
    "Not where you want to be, but still showing up. 💙",
    "A low-mid day is still a day you're fighting through. 💙",
    "Tough readings are part of the journey too. 💙",
    "You're having a harder moment. That's okay to notice. 💙",
  ],
  worst: {
    pain: [
      "Pain this intense is exhausting. You're still here. 💙",
      "That's a lot to carry. Logging it is an act of courage. 💙",
      "Severe pain days are their own kind of battle. You're fighting it. 💙",
      "Your body is working so hard. So are you. 💙",
      "Pain like this deserves to be acknowledged. We see you. 💙",
      "On days like this, just existing is enough. 💙",
      "This level of pain is real and it's hard. You showed up anyway. 💙",
      "Logging this on a day like today takes strength. 💙",
      "Pain doesn't get the last word. You do. 💙",
      "Even the hardest pain days pass. You'll get through this one. 💙",
      "Your pain is valid. Your strength is real. 💙",
      "You tracked it. That matters more than you know. 💙",
    ],
    mood: [
      "Low days are hard. You showed up anyway. 💙",
      "Even on your darkest days, you matter. 💙",
      "A low mood day doesn't define you. 💙",
      "Feeling this low is exhausting. Be gentle with yourself. 💙",
      "You don't have to feel okay to be worthy of care. 💙",
      "Tracking how you feel on hard days is brave. 💙",
      "Low mood and chronic illness is a heavy combination. You're carrying a lot. 💙",
      "Tomorrow can look different. For now, just breathe. 💙",
      "You noticed. You logged it. That's not nothing. 💙",
      "Hard emotional days deserve the same care as hard pain days. 💙",
      "Even when your mood is low, you're still showing up. 💙",
      "It's okay not to be okay. You're still here. 💙",
    ],
    energy: [
      "Running on empty is its own kind of hard. Rest when you can. 💙",
      "MS fatigue is real and it's brutal. Be gentle with yourself today. 💙",
      "Fatigue this deep isn't laziness. It's your body asking for care. 💙",
      "Low energy days are valid. You're doing your best. 💙",
      "Even exhausted, you checked in. That takes something. 💙",
      "Rest is not giving up. Rest is part of fighting. 💙",
      "Your energy is precious. Protect it today. 💙",
      "Drained days are hard to push through. You don't always have to. 💙",
      "This kind of exhaustion is invisible to most people. We see it. 💙",
      "Logging today even when you're this tired is a quiet kind of strength. 💙",
      "Fatigue is one of the hardest parts of this illness. You're not alone. 💙",
      "Low energy doesn't mean low worth. 💙",
    ],
    anxiety: [
      "Anxiety on top of everything else is a lot. You're handling it. 💙",
      "That level of anxiety is genuinely hard to sit with. You're not alone. 💙",
      "Anxiety and chronic illness feed each other. You're dealing with both. 💙",
      "High anxiety days are exhausting in a way most people don't understand. 💙",
      "You're tracking it. That's already more than most people would do. 💙",
      "Breathe. You're here. You're logging. That's enough for right now. 💙",
      "Anxiety doesn't mean weakness. It means your nervous system is overwhelmed. 💙",
      "You don't have to calm down. You just have to get through today. 💙",
      "High anxiety is hard to carry quietly. You don't have to. 💙",
      "Noticing your anxiety is the first step. You just did that. 💙",
      "This is hard. You're doing it anyway. 💙",
      "Anxiety at this level deserves acknowledgment. Consider this yours. 💙",
    ],
    appetite: [
      "Not being able to eat is its own kind of struggle. Take care of yourself. 💙",
      "A difficult appetite day. Small things still count. 💙",
      "When eating is hard, everything else feels harder too. 💙",
      "Poor appetite is a real symptom, not a choice. Be kind to yourself. 💙",
      "Eat what you can, when you can. No judgment here. 💙",
      "Your body is doing a lot right now. Nourish it however you're able. 💙",
      "Low appetite days are frustrating. You're not alone in that. 💙",
      "You noticed and you logged it. That's self-awareness worth having. 💙",
      "Appetite struggles are real and valid. So are you. 💙",
      "Even small amounts of food count. Every bit helps. 💙",
      "Hard appetite days don't last forever. This one will pass too. 💙",
      "Taking note of how your appetite feels is caring for yourself. 💙",
    ],
  },
};

export const COMBINED_TOAST_MESSAGES = {
  twoOrMoreWorst: [
    "This is a hard check-in. You did it anyway. 💙",
    "Multiple difficult readings today. That's a lot to carry. 💙",
    "Hard days show up in the data too. This is one of them. 💙",
    "You logged a tough one. That takes something. 💙",
    "Rough check-ins are part of the journey. So is surviving them. 💙",
    "This is a hard day. You're allowed to feel that. 💙",
    "Two hard readings in one check-in. Be gentle with yourself today. 💙",
    "You're tracking even on the bad ones. That's brave. 💙",
    "Hard days logged are hard days witnessed. We see you. 💙",
    "This check-in shows a hard moment. You're still here for it. 💙",
    "When everything feels hard, just getting through counts. 💙",
    "A difficult check-in. Rest when you can. 💙",
  ],
  twoOrMoreLowMid: [
    "A harder check-in today. You tracked it anyway. 💙",
    "Multiple difficult readings. That's a tough day. 💙",
    "Low-mid across a few metrics — be gentle with yourself. 💙",
    "A harder day showing up in the data. You're still here. 💙",
    "Not your easiest check-in. You did it anyway. 💙",
    "Tougher readings today. Rest when you can. 💙",
    "A difficult check-in. You logged it. That matters. 💙",
    "More than one hard reading today. Acknowledge that. 💙",
    "Low-mid days are real and they're hard. So are you. 💙",
    "A tough check-in. Tomorrow can look different. 💙",
    "You're having a harder day. That's allowed. 💙",
    "Multiple low readings today. Be kind to yourself. 💙",
  ],
  threeMid: [
    "A steady check-in. Steady is underrated. 💙",
    "Mid across the board — you're managing. Keep going. 💙",
    "Not every day is a high or a low. This is a keep-going day. 💙",
    "Consistent and steady. That's its own kind of strength. 💙",
    "A middle-of-the-road day. Those count. 💙",
    "Steady days build the foundation for better ones. 💙",
    "You're maintaining. That's not nothing. 💙",
    "Mid readings mean you're managing. Keep going. 💙",
    "Not every day needs to be great. Today just needs to be today. 💙",
    "Stable is a win when you're living with chronic illness. 💙",
    "Holding steady. That takes more than people realize. 💙",
    "A steady check-in. Steady adds up over time. 💙",
  ],
  twoOrMoreHighMid: [
    "A solid check-in. More good than not. 💙",
    "Multiple high readings. That's encouraging. 💙",
    "You're trending well today. 💙",
    "More good than difficult today. Take that. 💙",
    "A positive check-in overall. 💙",
    "High-mid across the board is a good day. 💙",
    "You're doing better than you might think. 💙",
    "Multiple solid readings. That's worth noticing. 💙",
    "A good check-in on a hard journey. 💙",
    "More highs than lows today. Remember that. 💙",
    "You're holding up well across the board. 💙",
    "A solid overall check-in. You're doing okay. 💙",
  ],
  twoOrMoreBest: [
    "Two good ones. That's a genuinely good check-in. 💙",
    "Look at that — multiple good readings. That matters. 💙",
    "A good check-in day. These are worth celebrating. 💙",
    "Your body is giving you good signals right now. 💙",
    "This is what a better day looks like in the data. 💙",
    "Two or more good readings — that's real progress. 💙",
    "Hold onto this. You're doing well right now. 💙",
    "Good check-ins like this are what the journey is for. 💙",
    "Multiple good readings. Take a moment to feel that. 💙",
    "A strong check-in. You deserve to notice it. 💙",
    "Good days deserve to be marked. Consider this one marked. 💙",
    "This is a good moment. You get to have those too. 💙",
  ],
};

export const getTier = (level) => {
  if (level === 5) return "best";
  if (level === 4) return "highMid";
  if (level === 3) return "mid";
  if (level === 2) return "lowMid";
  return "worst";
};

export const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const getIndividualToast = (tier, metric) => {
  if (tier === "worst") return pickRandom(TOAST_MESSAGES.worst[metric]);
  return pickRandom(TOAST_MESSAGES[tier]);
};

export const getComboToast = (pain, mood, energy, anxiety, appetite) => {
  const tiers = [
    pain     ? getTier(pain)     : null,
    mood     ? getTier(mood)     : null,
    energy   ? getTier(energy)   : null,
    anxiety  ? getTier(anxiety)  : null,
    appetite ? getTier(appetite) : null,
  ].filter(Boolean);

  const count = (t) => tiers.filter((x) => x === t).length;

  if (count("worst") >= 2)   return pickRandom(COMBINED_TOAST_MESSAGES.twoOrMoreWorst);
  if (count("lowMid") >= 2)  return pickRandom(COMBINED_TOAST_MESSAGES.twoOrMoreLowMid);
  if (count("mid") >= 3)     return pickRandom(COMBINED_TOAST_MESSAGES.threeMid);
  if (count("highMid") >= 2) return pickRandom(COMBINED_TOAST_MESSAGES.twoOrMoreHighMid);
  if (count("best") >= 2)    return pickRandom(COMBINED_TOAST_MESSAGES.twoOrMoreBest);
  return null;
};
