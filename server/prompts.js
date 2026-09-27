import crypto from "node:crypto";

const TEST_PROMPTS = [
  {
    prompt:
      "What is most likely to ruin a perfectly good group plan?",
    options: [
      "One person saying “we'll decide there”",
      "Someone not reading the group chat",
      "Rain arriving exactly at meetup time",
      "A surprise exam"
    ]
  },
  {
    prompt:
      "What would make the most chaotic office party activity?",
    options: [
      "Competitive karaoke",
      "A mystery gift exchange",
      "Office chair racing",
      "A two-hour presentation about spreadsheets"
    ]
  },
  {
    prompt:
      "Which person is most dangerous to give the aux cable to?",
    options: [
      "The person who says “trust me”",
      "The person with a 47-hour playlist",
      "The person who only listens to movie soundtracks",
      "The person who skips every song after ten seconds"
    ]
  },
  {
    prompt:
      "What is the most suspicious message to receive at 2 AM?",
    options: [
      "“Are you awake?”",
      "“Don't worry about it”",
      "“We need to talk tomorrow”",
      "“Can you send me your location?”"
    ]
  },
  {
    prompt:
      "What would instantly expose someone pretending to be productive?",
    options: [
      "They reopen the same tab five times",
      "They type aggressively without doing anything",
      "They keep changing their desktop wallpaper",
      "They schedule a meeting about the work instead"
    ]
  },
  {
    prompt:
      "Which superpower would become annoying the fastest?",
    options: [
      "Reading everyone's thoughts",
      "Never needing sleep",
      "Teleporting five metres at a time",
      "Always knowing exactly when someone is lying"
    ]
  },
  {
    prompt:
      "What is the most dramatic reason someone might leave a group chat?",
    options: [
      "Someone reacted with the wrong emoji",
      "Their message got ignored",
      "They lost an argument about dinner",
      "Someone changed the group icon"
    ]
  },
  {
    prompt:
      "Which item would be the worst thing to forget before a road trip?",
    options: [
      "Phone charger",
      "Wallet",
      "Water",
      "The person who is driving"
    ]
  },
  {
    prompt:
      "What would make the worst possible first impression at a job interview?",
    options: [
      "Asking when lunch is",
      "Calling the interviewer “bro”",
      "Arriving exactly on time but out of breath",
      "Opening with “I have absolutely no idea what this company does”"
    ]
  },
  {
    prompt:
      "What is most likely to cause an argument among close friends?",
    options: [
      "Choosing where to eat",
      "Splitting the bill",
      "Picking the movie",
      "Figuring out who is actually late"
    ]
  },
  {
    prompt:
      "Which household object would be funniest to bring to a formal event?",
    options: [
      "A rice cooker",
      "A full-size pillow",
      "A desk fan",
      "A plastic storage bucket"
    ]
  },
  {
    prompt:
      "What is the most believable excuse for replying three days late?",
    options: [
      "I completely missed the notification",
      "I thought I already replied",
      "I opened it at the worst possible moment",
      "I was mentally preparing the perfect reply"
    ]
  }
];

function shuffle(array) {
  const copy = [...array];

  for (
    let i = copy.length - 1;
    i > 0;
    i -= 1
  ) {
    const j = crypto.randomInt(0, i + 1);

    [copy[i], copy[j]] = [
      copy[j],
      copy[i]
    ];
  }

  return copy;
}

function clonePrompt(prompt) {
  return {
    prompt: prompt.prompt,
    options: [...prompt.options]
  };
}

export function getTestPromptBatch(roundCount) {
  const count = Number(roundCount);

  if (
    !Number.isInteger(count) ||
    count < 1
  ) {
    return [];
  }

  const shuffled =
    shuffle(TEST_PROMPTS);

  const selected = [];

  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    const source =
      shuffled[
        i % shuffled.length
      ];

    selected.push(
      clonePrompt(source)
    );
  }

  return selected;
}

export {
  TEST_PROMPTS
};
