import crypto from "node:crypto";

import {
  generatePromptBatch,
  VIBE_IDS,
  getVibeLabel
} from "./ai.js";

import {
  getTestPromptBatch
} from "./prompts.js";


/*
 * ==================================================
 * CENTRAL SCORING RULES
 * ==================================================
 */

export const SCORING_RULES =
  Object.freeze({
    EVERYONE_WHEN_CALLER_CORRECT:
      1,

    MAJORITY_VOTE:
      1,

    CALLER_BONUS:
      1
  });


const ROUND_INTRO_MS =
  3_000;

const VOTING_MS =
  12_000;

const CALLER_GUESS_MS =
  8_000;

const REVEAL_MS =
  5_000;

const MIN_ROUNDS =
  6;

const MAX_ROUNDS =
  8;

const DEFAULT_ROUNDS =
  7;

const DEFAULT_VIBE =
  "family";


function createGameState() {
  return {
    status:
      "lobby",

    phase:
      "lobby",

    vibe:
      DEFAULT_VIBE,

    contentSource:
      null,

    contentModel:
      null,

    generationMessage:
      "",

    generationId:
      null,

    totalRounds:
      DEFAULT_ROUNDS,

    roundNumber:
      0,

    prompts:
      [],

    currentPrompt:
      null,

    callerId:
      null,

    votes:
      new Map(),

    callerGuess:
      null,

    winningOptionIndex:
      null,

    callerCorrect:
      null,

    phaseStartedAt:
      null,

    phaseEndsAt:
      null,

    rotationOrder:
      [],

    rotationCursor:
      -1,

    timer:
      null,

    notice:
      "",

    roundPoints:
      new Map(),

    scoredRoundNumber:
      0
  };
}


function isValidRoundCount(
  value
) {
  return [
    MIN_ROUNDS,
    MIN_ROUNDS + 1,
    MAX_ROUNDS
  ].includes(
    Number(value)
  );
}


function isValidVibe(
  value
) {
  return VIBE_IDS.includes(
    String(value)
  );
}


function connectedActivePlayers(
  room
) {
  return [
    ...room.players.values()
  ]
    .filter(
      (player) =>
        player.activeInGame &&
        player.connected
    )
    .sort(
      (a, b) =>
        a.joinedAt -
        b.joinedAt
    );
}


function activePlayers(
  room
) {
  return [
    ...room.players.values()
  ]
    .filter(
      (player) =>
        player.activeInGame
    )
    .sort(
      (a, b) =>
        a.joinedAt -
        b.joinedAt
    );
}


function playerNickname(
  room,
  playerId
) {
  return (
    room.players.get(
      playerId
    )?.nickname ??
    null
  );
}


function optionVoteCounts(
  game
) {
  if (
    !game.currentPrompt
  ) {
    return [];
  }

  const counts =
    game.currentPrompt.options.map(
      () => 0
    );

  for (
    const optionIndex
    of game.votes.values()
  ) {
    if (
      Number.isInteger(
        optionIndex
      ) &&
      optionIndex >= 0 &&
      optionIndex <
        counts.length
    ) {
      counts[
        optionIndex
      ] += 1;
    }
  }

  return counts;
}


function pickWinningOption(
  game
) {
  if (
    !game.currentPrompt
  ) {
    return null;
  }

  const counts =
    optionVoteCounts(
      game
    );

  let winner =
    null;

  let highest =
    0;

  /*
   * Strict ">" preserves the established deterministic
   * tie rule: earliest option wins.
   */
  for (
    let i = 0;
    i < counts.length;
    i += 1
  ) {
    if (
      counts[i] >
      highest
    ) {
      highest =
        counts[i];

      winner =
        i;
    }
  }

  return winner;
}


function buildLeaderboard(
  room
) {
  const players =
    [...room.players.values()]
      .sort(
        (a, b) => {
          const scoreDifference =
            Number(
              b.score || 0
            ) -
            Number(
              a.score || 0
            );

          if (
            scoreDifference !==
            0
          ) {
            return scoreDifference;
          }

          return (
            a.joinedAt -
            b.joinedAt
          );
        }
      );

  let previousScore =
    null;

  let previousRank =
    0;

  return players.map(
    (player, index) => {
      const score =
        Number(
          player.score || 0
        );

      let rank;

      if (
        previousScore ===
          null ||
        score !==
          previousScore
      ) {
        rank =
          index + 1;

        previousRank =
          rank;
      } else {
        rank =
          previousRank;
      }

      previousScore =
        score;

      return {
        id:
          player.id,

        nickname:
          player.nickname,

        score,

        rank,

        connected:
          player.connected
      };
    }
  );
}


function getWinners(
  leaderboard
) {
  if (
    leaderboard.length ===
    0
  ) {
    return [];
  }

  const highestScore =
    leaderboard[0].score;

  return leaderboard.filter(
    (entry) =>
      entry.score ===
      highestScore
  );
}


export class GameEngine {
  constructor({
    broadcastRoomState
  }) {
    this.broadcastRoomState =
      broadcastRoomState;
  }


  ensureGame(
    room
  ) {
    if (!room.game) {
      room.game =
        createGameState();
    }

    return room.game;
  }


  clearTimer(
    game
  ) {
    if (game.timer) {
      clearTimeout(
        game.timer
      );

      game.timer =
        null;
    }
  }


  resetPlayerScores(
    room
  ) {
    for (
      const player
      of room.players.values()
    ) {
      player.score =
        0;
    }
  }


  ensureRotationOrder(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    const activeIds =
      new Set(
        activePlayers(room).map(
          (player) =>
            player.id
        )
      );

    game.rotationOrder =
      game.rotationOrder.filter(
        (id) =>
          activeIds.has(
            id
          )
      );

    const known =
      new Set(
        game.rotationOrder
      );

    for (
      const player
      of activePlayers(room)
    ) {
      if (
        !known.has(
          player.id
        )
      ) {
        game.rotationOrder.push(
          player.id
        );
      }
    }
  }


  chooseCaller(
    room,
    avoidPlayerId = null
  ) {
    const game =
      this.ensureGame(
        room
      );

    this.ensureRotationOrder(
      room
    );

    if (
      game.rotationOrder.length ===
      0
    ) {
      return null;
    }

    const length =
      game.rotationOrder.length;

    let startIndex =
      game.rotationCursor +
      1;

    if (
      game.rotationCursor <
        0 ||
      game.rotationCursor >=
        length
    ) {
      startIndex =
        0;
    }

    for (
      let offset = 0;
      offset < length;
      offset += 1
    ) {
      const index =
        (startIndex +
          offset) %
        length;

      const playerId =
        game.rotationOrder[
          index
        ];

      const player =
        room.players.get(
          playerId
        );

      if (
        !player ||
        !player.activeInGame ||
        !player.connected
      ) {
        continue;
      }

      if (
        avoidPlayerId &&
        playerId ===
          avoidPlayerId &&
        length > 1
      ) {
        continue;
      }

      game.rotationCursor =
        index;

      return playerId;
    }

    return null;
  }


  activateQueuedPlayers(
    room
  ) {
    for (
      const player
      of room.players.values()
    ) {
      if (
        !player.activeInGame ||
        player.queuedForNextRound
      ) {
        player.activeInGame =
          true;

        player.queuedForNextRound =
          false;
      }
    }

    this.ensureRotationOrder(
      room
    );
  }


  handlePlayerJoined(
    room,
    player
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status ===
        "lobby" ||
      game.status ===
        "generating"
    ) {
      player.activeInGame =
        true;

      player.queuedForNextRound =
        false;

      this.ensureRotationOrder(
        room
      );

      return;
    }

    player.activeInGame =
      false;

    player.queuedForNextRound =
      true;

    this.ensureRotationOrder(
      room
    );
  }


  handlePlayerConnected(
    room,
    player
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status ===
        "playing" &&
      game.callerId ===
        null &&
      player.activeInGame
    ) {
      const replacement =
        this.chooseCaller(
          room
        );

      if (replacement) {
        game.callerId =
          replacement;

        game.votes.delete(
          replacement
        );

        game.notice =
          `${playerNickname(
            room,
            replacement
          )} is now the Caller.`;

        this.broadcastRoomState(
          room
        );
      }
    }
  }


  handlePlayerDisconnected(
    room,
    playerId
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status !==
        "playing" ||
      game.callerId !==
        playerId
    ) {
      return;
    }

    /*
     * During reveal the Caller identity stays stable so
     * scoring and final feedback remain tied to the person
     * whose prediction was evaluated.
     */
    if (
      game.phase ===
      "reveal"
    ) {
      game.notice =
        `${playerNickname(
          room,
          playerId
        )} disconnected during the reveal.`;

      this.broadcastRoomState(
        room
      );

      return;
    }

    const replacement =
      this.chooseCaller(
        room,
        playerId
      );

    if (replacement) {
      game.callerId =
        replacement;

      game.votes.delete(
        replacement
      );

      game.notice =
        `${playerNickname(
          room,
          playerId
        )} disconnected. ${
          playerNickname(
            room,
            replacement
          )
        } is now the Caller.`;

      this.broadcastRoomState(
        room
      );

      return;
    }

    game.callerId =
      null;

    game.notice =
      "The Caller disconnected and no replacement is currently connected.";

    if (
      game.phase ===
      "caller_guess"
    ) {
      this.clearTimer(
        game
      );

      game.phase =
        "reveal";

      game.phaseStartedAt =
        Date.now();

      game.phaseEndsAt =
        Date.now() +
        REVEAL_MS;

      game.winningOptionIndex =
        pickWinningOption(
          game
        );

      game.callerCorrect =
        null;

      this.scoreCurrentRound(
        room
      );

      game.timer =
        setTimeout(
          () => {
            this.finishReveal(
              room
            );
          },
          REVEAL_MS
        );

      this.broadcastRoomState(
        room
      );

      return;
    }

    this.broadcastRoomState(
      room
    );
  }


  handlePlayerRemoved(
    room,
    player
  ) {
    const game =
      this.ensureGame(
        room
      );

    game.rotationOrder =
      game.rotationOrder.filter(
        (id) =>
          id !==
          player.id
      );

    game.roundPoints.delete(
      player.id
    );

    if (
      game.callerId ===
      player.id
    ) {
      game.callerId =
        null;

      if (
        game.status ===
          "playing" &&
        game.phase !==
          "reveal"
      ) {
        const replacement =
          this.chooseCaller(
            room
          );

        if (
          replacement
        ) {
          game.callerId =
            replacement;

          game.votes.delete(
            replacement
          );
        }
      }
    }

    this.broadcastRoomState(
      room
    );
  }


  canStart(
    room
  ) {
    return (
      room.host.connected &&
      connectedActivePlayers(
        room
      ).length >=
        3
    );
  }


  async startGame(
    room,
    requestedRounds =
      DEFAULT_ROUNDS,
    requestedVibe =
      DEFAULT_VIBE
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status !==
      "lobby"
    ) {
      return {
        ok:
          false,

        errorCode:
          "GAME_ALREADY_STARTED",

        error:
          "A game is already running."
      };
    }

    if (
      !isValidRoundCount(
        requestedRounds
      )
    ) {
      return {
        ok:
          false,

        errorCode:
          "INVALID_ROUND_COUNT",

        error:
          "Choose 6, 7, or 8 rounds."
      };
    }

    if (
      !isValidVibe(
        requestedVibe
      )
    ) {
      return {
        ok:
          false,

        errorCode:
          "INVALID_VIBE",

        error:
          "Choose one of the available Waveline vibes."
      };
    }

    if (
      !this.canStart(
        room
      )
    ) {
      return {
        ok:
          false,

        errorCode:
          "NOT_ENOUGH_PLAYERS",

        error:
          "At least 3 connected players are required."
      };
    }

    this.clearTimer(
      game
    );

    this.resetPlayerScores(
      room
    );

    game.roundPoints.clear();

    const generationId =
      crypto.randomUUID();

    game.generationId =
      generationId;

    game.status =
      "generating";

    game.phase =
      "generating";

    game.vibe =
      requestedVibe;

    game.contentSource =
      null;

    game.contentModel =
      null;

    game.generationMessage =
      `Creating a fresh ${getVibeLabel(
        requestedVibe
      )} game...`;

    game.totalRounds =
      Number(
        requestedRounds
      );

    game.roundNumber =
      0;

    game.prompts =
      [];

    game.currentPrompt =
      null;

    game.callerId =
      null;

    game.votes.clear();

    game.callerGuess =
      null;

    game.winningOptionIndex =
      null;

    game.callerCorrect =
      null;

    game.phaseStartedAt =
      null;

    game.phaseEndsAt =
      null;

    game.rotationOrder =
      [];

    game.rotationCursor =
      -1;

    game.scoredRoundNumber =
      0;

    game.notice =
      "";

    this.broadcastRoomState(
      room
    );

    let result;

    try {
      result =
        await generatePromptBatch({
          vibe:
            requestedVibe,

          roundCount:
            game.totalRounds
        });
    } catch (
      error
    ) {
      console.error(
        "[Waveline AI] Unexpected generation error:",
        error
      );

      result = {
        rounds:
          getTestPromptBatch(
            game.totalRounds
          ),

        source:
          "fallback",

        model:
          null,

        message:
          "Prompt generation encountered an unexpected error. Built-in prompts are being used."
      };
    }

    /*
     * A Play Again/reset operation invalidates the old
     * generation request.
     */
    if (
      game.generationId !==
        generationId ||
      game.status !==
        "generating"
    ) {
      return {
        ok:
          true,

        cancelled:
          true
      };
    }

    const readyPlayers =
      connectedActivePlayers(
        room
      );

    if (
      readyPlayers.length <
      3
    ) {
      game.status =
        "lobby";

      game.phase =
        "lobby";

      game.generationId =
        null;

      game.prompts =
        [];

      game.generationMessage =
        "";

      game.notice =
        "The game needs at least 3 connected players. Reconnect players and start again.";

      this.broadcastRoomState(
        room
      );

      return {
        ok:
          false,

        errorCode:
          "NOT_ENOUGH_PLAYERS_AFTER_GENERATION",

        error:
          "Fewer than 3 players are connected now. The generated game was discarded safely."
      };
    }

    if (
      !Array.isArray(
        result?.rounds
      ) ||
      result.rounds.length !==
        game.totalRounds
    ) {
      result = {
        rounds:
          getTestPromptBatch(
            game.totalRounds
          ),

        source:
          "fallback",

        model:
          null,

        message:
          "The generated batch was invalid, so Waveline switched to its built-in prompts."
      };
    }

    game.prompts =
      result.rounds;

    game.contentSource =
      result.source;

    game.contentModel =
      result.model;

    game.generationMessage =
      result.message;

    game.status =
      "playing";

    game.phase =
      "round_start";

    game.generationId =
      null;

    game.rotationOrder =
      activePlayers(
        room
      ).map(
        (player) =>
          player.id
      );

    game.rotationCursor =
      -1;

    this.activateQueuedPlayers(
      room
    );

    game.callerId =
      this.chooseCaller(
        room
      );

    if (
      !game.callerId
    ) {
      game.status =
        "lobby";

      game.phase =
        "lobby";

      game.prompts =
        [];

      game.notice =
        "No connected player could become the Caller.";

      this.broadcastRoomState(
        room
      );

      return {
        ok:
          false,

        errorCode:
          "NO_CALLER",

        error:
          "No connected player could become the Caller."
      };
    }

    this.beginNextRound(
      room
    );

    return {
      ok:
        true
    };
  }


  async playAgain(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status !==
      "complete"
    ) {
      return {
        ok:
          false,

        errorCode:
          "GAME_NOT_COMPLETE",

        error:
          "Play Again is only available after the game ends."
      };
    }

    const rounds =
      game.totalRounds;

    const vibe =
      game.vibe;

    /*
     * Keep the same room and player records.
     * Only the game session and scores are reset.
     */
    this.prepareLobby(
      room
    );

    this.broadcastRoomState(
      room
    );

    return this.startGame(
      room,
      rounds,
      vibe
    );
  }


  prepareLobby(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    this.clearTimer(
      game
    );

    /*
     * Invalidate every in-flight content request.
     */
    game.generationId =
      crypto.randomUUID();

    game.status =
      "lobby";

    game.phase =
      "lobby";

    game.roundNumber =
      0;

    game.currentPrompt =
      null;

    game.prompts =
      [];

    game.callerId =
      null;

    game.votes.clear();

    game.callerGuess =
      null;

    game.winningOptionIndex =
      null;

    game.callerCorrect =
      null;

    game.phaseStartedAt =
      null;

    game.phaseEndsAt =
      null;

    game.rotationOrder =
      [];

    game.rotationCursor =
      -1;

    game.contentSource =
      null;

    game.contentModel =
      null;

    game.generationMessage =
      "";

    game.roundPoints.clear();

    game.scoredRoundNumber =
      0;

    game.notice =
      "";

    this.resetPlayerScores(
      room
    );

    /*
     * All players already in the room remain in the
     * roster and are eligible for the next game.
     */
    for (
      const player
      of room.players.values()
    ) {
      player.activeInGame =
        true;

      player.queuedForNextRound =
        false;
    }
  }


  resetGame(
    room
  ) {
    this.prepareLobby(
      room
    );

    this.broadcastRoomState(
      room
    );
  }


  beginNextRound(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    this.clearTimer(
      game
    );

    if (
      game.roundNumber >=
      game.totalRounds
    ) {
      this.completeGame(
        room
      );

      return;
    }

    this.activateQueuedPlayers(
      room
    );

    const previousCaller =
      game.callerId;

    if (
      game.roundNumber > 0
    ) {
      game.callerId =
        this.chooseCaller(
          room,
          previousCaller
        );
    }

    if (
      !game.callerId
    ) {
      game.callerId =
        this.chooseCaller(
          room
        );
    }

    if (
      !game.callerId
    ) {
      game.notice =
        "No connected Caller is available right now.";

      this.broadcastRoomState(
        room
      );

      return;
    }

    game.roundNumber +=
      1;

    const prompt =
      game.prompts[
        game.roundNumber -
          1
      ];

    game.currentPrompt = {
      prompt:
        prompt.prompt,

      options:
        [
          ...prompt.options
        ]
    };

    game.votes.clear();

    game.callerGuess =
      null;

    game.winningOptionIndex =
      null;

    game.callerCorrect =
      null;

    game.roundPoints.clear();

    game.notice =
      "";

    this.startTimedPhase(
      room,
      "round_start",
      ROUND_INTRO_MS
    );
  }


  startTimedPhase(
    room,
    phase,
    durationMs
  ) {
    const game =
      this.ensureGame(
        room
      );

    this.clearTimer(
      game
    );

    game.phase =
      phase;

    const now =
      Date.now();

    game.phaseStartedAt =
      now;

    game.phaseEndsAt =
      now + durationMs;

    game.timer =
      setTimeout(
        () => {
          this.handlePhaseTimeout(
            room
          );
        },
        durationMs
      );

    this.broadcastRoomState(
      room
    );
  }


  handlePhaseTimeout(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status !==
      "playing"
    ) {
      return;
    }

    switch (
      game.phase
    ) {
      case "round_start":
        this.beginVoting(
          room
        );
        break;

      case "voting":
        this.beginCallerGuess(
          room
        );
        break;

      case "caller_guess":
        this.finishCallerGuess(
          room
        );
        break;

      case "reveal":
        this.finishReveal(
          room
        );
        break;

      default:
        break;
    }
  }


  beginVoting(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    this.clearTimer(
      game
    );

    if (
      !game.callerId
    ) {
      game.winningOptionIndex =
        pickWinningOption(
          game
        );

      this.beginReveal(
        room
      );

      return;
    }

    game.votes.clear();

    this.startTimedPhase(
      room,
      "voting",
      VOTING_MS
    );
  }


  handleVote(
    room,
    playerId,
    optionIndex
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status !==
        "playing" ||
      game.phase !==
        "voting"
    ) {
      return {
        ok:
          false,

        errorCode:
          "VOTING_CLOSED",

        error:
          "Voting is not open right now."
      };
    }

    const player =
      room.players.get(
        playerId
      );

    if (!player) {
      return {
        ok:
          false,

        errorCode:
          "PLAYER_NOT_FOUND",

        error:
          "Player not found."
      };
    }

    if (
      !player.activeInGame ||
      !player.connected
    ) {
      return {
        ok:
          false,

        errorCode:
          "PLAYER_NOT_ELIGIBLE",

        error:
          "You cannot vote in this round."
      };
    }

    if (
      playerId ===
      game.callerId
    ) {
      return {
        ok:
          false,

        errorCode:
          "CALLER_CANNOT_VOTE",

        error:
          "The Caller cannot vote."
      };
    }

    if (
      !Number.isInteger(
        optionIndex
      ) ||
      !game.currentPrompt ||
      optionIndex < 0 ||
      optionIndex >=
        game.currentPrompt
          .options.length
    ) {
      return {
        ok:
          false,

        errorCode:
          "INVALID_OPTION",

        error:
          "That answer option is invalid."
      };
    }

    game.votes.set(
      playerId,
      optionIndex
    );

    game.notice =
      "";

    const eligible =
      connectedActivePlayers(
        room
      ).filter(
        (candidate) =>
          candidate.id !==
          game.callerId
      );

    const everyoneVoted =
      eligible.length >
        0 &&
      eligible.every(
        (candidate) =>
          game.votes.has(
            candidate.id
          )
      );

    if (
      everyoneVoted
    ) {
      this.beginCallerGuess(
        room
      );
    } else {
      this.broadcastRoomState(
        room
      );
    }

    return {
      ok:
        true
    };
  }


  beginCallerGuess(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    this.clearTimer(
      game
    );

    game.winningOptionIndex =
      pickWinningOption(
        game
      );

    if (
      game.callerId
    ) {
      game.votes.delete(
        game.callerId
      );
    }

    if (
      !game.callerId
    ) {
      this.beginReveal(
        room
      );

      return;
    }

    game.callerGuess =
      null;

    this.startTimedPhase(
      room,
      "caller_guess",
      CALLER_GUESS_MS
    );
  }


  handleCallerGuess(
    room,
    playerId,
    optionIndex
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status !==
        "playing" ||
      game.phase !==
        "caller_guess"
    ) {
      return {
        ok:
          false,

        errorCode:
          "GUESS_CLOSED",

        error:
          "The Caller is not choosing right now."
      };
    }

    if (
      game.callerId !==
      playerId
    ) {
      return {
        ok:
          false,

        errorCode:
          "NOT_CALLER",

        error:
          "Only the current Caller can make this guess."
      };
    }

    if (
      !Number.isInteger(
        optionIndex
      ) ||
      !game.currentPrompt ||
      optionIndex < 0 ||
      optionIndex >=
        game.currentPrompt
          .options.length
    ) {
      return {
        ok:
          false,

        errorCode:
          "INVALID_OPTION",

        error:
          "That answer option is invalid."
      };
    }

    game.callerGuess =
      optionIndex;

    this.finishCallerGuess(
      room
    );

    return {
      ok:
        true
    };
  }


  finishCallerGuess(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status !==
        "playing" ||
      game.phase !==
        "caller_guess"
    ) {
      return;
    }

    if (
      game.callerGuess ===
      null
    ) {
      game.notice =
        "Time expired. The Caller made no guess.";
    }

    this.beginReveal(
      room
    );
  }


  scoreCurrentRound(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.roundNumber <=
      0
    ) {
      return;
    }

    if (
      game.scoredRoundNumber ===
      game.roundNumber
    ) {
      return;
    }

    game.roundPoints.clear();

    const participants =
      activePlayers(
        room
      );

    for (
      const player
      of participants
    ) {
      game.roundPoints.set(
        player.id,
        0
      );
    }

    const winningOption =
      game.winningOptionIndex;

    const callerCorrect =
      game.callerCorrect ===
      true;

    if (
      callerCorrect
    ) {
      for (
        const player
        of participants
      ) {
        const points =
          game.roundPoints.get(
            player.id
          ) || 0;

        game.roundPoints.set(
          player.id,
          points +
            SCORING_RULES
              .EVERYONE_WHEN_CALLER_CORRECT
        );
      }
    }

    if (
      winningOption !==
        null
    ) {
      for (
        const [
          playerId,
          vote
        ] of game.votes.entries()
      ) {
        if (
          vote !==
          winningOption
        ) {
          continue;
        }

        const player =
          room.players.get(
            playerId
          );

        if (
          !player ||
          !player.activeInGame
        ) {
          continue;
        }

        const points =
          game.roundPoints.get(
            playerId
          ) || 0;

        game.roundPoints.set(
          playerId,
          points +
            SCORING_RULES
              .MAJORITY_VOTE
        );
      }
    }

    if (
      callerCorrect &&
      game.callerId
    ) {
      const caller =
        room.players.get(
          game.callerId
        );

      if (
        caller &&
        caller.activeInGame
      ) {
        const points =
          game.roundPoints.get(
            caller.id
          ) || 0;

        game.roundPoints.set(
          caller.id,
          points +
            SCORING_RULES
              .CALLER_BONUS
        );
      }
    }

    for (
      const player
      of participants
    ) {
      const earned =
        game.roundPoints.get(
          player.id
        ) || 0;

      player.score =
        Number(
          player.score || 0
        ) + earned;
    }

    game.scoredRoundNumber =
      game.roundNumber;
  }


  beginReveal(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    this.clearTimer(
      game
    );

    game.winningOptionIndex =
      pickWinningOption(
        game
      );

    if (
      game.callerGuess !==
        null &&
      game.winningOptionIndex !==
        null
    ) {
      game.callerCorrect =
        game.callerGuess ===
        game.winningOptionIndex;
    } else {
      game.callerCorrect =
        null;
    }

    this.scoreCurrentRound(
      room
    );

    this.startTimedPhase(
      room,
      "reveal",
      REVEAL_MS
    );
  }


  finishReveal(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status !==
        "playing" ||
      game.phase !==
        "reveal"
    ) {
      return;
    }

    this.clearTimer(
      game
    );

    if (
      game.roundNumber >=
      game.totalRounds
    ) {
      this.completeGame(
        room
      );

      return;
    }

    this.beginNextRound(
      room
    );
  }


  completeGame(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    this.clearTimer(
      game
    );

    if (
      game.roundNumber > 0 &&
      game.scoredRoundNumber !==
        game.roundNumber
    ) {
      this.scoreCurrentRound(
        room
      );
    }

    game.status =
      "complete";

    game.phase =
      "complete";

    game.phaseStartedAt =
      null;

    game.phaseEndsAt =
      null;

    game.notice =
      "Game complete.";

    this.broadcastRoomState(
      room
    );
  }


  getHostRoundPoints(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    return activePlayers(
      room
    ).map(
      (player) => ({
        id:
          player.id,

        nickname:
          player.nickname,

        pointsThisRound:
          Number(
            game.roundPoints.get(
              player.id
            ) || 0
          ),

        totalScore:
          Number(
            player.score || 0
          )
      })
    );
  }


  getPlayerRoundPoints(
    room,
    player
  ) {
    const game =
      this.ensureGame(
        room
      );

    return Number(
      game.roundPoints.get(
        player.id
      ) || 0
    );
  }


  getGameSummary(
    room
  ) {
    const game =
      this.ensureGame(
        room
      );

    const voteCounts =
      optionVoteCounts(
        game
      );

    const currentCaller =
      game.callerId
        ? room.players.get(
            game.callerId
          )
        : null;

    const showAnswerData =
      game.phase ===
        "caller_guess" ||
      game.phase ===
        "reveal" ||
      game.phase ===
        "complete";

    const showRoundScores =
      game.phase ===
        "reveal" ||
      game.phase ===
        "complete";

    const leaderboard =
      game.phase ===
      "complete"
        ? buildLeaderboard(
            room
          )
        : [];

    const winners =
      game.phase ===
      "complete"
        ? getWinners(
            leaderboard
          )
        : [];

    const winnerType =
      winners.length <= 1
        ? "single"
        : "tie";

    return {
      status:
        game.status,

      phase:
        game.phase,

      vibe:
        game.vibe,

      vibeLabel:
        getVibeLabel(
          game.vibe
        ),

      contentSource:
        game.contentSource,

      contentModel:
        game.contentModel,

      generationMessage:
        game.generationMessage,

      totalRounds:
        game.totalRounds,

      roundNumber:
        game.roundNumber,

      prompt:
        game.currentPrompt
          ?.prompt ??
        null,

      options:
        showAnswerData
          ? game.currentPrompt
              ?.options ??
            []
          : [],

      callerId:
        game.callerId,

      callerNickname:
        currentCaller
          ?.nickname ??
        null,

      phaseStartedAt:
        game.phaseStartedAt,

      phaseEndsAt:
        game.phaseEndsAt,

      winningOptionIndex:
        showAnswerData
          ? game.winningOptionIndex
          : null,

      callerGuess:
        showAnswerData
          ? game.callerGuess
          : null,

      callerCorrect:
        showAnswerData
          ? game.callerCorrect
          : null,

      voteCounts:
        showAnswerData
          ? voteCounts
          : [],

      voteTotal:
        game.votes.size,

      roundPoints:
        showRoundScores
          ? this.getHostRoundPoints(
              room
            )
          : [],

      scoringRules:
        SCORING_RULES,

      leaderboard,

      winners,

      winnerType,

      winnerScore:
        winners.length > 0
          ? winners[0].score
          : 0,

      notice:
        game.notice ||
        ""
    };
  }


  getPlayerGameState(
    room,
    player
  ) {
    const game =
      this.ensureGame(
        room
      );

    if (
      game.status ===
      "generating"
    ) {
      return {
        status:
          "generating",

        phase:
          "generating",

        vibe:
          game.vibe,

        vibeLabel:
          getVibeLabel(
            game.vibe
          ),

        contentSource:
          null,

        contentModel:
          null,

        generationMessage:
          game.generationMessage,

        totalRounds:
          game.totalRounds,

        roundNumber:
          0,

        prompt:
          null,

        options:
          [],

        callerId:
          null,

        callerNickname:
          null,

        phaseStartedAt:
          null,

        phaseEndsAt:
          null,

        winningOptionIndex:
          null,

        callerGuess:
          null,

        callerCorrect:
          null,

        voteCounts:
          [],

        myVote:
          null,

        canVote:
          false,

        canGuess:
          false,

        isCaller:
          false,

        score:
          Number(
            player.score || 0
          ),

        myRoundPoints:
          0,

        leaderboard:
          [],

        winners:
          [],

        winnerType:
          "single",

        notice:
          ""
      };
    }

    if (
      game.status ===
      "lobby"
    ) {
      return {
        status:
          "lobby",

        phase:
          "lobby",

        vibe:
          game.vibe,

        vibeLabel:
          getVibeLabel(
            game.vibe
          ),

        contentSource:
          null,

        contentModel:
          null,

        generationMessage:
          "",

        totalRounds:
          game.totalRounds,

        roundNumber:
          0,

        prompt:
          null,

        options:
          [],

        callerId:
          null,

        callerNickname:
          null,

        phaseStartedAt:
          null,

        phaseEndsAt:
          null,

        winningOptionIndex:
          null,

        callerGuess:
          null,

        callerCorrect:
          null,

        voteCounts:
          [],

        myVote:
          null,

        canVote:
          false,

        canGuess:
          false,

        isCaller:
          false,

        score:
          Number(
            player.score || 0
          ),

        myRoundPoints:
          0,

        leaderboard:
          [],

        winners:
          [],

        winnerType:
          "single",

        notice:
          game.notice ||
          ""
      };
    }

    if (
      game.status ===
      "complete"
    ) {
      const leaderboard =
        buildLeaderboard(
          room
        );

      const winners =
        getWinners(
          leaderboard
        );

      return {
        ...this.getGameSummary(
          room
        ),

        myVote:
          game.votes.get(
            player.id
          ) ??
          null,

        canVote:
          false,

        canGuess:
          false,

        isCaller:
          player.id ===
          game.callerId,

        score:
          Number(
            player.score || 0
          ),

        myRoundPoints:
          this.getPlayerRoundPoints(
            room,
            player
          ),

        leaderboard,

        winners,

        winnerType:
          winners.length <= 1
            ? "single"
            : "tie"
      };
    }

    if (
      !player.activeInGame &&
      player.queuedForNextRound
    ) {
      return {
        status:
          "playing",

        phase:
          "queued",

        vibe:
          game.vibe,

        vibeLabel:
          getVibeLabel(
            game.vibe
          ),

        contentSource:
          game.contentSource,

        contentModel:
          game.contentModel,

        generationMessage:
          "",

        roundNumber:
          game.roundNumber,

        totalRounds:
          game.totalRounds,

        prompt:
          null,

        options:
          [],

        callerId:
          game.callerId,

        callerNickname:
          playerNickname(
            room,
            game.callerId
          ),

        phaseStartedAt:
          null,

        phaseEndsAt:
          null,

        winningOptionIndex:
          null,

        callerGuess:
          null,

        callerCorrect:
          null,

        voteCounts:
          [],

        myVote:
          null,

        canVote:
          false,

        canGuess:
          false,

        isCaller:
          false,

        score:
          Number(
            player.score || 0
          ),

        myRoundPoints:
          0,

        leaderboard:
          [],

        winners:
          [],

        winnerType:
          "single",

        notice:
          "You joined mid-round. You'll join when the next round begins."
      };
    }

    const isCaller =
      player.id ===
      game.callerId;

    const summary =
      this.getGameSummary(
        room
      );

    let options =
      [];

    if (
      game.phase ===
      "round_start"
    ) {
      if (
        !isCaller
      ) {
        options =
          game.currentPrompt
            ?.options ??
          [];
      }
    } else if (
      game.phase ===
      "voting"
    ) {
      if (
        !isCaller
      ) {
        options =
          game.currentPrompt
            ?.options ??
          [];
      }
    } else {
      options =
        game.currentPrompt
          ?.options ??
        [];
    }

    return {
      ...summary,

      options,

      myVote:
        game.votes.get(
          player.id
        ) ??
        null,

      canVote:
        game.phase ===
          "voting" &&
        !isCaller &&
        player.connected,

      canGuess:
        game.phase ===
          "caller_guess" &&
        isCaller &&
        player.connected,

      isCaller,

      score:
        Number(
          player.score || 0
        ),

      myRoundPoints:
        this.getPlayerRoundPoints(
          room,
          player
        ),

      roundPoints:
        game.phase ===
            "reveal" ||
        game.phase ===
            "complete"
          ? []
          : undefined
    };
  }
}
