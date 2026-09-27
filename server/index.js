import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import QRCode from "qrcode";
import { WebSocketServer } from "ws";

import {
  RoomManager
} from "./rooms.js";

import {
  GameEngine
} from "./game.js";

const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );

const ROOT_DIR =
  path.resolve(
    __dirname,
    ".."
  );

const PUBLIC_DIR =
  path.join(
    ROOT_DIR,
    "public"
  );

const PORT =
  Number(
    process.env.PORT
  ) || 3000;

const app =
  express();

const server =
  http.createServer(
    app
  );

const wss =
  new WebSocketServer({
    noServer:
      true
  });


function sendJson(
  socket,
  payload
) {
  if (
    socket.readyState !==
    1
  ) {
    return;
  }

  try {
    socket.send(
      JSON.stringify(
        payload
      )
    );
  } catch {
    // Connection may have closed.
  }
}


function getWebOrigin(
  req
) {
  const forwardedProto =
    String(
      req.headers[
        "x-forwarded-proto"
      ] ?? ""
    )
      .split(",")[0]
      .trim();

  const protocol =
    forwardedProto ||
    (req.socket.encrypted
      ? "https"
      : "http");

  return (
    `${protocol}://` +
    `${req.headers.host}`
  );
}


function errorResponse(
  errorCode,
  message
) {
  return {
    type:
      "error",

    errorCode,

    message
  };
}


function createHostSnapshot(
  room
) {
  const game =
    gameEngine.getGameSummary(
      room
    );

  return {
    type:
      "state",

    role:
      "host",

    roomCode:
      room.code,

    joinUrl:
      room.joinUrl,

    qrDataUrl:
      room.qrDataUrl,

    hostConnected:
      room.host.connected,

    playerCount:
      room.playerCount,

    connectedPlayerCount:
      room.connectedPlayerCount,

    maxPlayers:
      10,

    minPlayersToStart:
      3,

    players:
      room
        .getPublicPlayers()
        .map(
          (player) => ({
            ...player,

            isCaller:
              game.callerId ===
              player.id
          })
        ),

    game,

    phase:
      game.phase,

    serverNow:
      Date.now()
  };
}


function createPlayerSnapshot(
  room,
  player
) {
  const game =
    gameEngine.getPlayerGameState(
      room,
      player
    );

  return {
    type:
      "state",

    role:
      "player",

    roomCode:
      room.code,

    playerCount:
      room.playerCount,

    connectedPlayerCount:
      room.connectedPlayerCount,

    maxPlayers:
      10,

    minPlayersToStart:
      3,

    players:
      room
        .getPublicPlayers()
        .map(
          (roomPlayer) => ({
            ...roomPlayer,

            score:
              roomPlayer.id ===
              player.id
                ? roomPlayer.score
                : undefined,

            isCaller:
              game.callerId ===
              roomPlayer.id
          })
        ),

    self: {
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
    },

    hostConnected:
      room.host.connected,

    game,

    phase:
      game.phase,

    serverNow:
      Date.now()
  };
}


function broadcastRoomState(
  room
) {
  if (
    room.host.socket
  ) {
    sendJson(
      room.host.socket,
      createHostSnapshot(
        room
      )
    );
  }

  for (
    const player
    of room.players.values()
  ) {
    if (
      player.socket
    ) {
      sendJson(
        player.socket,
        createPlayerSnapshot(
          room,
          player
        )
      );
    }
  }
}


const gameEngine =
  new GameEngine({
    broadcastRoomState
  });


const roomManager =
  new RoomManager({
    onPlayerRemoved:
      (
        room,
        player
      ) => {
        gameEngine.handlePlayerRemoved(
          room,
          player
        );

        broadcastRoomState(
          room
        );
      }
  });


app.disable(
  "x-powered-by"
);

app.use(
  express.static(
    PUBLIC_DIR
  )
);

app.get(
  /.*/,
  (_req, res) => {
    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );
  }
);


function authenticateSocket(
  socket,
  metadata
) {
  socket._waveline =
    metadata;
}


async function handleCreateRoom(
  socket,
  req
) {
  if (
    socket._waveline
  ) {
    sendJson(
      socket,
      errorResponse(
        "ALREADY_AUTHENTICATED",
        "This connection is already attached to a Waveline session."
      )
    );

    return;
  }

  const origin =
    getWebOrigin(
      req
    );

  const room =
    roomManager.createRoom(
      "",
      ""
    );

  const joinUrl =
    new URL(
      `/join/${room.code}`,
      origin
    ).toString();

  room.joinUrl =
    joinUrl;

  try {
    room.qrDataUrl =
      await QRCode.toDataURL(
        joinUrl,
        {
          errorCorrectionLevel:
            "M",

          margin:
            1,

          width:
            420
        }
      );

    if (
      socket.readyState !==
      1
    ) {
      return;
    }

    room.attachHost(
      socket
    );

    authenticateSocket(
      socket,
      {
        role:
          "host",

        roomCode:
          room.code
      }
    );

    sendJson(
      socket,
      {
        type:
          "host_created",

        roomCode:
          room.code,

        hostToken:
          room.host.token
      }
    );

    broadcastRoomState(
      room
    );
  } catch {
    roomManager.rooms.delete(
      room.code
    );

    sendJson(
      socket,
      errorResponse(
        "QR_GENERATION_FAILED",
        "Could not create the room. Please try again."
      )
    );
  }
}


function handleResumeHost(
  socket,
  message
) {
  const result =
    roomManager.resumeHost(
      message.roomCode,
      message.hostToken
    );

  if (
    !result.ok
  ) {
    sendJson(
      socket,
      errorResponse(
        result.errorCode,
        result.error
      )
    );

    return;
  }

  const {
    room
  } = result;

  room.attachHost(
    socket
  );

  authenticateSocket(
    socket,
    {
      role:
        "host",

      roomCode:
        room.code
    }
  );

  sendJson(
    socket,
    {
      type:
        "host_resumed",

      roomCode:
        room.code,

      hostToken:
        room.host.token
    }
  );

  broadcastRoomState(
    room
  );
}


function handleJoinRoom(
  socket,
  message
) {
  if (
    socket._waveline
  ) {
    sendJson(
      socket,
      errorResponse(
        "ALREADY_AUTHENTICATED",
        "This connection is already attached to a Waveline session."
      )
    );

    return;
  }

  const result =
    roomManager.joinRoom(
      message.roomCode,
      message.nickname
    );

  if (
    !result.ok
  ) {
    sendJson(
      socket,
      errorResponse(
        result.errorCode,
        result.error
      )
    );

    return;
  }

  const {
    room,
    player
  } = result;

  gameEngine.handlePlayerJoined(
    room,
    player
  );

  room.attachPlayer(
    player,
    socket
  );

  authenticateSocket(
    socket,
    {
      role:
        "player",

      roomCode:
        room.code,

      playerId:
        player.id
    }
  );

  sendJson(
    socket,
    {
      type:
        "joined",

      roomCode:
        room.code,

      playerToken:
        player.token,

      playerId:
        player.id,

      nickname:
        player.nickname
    }
  );

  broadcastRoomState(
    room
  );
}


function handleResumePlayer(
  socket,
  message
) {
  const result =
    roomManager.resumePlayer(
      message.roomCode,
      message.playerToken
    );

  if (
    !result.ok
  ) {
    sendJson(
      socket,
      errorResponse(
        result.errorCode,
        result.error
      )
    );

    return;
  }

  const {
    room,
    player
  } = result;

  room.attachPlayer(
    player,
    socket
  );

  gameEngine.handlePlayerConnected(
    room,
    player
  );

  authenticateSocket(
    socket,
    {
      role:
        "player",

      roomCode:
        room.code,

      playerId:
        player.id
    }
  );

  sendJson(
    socket,
    {
      type:
        "player_resumed",

      roomCode:
        room.code,

      playerId:
        player.id,

      nickname:
        player.nickname
    }
  );

  broadcastRoomState(
    room
  );
}


async function handleStartGame(
  socket,
  message
) {
  const metadata =
    socket._waveline;

  if (
    !metadata ||
    metadata.role !==
      "host"
  ) {
    sendJson(
      socket,
      errorResponse(
        "NOT_HOST",
        "Only the host can start the game."
      )
    );

    return;
  }

  const room =
    roomManager.getRoom(
      metadata.roomCode
    );

  if (!room) {
    sendJson(
      socket,
      errorResponse(
        "ROOM_NOT_FOUND",
        "Room not found."
      )
    );

    return;
  }

  try {
    const result =
      await gameEngine.startGame(
        room,
        message.totalRounds,
        message.vibe
      );

    if (
      !result.ok
    ) {
      sendJson(
        socket,
        errorResponse(
          result.errorCode,
          result.error
        )
      );
    }
  } catch (
    error
  ) {
    console.error(
      "[Waveline] start_game error:",
      error
    );

    sendJson(
      socket,
      errorResponse(
        "GAME_START_FAILED",
        "The game could not be started. Please try again."
      )
    );

    const currentRoom =
      roomManager.getRoom(
        metadata.roomCode
      );

    if (
      currentRoom
    ) {
      gameEngine.resetGame(
        currentRoom
      );
    }
  }
}


async function handlePlayAgain(
  socket
) {
  const metadata =
    socket._waveline;

  if (
    !metadata ||
    metadata.role !==
      "host"
  ) {
    sendJson(
      socket,
      errorResponse(
        "NOT_HOST",
        "Only the host can start another game."
      )
    );

    return;
  }

  const room =
    roomManager.getRoom(
      metadata.roomCode
    );

  if (!room) {
    sendJson(
      socket,
      errorResponse(
        "ROOM_NOT_FOUND",
        "Room not found."
      )
    );

    return;
  }

  try {
    const result =
      await gameEngine.playAgain(
        room
      );

    if (
      !result.ok
    ) {
      sendJson(
        socket,
        errorResponse(
          result.errorCode,
          result.error
        )
      );
    }
  } catch (
    error
  ) {
    console.error(
      "[Waveline] play_again error:",
      error
    );

    sendJson(
      socket,
      errorResponse(
        "PLAY_AGAIN_FAILED",
        "The next game could not be started."
      )
    );
  }
}


function handleResetGame(
  socket
) {
  const metadata =
    socket._waveline;

  if (
    !metadata ||
    metadata.role !==
      "host"
  ) {
    sendJson(
      socket,
      errorResponse(
        "NOT_HOST",
        "Only the host can reset the game."
      )
    );

    return;
  }

  const room =
    roomManager.getRoom(
      metadata.roomCode
    );

  if (!room) {
    sendJson(
      socket,
      errorResponse(
        "ROOM_NOT_FOUND",
        "Room not found."
      )
    );

    return;
  }

  gameEngine.resetGame(
    room
  );
}


function handleVote(
  socket,
  message
) {
  const metadata =
    socket._waveline;

  if (
    !metadata ||
    metadata.role !==
      "player"
  ) {
    return;
  }

  const room =
    roomManager.getRoom(
      metadata.roomCode
    );

  if (!room) {
    return;
  }

  const result =
    gameEngine.handleVote(
      room,
      metadata.playerId,
      Number(
        message.optionIndex
      )
    );

  if (
    !result.ok
  ) {
    sendJson(
      socket,
      errorResponse(
        result.errorCode,
        result.error
      )
    );
  }

  broadcastRoomState(
    room
  );
}


function handleCallerGuess(
  socket,
  message
) {
  const metadata =
    socket._waveline;

  if (
    !metadata ||
    metadata.role !==
      "player"
  ) {
    return;
  }

  const room =
    roomManager.getRoom(
      metadata.roomCode
    );

  if (!room) {
    return;
  }

  const result =
    gameEngine.handleCallerGuess(
      room,
      metadata.playerId,
      Number(
        message.optionIndex
      )
    );

  if (
    !result.ok
  ) {
    sendJson(
      socket,
      errorResponse(
        result.errorCode,
        result.error
      )
    );
  }

  broadcastRoomState(
    room
  );
}


function handleMessage(
  socket,
  req,
  rawMessage
) {
  let message;

  try {
    message =
      JSON.parse(
        rawMessage.toString()
      );
  } catch {
    sendJson(
      socket,
      errorResponse(
        "INVALID_JSON",
        "The server received an invalid message."
      )
    );

    return;
  }

  if (
    !message ||
    typeof message.type !==
      "string"
  ) {
    sendJson(
      socket,
      errorResponse(
        "INVALID_MESSAGE",
        "The server received an invalid message."
      )
    );

    return;
  }

  switch (
    message.type
  ) {
    case "create_room":
      void handleCreateRoom(
        socket,
        req
      );
      break;

    case "resume_host":
      handleResumeHost(
        socket,
        message
      );
      break;

    case "join_room":
      handleJoinRoom(
        socket,
        message
      );
      break;

    case "resume_player":
      handleResumePlayer(
        socket,
        message
      );
      break;

    case "start_game":
      void handleStartGame(
        socket,
        message
      );
      break;

    case "play_again":
      void handlePlayAgain(
        socket
      );
      break;

    case "reset_game":
      handleResetGame(
        socket
      );
      break;

    case "vote":
      handleVote(
        socket,
        message
      );
      break;

    case "caller_guess":
      handleCallerGuess(
        socket,
        message
      );
      break;

    case "ping":
      sendJson(
        socket,
        {
          type:
            "pong",

          timestamp:
            Date.now()
        }
      );
      break;

    default:
      sendJson(
        socket,
        errorResponse(
          "UNKNOWN_MESSAGE",
          `Unknown message type: ${message.type}`
        )
      );
  }
}


wss.on(
  "connection",
  (
    socket,
    req
  ) => {
    socket.isAlive =
      true;

    socket._waveline =
      null;

    socket.on(
      "pong",
      () => {
        socket.isAlive =
          true;
      }
    );

    socket.on(
      "message",
      (message) => {
        handleMessage(
          socket,
          req,
          message
        );
      }
    );

    socket.on(
      "close",
      () => {
        const metadata =
          socket._waveline;

        const result =
          roomManager.removeSocket(
            socket
          );

        if (!result) {
          return;
        }

        const {
          room
        } = result;

        if (
          metadata?.role ===
          "player"
        ) {
          gameEngine.handlePlayerDisconnected(
            room,
            metadata.playerId
          );
        }

        broadcastRoomState(
          room
        );
      }
    );

    socket.on(
      "error",
      () => {
        // close handles cleanup.
      }
    );

    sendJson(
      socket,
      {
        type:
          "connected",

        serverTime:
          Date.now()
      }
    );
  }
);


const heartbeatTimer =
  setInterval(
    () => {
      for (
        const socket
        of wss.clients
      ) {
        if (
          socket.isAlive ===
          false
        ) {
          socket.terminate();

          continue;
        }

        socket.isAlive =
          false;

        try {
          socket.ping();
        } catch {
          socket.terminate();
        }
      }
    },
    30_000
  );

heartbeatTimer.unref();


server.on(
  "upgrade",
  (
    req,
    socket,
    head
  ) => {
    try {
      const url =
        new URL(
          req.url,
          `http://${req.headers.host}`
        );

      if (
        url.pathname !==
        "/ws"
      ) {
        socket.write(
          "HTTP/1.1 404 Not Found\r\n" +
            "Connection: close\r\n\r\n"
        );

        socket.destroy();

        return;
      }

      wss.handleUpgrade(
        req,
        socket,
        head,
        (ws) => {
          wss.emit(
            "connection",
            ws,
            req
          );
        }
      );
    } catch {
      socket.destroy();
    }
  }
);


server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");

    console.log(
      "================================="
    );

    console.log(
      "          WAVELINE"
    );

    console.log(
      "================================="
    );

    console.log(
      `Local:   http://localhost:${PORT}`
    );

    console.log(
      `Port:    ${PORT}`
    );

    console.log(
      "Mode:    Stage 5 / final scoreboard"
    );

    console.log(
      `Model:   ${
        process.env.OPENAI_MODEL ||
        "gpt-5.6-luna"
      }`
    );

    console.log("");
  }
);
