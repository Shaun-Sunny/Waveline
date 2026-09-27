import crypto from "node:crypto";

import OpenAI from "openai";

import {
  getTestPromptBatch
} from "./prompts.js";

export const VIBES = {
  roast: {
    label: "Roast Night",
    description:
      "Playful, good-natured teasing about universal situations, habits, social chaos, awkward moments, and harmless everyday behavior. Never target protected groups, private individuals, or vulnerable people."
  },

  work: {
    label: "Work Trivia",
    description:
      "Funny workplace situations, meetings, office habits, productivity, tech life, deadlines, managers, coworkers, remote work, and relatable professional situations."
  },

  family: {
    label: "Family Safe",
    description:
      "All-ages friendly prompts suitable for parents, children, relatives, school groups, and mixed-age gatherings. Avoid profanity, sex, drugs, graphic violence, and mature themes."
  },

  deep: {
    label: "Deep Cuts",
    description:
      "Niche-but-accessible culture, technology, internet history, science, entertainment, unusual facts, and clever situations that reward people who know obscure things without requiring specialist knowledge."
  }
};

export const VIBE_IDS =
  Object.keys(VIBES);

const DEFAULT_MODEL =
  "gpt-5.6-luna";

const DEFAULT_TIMEOUT_MS =
  15_000;

const OPENAI_MODEL =
  String(
    process.env.OPENAI_MODEL ||
      DEFAULT_MODEL
  ).trim();

const OPENAI_TIMEOUT_MS = (() => {
  const value =
    Number(
      process.env.OPENAI_TIMEOUT_MS
    );

  if (
    Number.isFinite(value) &&
    value >= 5_000 &&
    value <= 30_000
  ) {
    return value;
  }

  return DEFAULT_TIMEOUT_MS;
})();

const OUTPUT_SCHEMA = {
  type: "object",

  properties: {
    rounds: {
      type: "array",

      items: {
        type: "object",

        properties: {
          prompt: {
            type: "string",

            description:
              "A short question or situation for the Waveline party game."
          },

          options: {
            type: "array",

            items: {
              type: "string",

              description:
                "A short answer choice that players can privately vote for."
            }
          }
        },

        required: [
          "prompt",
          "options"
        ],

        additionalProperties:
          false
      }
    }
  },

  required: [
    "rounds"
  ],

  additionalProperties:
    false
};

function fallbackResult(
  roundCount,
  reason
) {
  console.warn(
    `[Waveline AI] ${reason} Using fallback prompts.`
  );

  return {
    rounds:
      getTestPromptBatch(
        roundCount
      ),

    source:
      "fallback",

    model:
      null,

    message:
      `OpenAI content was unavailable, so Waveline switched to its built-in prompts. ${reason}`
  };
}

function createClient() {
  const key =
    String(
      process.env.OPENAI_API_KEY ||
        ""
    ).trim();

  if (!key) {
    return null;
  }

  return new OpenAI({
    apiKey: key,
    maxRetries: 0
  });
}

function normalizeString(
  value
) {
  return String(
    value ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function validateGeneratedBatch(
  value,
  roundCount
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      "Model response was not an object."
    );
  }

  if (
    !Array.isArray(
      value.rounds
    )
  ) {
    throw new Error(
      "Model response did not contain a rounds array."
    );
  }

  if (
    value.rounds.length !==
    roundCount
  ) {
    throw new Error(
      `Expected ${roundCount} rounds but received ${value.rounds.length}.`
    );
  }

  const seenPrompts =
    new Set();

  const rounds =
    value.rounds.map(
      (
        round,
        roundIndex
      ) => {
        if (
          !round ||
          typeof round !==
            "object"
        ) {
          throw new Error(
            `Round ${
              roundIndex + 1
            } is invalid.`
          );
        }

        const prompt =
          normalizeString(
            round.prompt
          );

        if (
          prompt.length < 12 ||
          prompt.length > 180
        ) {
          throw new Error(
            `Round ${
              roundIndex + 1
            } has a prompt with an invalid length.`
          );
        }

        const promptKey =
          prompt.toLocaleLowerCase();

        if (
          seenPrompts.has(
            promptKey
          )
        ) {
          throw new Error(
            `Round ${
              roundIndex + 1
            } duplicated another prompt.`
          );
        }

        seenPrompts.add(
          promptKey
        );

        if (
          !Array.isArray(
            round.options
          )
        ) {
          throw new Error(
            `Round ${
              roundIndex + 1
            } does not have an options array.`
          );
        }

        if (
          round.options.length !==
          4
        ) {
          throw new Error(
            `Round ${
              roundIndex + 1
            } must contain exactly four options.`
          );
        }

        const seenOptions =
          new Set();

        const options =
          round.options.map(
            (
              option,
              optionIndex
            ) => {
              const cleaned =
                normalizeString(
                  option
                );

              if (
                cleaned.length < 1 ||
                cleaned.length > 90
              ) {
                throw new Error(
                  `Round ${
                    roundIndex + 1
                  }, option ${
                    optionIndex + 1
                  } has an invalid length.`
                );
              }

              const key =
                cleaned.toLocaleLowerCase();

              if (
                seenOptions.has(
                  key
                )
              ) {
                throw new Error(
                  `Round ${
                    roundIndex + 1
                  } contains duplicate options.`
                );
              }

              seenOptions.add(
                key
              );

              const withoutPrefix =
                cleaned
                  .replace(
                    /^(?:[A-D][.)]\s*|\d+[.)]\s*)/i,
                    ""
                  )
                  .trim();

              if (
                withoutPrefix !==
                cleaned
              ) {
                throw new Error(
                  `Round ${
                    roundIndex + 1
                  } contains a numbered or lettered option.`
                );
              }

              return cleaned;
            }
          );

        return {
          prompt,
          options
        };
      }
    );

  return rounds;
}

function vibeLabel(
  vibe
) {
  return (
    VIBES[vibe]?.label ??
    vibe
  );
}

export async function generatePromptBatch({
  vibe,
  roundCount
}) {
  const count =
    Number(roundCount);

  if (
    !Number.isInteger(count) ||
    count < 6 ||
    count > 8
  ) {
    return fallbackResult(
      Math.max(
        6,
        Math.min(
          8,
          Number.isInteger(count)
            ? count
            : 7
        )
      ),
      "The requested game length was invalid."
    );
  }

  const profile =
    VIBES[vibe];

  if (!profile) {
    return fallbackResult(
      count,
      "The selected vibe was invalid."
    );
  }

  const client =
    createClient();

  if (!client) {
    return fallbackResult(
      count,
      "OPENAI_API_KEY is not configured."
    );
  }

  const generationSeed =
    crypto
      .randomBytes(8)
      .toString("hex");

  const systemPrompt = `
You create content for Waveline, a fast multiplayer prediction party game.

The Caller sees a prompt but initially does NOT see the answer choices.
Every other player privately votes for one of four short answer choices.
The Caller later guesses which choice will receive the most votes.

Generate exactly ${count} rounds.

Vibe:
${vibeLabel(vibe)}

Vibe requirements:
${profile.description}

General content requirements:
- Each round must be fun to discuss and easy to understand immediately.
- The prompt should create a meaningful reason for a group to disagree or converge.
- Favor questions with four plausible choices rather than obvious factual multiple-choice questions.
- Players should be able to pick an answer quickly on a phone.
- Keep prompts concise.
- Keep answer choices short and punchy.
- Make all four options distinct and plausible.
- Do not make one option obviously correct because of wording length.
- Do not include answer labels such as A, B, C, D or 1, 2, 3, 4.
- Do not reveal a "correct answer"; Waveline determines the winning answer by player votes.
- Do not repeat concepts or phrasing across rounds.
- Do not target real private people.
- Avoid political persuasion or partisan campaigning.
- Avoid sexual content, graphic violence, hateful content, slurs, or instructions for dangerous wrongdoing.
- Roast Night must remain playful and non-targeted.
- Family Safe must be appropriate for children.

Freshness seed:
${generationSeed}

Return ONLY data matching the supplied JSON schema.
`.trim();

  const userPrompt = `
Create a fresh ${count}-round Waveline game for the "${vibeLabel(
    vibe
  )}" vibe.

The whole batch must feel intentionally different from previous games.
Make the options specific enough to be interesting but broad enough that a normal group could plausibly vote for any of them.
`.trim();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      OPENAI_TIMEOUT_MS
    );

  try {
    const response =
      await client.responses.create(
        {
          model:
            OPENAI_MODEL,

          input:
            `${systemPrompt}\n\n${userPrompt}`,

          text: {
            format: {
              type:
                "json_schema",

              name:
                "waveline_game_batch",

              strict:
                true,

              schema:
                OUTPUT_SCHEMA
            }
          },

          max_output_tokens:
            4_000
        },
        {
          signal:
            controller.signal,

          timeout:
            OPENAI_TIMEOUT_MS,

          maxRetries:
            0
        }
      );

    const raw =
      String(
        response?.output_text ||
          ""
      ).trim();

    if (!raw) {
      throw new Error(
        "OpenAI returned no output text."
      );
    }

    let parsed;

    try {
      parsed =
        JSON.parse(raw);
    } catch {
      throw new Error(
        "OpenAI output was not valid JSON."
      );
    }

    const rounds =
      validateGeneratedBatch(
        parsed,
        count
      );

    return {
      rounds,

      source:
        "openai",

      model:
        OPENAI_MODEL,

      message:
        `Fresh AI-generated ${vibeLabel(vibe)} content loaded.`
    };
  } catch (
    error
  ) {
    const message =
      error?.name ===
          "AbortError" ||
      error?.name ===
          "APIUserAbortError"
        ? "The OpenAI generation request timed out."
        : error?.message ||
          "The OpenAI request failed.";

    return fallbackResult(
      count,
      message
    );
  } finally {
    clearTimeout(
      timeout
    );
  }
}

export function getVibeLabel(
  vibe
) {
  return (
    VIBES[vibe]?.label ??
    "Family Safe"
  );
}
