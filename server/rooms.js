import crypto from "node:crypto";

const ROOM_CODE_LENGTH = 4;

const MAX_PLAYERS = 10;

const PLAYER_GRACE_MS =
  30 * 60 * 1000;

const ROOM_IDLE_MS =
  2 * 60 * 60 * 1000;

const SAFE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ2346789";

function randomToken(
  bytes = 18
) {
  return crypto
    .randomBytes(bytes)
    .toString("base64url");
}

function randomId() {
  return crypto.randomUUID();
}

function generateRoomCode(
  existingRooms
) {
  while (true) {
    let code = "";

    for (
      let i = 0;
      i < ROOM_CODE_LENGTH;
      i += 1
    ) {
      code +=
        SAFE_ALPHABET[
          crypto.randomInt(
            0,
            SAFE_ALPHABET.length
          )
        ];
    }

    if (
      !existingRooms.has(
        code
      )
    ) {
      return code;
    }
  }
}

function normalizeNickname(
  value
) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

function normalizeRoomCode(
  value
) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    )
    .slice(0, 6);
}

function isValidNickname(
  nickname
) {
  if (
    !nickname ||
    nickname.length > 16
  ) {
    return false;
  }

  for (
    const character of nickname
  ) {
    if (
      character.charCodeAt(0) <
      32
    ) {
      return false;
    }
  }

  return true;
}

class Room {
  constructor(
    code,
    joinUrl,
    qrDataUrl
  ) {
    this.code =
      code;

    this.joinUrl =
      joinUrl;

    this.qrDataUrl =
      qrDataUrl;

    this.createdAt =
      Date.now();

    this.updatedAt =
      Date.now();

    this.host = {
      token:
        randomToken(),

      socket:
        null,

      connected:
        false
    };

    this.players =
      new Map();

    this.game =
      null;
  }

  touch() {
    this.updatedAt =
      Date.now();
  }

  get playerCount() {
    return this.players.size;
  }

  get connectedPlayerCount() {
    let count = 0;

    for (
      const player
      of this.players.values()
    ) {
      if (
        player.connected
      ) {
        count += 1;
      }
    }

    return count;
  }

  isFull() {
    return (
      this.players.size >=
      MAX_PLAYERS
    );
  }

  nicknameExists(
    nickname
  ) {
    const wanted =
      nickname.toLocaleLowerCase();

    for (
      const player
      of this.players.values()
    ) {
      if (
        player.nickname.toLocaleLowerCase() ===
        wanted
      ) {
        return true;
      }
    }

    return false;
  }

  getPublicPlayers() {
    return [
      ...this.players.values()
    ]
      .sort(
        (a, b) =>
          a.joinedAt -
          b.joinedAt
      )
      .map(
        (player) => ({
          id:
            player.id,

          nickname:
            player.nickname,

          connected:
            player.connected,

          activeInGame:
            player.activeInGame,

          queuedForNextRound:
            player.queuedForNextRound,

          score:
            Number(
              player.score || 0
            )
        })
      );
  }

  getPlayerByToken(
    token
  ) {
    if (!token) {
      return null;
    }

    for (
      const player
      of this.players.values()
    ) {
      if (
        player.token ===
        token
      ) {
        return player;
      }
    }

    return null;
  }

  attachHost(
    socket
  ) {
    this.touch();

    const oldSocket =
      this.host.socket;

    this.host.socket =
      socket;

    this.host.connected =
      true;

    if (
      oldSocket &&
      oldSocket !== socket
    ) {
      try {
        oldSocket.close(
          4001,
          "Host session replaced"
        );
      } catch {
        // Already closed.
      }
    }

    return this.host;
  }

  attachPlayer(
    player,
    socket
  ) {
    this.touch();

    const oldSocket =
      player.socket;

    player.socket =
      socket;

    player.connected =
      true;

    player.lastSeenAt =
      Date.now();

    if (
      oldSocket &&
      oldSocket !== socket
    ) {
      try {
        oldSocket.close(
          4001,
          "Player session replaced"
        );
      } catch {
        // Already closed.
      }
    }

    return player;
  }

  detachHost(
    socket
  ) {
    if (
      this.host.socket !==
      socket
    ) {
      return false;
    }

    this.host.socket =
      null;

    this.host.connected =
      false;

    this.touch();

    return true;
  }

  detachPlayer(
    player,
    socket
  ) {
    if (
      player.socket !==
      socket
    ) {
      return false;
    }

    player.socket =
      null;

    player.connected =
      false;

    player.lastSeenAt =
      Date.now();

    this.touch();

    return true;
  }

  shouldCleanup(
    now = Date.now()
  ) {
    const someoneConnected =
      this.host.connected ||
      [...this.players.values()]
        .some(
          (player) =>
            player.connected
        );

    if (
      someoneConnected
    ) {
      return false;
    }

    return (
      now - this.updatedAt >
      ROOM_IDLE_MS
    );
  }

  purgeExpiredPlayers(
    now = Date.now()
  ) {
    const removedPlayers =
      [];

    for (
      const [id, player]
      of this.players.entries()
    ) {
      if (
        !player.connected &&
        now -
          player.lastSeenAt >
          PLAYER_GRACE_MS
      ) {
        this.players.delete(
          id
        );

        removedPlayers.push(
          player
        );
      }
    }

    if (
      removedPlayers.length >
      0
    ) {
      this.touch();
    }

    return removedPlayers;
  }

  removePlayer(
    playerId
  ) {
    const player =
      this.players.get(
        playerId
      );

    if (!player) {
      return null;
    }

    this.players.delete(
      playerId
    );

    this.touch();

    return player;
  }
}

export class RoomManager {
  constructor({
    onPlayerRemoved
  } = {}) {
    this.rooms =
      new Map();

    this.onPlayerRemoved =
      onPlayerRemoved;

    setInterval(
      () => {
        this.cleanup();
      },
      60_000
    ).unref();
  }

  createRoom(
    joinUrl,
    qrDataUrl
  ) {
    const code =
      generateRoomCode(
        this.rooms
      );

    const room =
      new Room(
        code,
        joinUrl,
        qrDataUrl
      );

    this.rooms.set(
      code,
      room
    );

    return room;
  }

  getRoom(
    rawCode
  ) {
    const code =
      normalizeRoomCode(
        rawCode
      );

    return (
      this.rooms.get(
        code
      ) ?? null
    );
  }

  joinRoom(
    rawCode,
    rawNickname
  ) {
    const room =
      this.getRoom(
        rawCode
      );

    if (!room) {
      return {
        ok:
          false,

        errorCode:
          "ROOM_NOT_FOUND",

        error:
          "Room not found. Check the code and try again."
      };
    }

    room.purgeExpiredPlayers();

    if (
      room.isFull()
    ) {
      return {
        ok:
          false,

        errorCode:
          "ROOM_FULL",

        error:
          "This room already has 10 players."
      };
    }

    const nickname =
      normalizeNickname(
        rawNickname
      );

    if (
      !isValidNickname(
        nickname
      )
    ) {
      return {
        ok:
          false,

        errorCode:
          "INVALID_NICKNAME",

        error:
          "Choose a nickname between 1 and 16 characters."
      };
    }

    if (
      room.nicknameExists(
        nickname
      )
    ) {
      return {
        ok:
          false,

        errorCode:
          "DUPLICATE_NICKNAME",

        error:
          "That nickname is already being used in this room."
      };
    }

    const player = {
      id:
        randomId(),

      token:
        randomToken(),

      nickname,

      socket:
        null,

      connected:
        false,

      joinedAt:
        Date.now(),

      lastSeenAt:
        Date.now(),

      activeInGame:
        false,

      queuedForNextRound:
        false,

      score:
        0
    };

    room.players.set(
      player.id,
      player
    );

    room.touch();

    return {
      ok:
        true,

      room,

      player
    };
  }

  resumePlayer(
    rawCode,
    token
  ) {
    const room =
      this.getRoom(
        rawCode
      );

    if (!room) {
      return {
        ok:
          false,

        errorCode:
          "ROOM_NOT_FOUND",

        error:
          "That room no longer exists."
      };
    }

    room.purgeExpiredPlayers();

    const player =
      room.getPlayerByToken(
        token
      );

    if (!player) {
      return {
        ok:
          false,

        errorCode:
          "SESSION_NOT_FOUND",

        error:
          "Your old player session could not be restored."
      };
    }

    room.touch();

    return {
      ok:
        true,

      room,

      player
    };
  }

  resumeHost(
    rawCode,
    token
  ) {
    const room =
      this.getRoom(
        rawCode
      );

    if (!room) {
      return {
        ok:
          false,

        errorCode:
          "ROOM_NOT_FOUND",

        error:
          "That room no longer exists."
      };
    }

    if (
      !token ||
      token !==
        room.host.token
    ) {
      return {
        ok:
          false,

        errorCode:
          "HOST_SESSION_NOT_FOUND",

        error:
          "The host session could not be restored."
      };
    }

    room.touch();

    return {
      ok:
        true,

      room
    };
  }

  cleanup() {
    const now =
      Date.now();

    for (
      const [code, room]
      of this.rooms.entries()
    ) {
      const removedPlayers =
        room.purgeExpiredPlayers(
          now
        );

      for (
        const player
        of removedPlayers
      ) {
        if (
          this.onPlayerRemoved
        ) {
          this.onPlayerRemoved(
            room,
            player
          );
        }
      }

      if (
        room.shouldCleanup(
          now
        )
      ) {
        this.rooms.delete(
          code
        );
      }
    }
  }

  removeSocket(
    socket
  ) {
    const metadata =
      socket._waveline;

    if (!metadata) {
      return null;
    }

    const room =
      this.getRoom(
        metadata.roomCode
      );

    if (!room) {
      return null;
    }

    let changed =
      false;

    if (
      metadata.role ===
      "host"
    ) {
      changed =
        room.detachHost(
          socket
        );
    }

    if (
      metadata.role ===
      "player"
    ) {
      const player =
        room.players.get(
          metadata.playerId
        );

      if (player) {
        changed =
          room.detachPlayer(
            player,
            socket
          );
      }
    }

    return changed
      ? {
          room,
          metadata
        }
      : null;
  }
}

export {
  MAX_PLAYERS,
  PLAYER_GRACE_MS,
  normalizeNickname,
  normalizeRoomCode
};
