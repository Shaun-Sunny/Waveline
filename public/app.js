const STORAGE_KEYS = {
  hostSession:
    "waveline_host_session",

  playerSession:
    "waveline_player_session"
};


const VIBE_LABELS = {
  roast:
    "Roast Night",

  work:
    "Work Trivia",

  family:
    "Family Safe",

  deep:
    "Deep Cuts"
};


const state = {
  socket:
    null,

  role:
    null,

  roomCode:
    null,

  hostToken:
    null,

  playerToken:
    null,

  playerId:
    null,

  nickname:
    null,

  lastRequestedAction:
    null,

  reconnectTimer:
    null,

  intentionallyClosed:
    false,

  serverOffset:
    0,

  latestState:
    null,

  countdownTimer:
    null
};


/* -------------------------------------------------- */
/* DOM */
/* -------------------------------------------------- */

const screens = {
  landing:
    document.getElementById(
      "landing-screen"
    ),

  join:
    document.getElementById(
      "join-screen"
    ),

  connecting:
    document.getElementById(
      "connecting-screen"
    ),

  host:
    document.getElementById(
      "host-screen"
    ),

  player:
    document.getElementById(
      "player-screen"
    ),

  error:
    document.getElementById(
      "error-screen"
    )
};


const createRoomButton =
  document.getElementById(
    "create-room-button"
  );

const showJoinButton =
  document.getElementById(
    "show-join-button"
  );

const joinBackButton =
  document.getElementById(
    "join-back-button"
  );

const joinForm =
  document.getElementById(
    "join-form"
  );

const roomCodeInput =
  document.getElementById(
    "room-code-input"
  );

const nicknameInput =
  document.getElementById(
    "nickname-input"
  );

const joinError =
  document.getElementById(
    "join-error"
  );


const connectingTitle =
  document.getElementById(
    "connecting-title"
  );

const connectingMessage =
  document.getElementById(
    "connecting-message"
  );


/* HOST */

const hostRoomCode =
  document.getElementById(
    "host-room-code"
  );

const roomQr =
  document.getElementById(
    "room-qr"
  );

const joinUrlElement =
  document.getElementById(
    "join-url"
  );

const copyLinkButton =
  document.getElementById(
    "copy-link-button"
  );

const hostPlayerCount =
  document.getElementById(
    "host-player-count"
  );

const hostConnectedCount =
  document.getElementById(
    "host-connected-count"
  );

const hostPlayerList =
  document.getElementById(
    "host-player-list"
  );

const hostEmptyState =
  document.getElementById(
    "host-empty-state"
  );

const hostConnectionDot =
  document.getElementById(
    "host-connection-dot"
  );

const vibeSelect =
  document.getElementById(
    "vibe-select"
  );

const roundCountSelect =
  document.getElementById(
    "round-count-select"
  );

const startGameButton =
  document.getElementById(
    "start-game-button"
  );

const startGameHelp =
  document.getElementById(
    "start-game-help"
  );

const hostGenerationStatus =
  document.getElementById(
    "host-generation-status"
  );

const hostLobby =
  document.getElementById(
    "host-lobby"
  );

const hostGame =
  document.getElementById(
    "host-game"
  );

const hostPhaseLabel =
  document.getElementById(
    "host-phase-label"
  );

const hostRoundLabel =
  document.getElementById(
    "host-round-label"
  );

const hostScoreCount =
  document.getElementById(
    "host-score-count"
  );

const hostTimer =
  document.getElementById(
    "host-timer"
  );

const hostTimerProgress =
  document.getElementById(
    "host-timer-progress"
  );

const hostGameContent =
  document.getElementById(
    "host-game-content"
  );

const hostGameFooter =
  document.getElementById(
    "host-game-footer"
  );


/* PLAYER */

const playerRoomCode =
  document.getElementById(
    "player-room-code"
  );

const playerConnectionStatus =
  document.getElementById(
    "player-connection-status"
  );

const playerLobby =
  document.getElementById(
    "player-lobby"
  );

const playerLobbyStatus =
  document.getElementById(
    "player-lobby-status"
  );

const playerWaitingText =
  document.getElementById(
    "player-waiting-text"
  );

const playerWelcome =
  document.getElementById(
    "player-welcome"
  );

const playerCount =
  document.getElementById(
    "player-count"
  );

const playerLobbyScore =
  document.getElementById(
    "player-lobby-score"
  );

const playerList =
  document.getElementById(
    "player-list"
  );

const playerGame =
  document.getElementById(
    "player-game"
  );

const playerPhaseLabel =
  document.getElementById(
    "player-phase-label"
  );

const playerRoundLabel =
  document.getElementById(
    "player-round-label"
  );

const playerGameScore =
  document.getElementById(
    "player-game-score-value"
  );

const playerTimer =
  document.getElementById(
    "player-timer"
  );

const playerTimerProgress =
  document.getElementById(
    "player-timer-progress"
  );

const playerGameContent =
  document.getElementById(
    "player-game-content"
  );


/* ERROR */

const fatalErrorTitle =
  document.getElementById(
    "fatal-error-title"
  );

const fatalErrorMessage =
  document.getElementById(
    "fatal-error-message"
  );

const fatalErrorButton =
  document.getElementById(
    "fatal-error-button"
  );


const toastContainer =
  document.getElementById(
    "toast-container"
  );


/* -------------------------------------------------- */
/* Helpers */
/* -------------------------------------------------- */

function showScreen(
  name
) {
  for (
    const [key, element]
    of Object.entries(
      screens
    )
  ) {
    element.classList.toggle(
      "active",
      key === name
    );
  }
}


function showJoinError(
  message
) {
  joinError.textContent =
    message;

  joinError.classList.remove(
    "hidden"
  );
}


function hideJoinError() {
  joinError.textContent =
    "";

  joinError.classList.add(
    "hidden"
  );
}


function showToast(
  message
) {
  const toast =
    document.createElement(
      "div"
    );

  toast.className =
    "toast";

  toast.textContent =
    message;

  toastContainer.appendChild(
    toast
  );

  window.setTimeout(
    () => {
      toast.remove();
    },
    3000
  );
}


function makeElement(
  tag,
  className,
  text = ""
) {
  const element =
    document.createElement(
      tag
    );

  if (className) {
    element.className =
      className;
  }

  if (text) {
    element.textContent =
      text;
  }

  return element;
}


/* -------------------------------------------------- */
/* Storage */
/* -------------------------------------------------- */

function readStorage(
  key
) {
  try {
    const raw =
      localStorage.getItem(
        key
      );

    return raw
      ? JSON.parse(raw)
      : null;
  } catch {
    localStorage.removeItem(
      key
    );

    return null;
  }
}


function saveHostSession(
  roomCode,
  hostToken
) {
  localStorage.setItem(
    STORAGE_KEYS.hostSession,

    JSON.stringify({
      roomCode,
      hostToken
    })
  );
}


function savePlayerSession(
  roomCode,
  playerToken,
  playerId,
  nickname
) {
  localStorage.setItem(
    STORAGE_KEYS.playerSession,

    JSON.stringify({
      roomCode,
      playerToken,
      playerId,
      nickname
    })
  );
}


function clearHostSession() {
  localStorage.removeItem(
    STORAGE_KEYS.hostSession
  );
}


function clearPlayerSession() {
  localStorage.removeItem(
    STORAGE_KEYS.playerSession
  );
}


/* -------------------------------------------------- */
/* URL / WebSocket */
/* -------------------------------------------------- */

function getJoinCodeFromLocation() {
  const path =
    window.location.pathname;

  const match =
    path.match(
      /^\/join\/([A-Za-z0-9]{4,6})\/?$/
    );

  if (match) {
    return match[1].toUpperCase();
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  const room =
    params.get(
      "room"
    );

  return room
    ? room.toUpperCase()
    : "";
}


function buildWebSocketUrl() {
  const protocol =
    window.location.protocol ===
    "https:"
      ? "wss:"
      : "ws:";

  return (
    `${protocol}//` +
    `${window.location.host}/ws`
  );
}


function sendMessage(
  payload
) {
  if (
    !state.socket ||
    state.socket.readyState !==
      WebSocket.OPEN
  ) {
    return false;
  }

  state.socket.send(
    JSON.stringify(
      payload
    )
  );

  return true;
}


/* -------------------------------------------------- */
/* Connection */
/* -------------------------------------------------- */

function setConnectingState(
  title,
  message
) {
  connectingTitle.textContent =
    title;

  connectingMessage.textContent =
    message;
}


function disconnectSocket() {
  state.intentionallyClosed =
    true;

  if (
    state.reconnectTimer
  ) {
    clearTimeout(
      state.reconnectTimer
    );

    state.reconnectTimer =
      null;
  }

  if (
    state.socket
  ) {
    try {
      state.socket.close();
    } catch {
      // Already closed.
    }
  }

  state.socket =
    null;
}


function scheduleReconnect() {
  if (
    state.intentionallyClosed
  ) {
    return;
  }

  if (
    state.reconnectTimer
  ) {
    return;
  }

  if (
    state.role ===
    "host"
  ) {
    setHostConnectionStatus(
      false
    );

    showScreen(
      "host"
    );
  }

  if (
    state.role ===
    "player"
  ) {
    setPlayerConnectionStatus(
      false
    );

    showScreen(
      "player"
    );
  }

  state.reconnectTimer =
    window.setTimeout(
      () => {
        state.reconnectTimer =
          null;

        connectWebSocket();
      },
      1500
    );
}


function connectWebSocket() {
  if (
    state.socket
  ) {
    if (
      state.socket.readyState ===
        WebSocket.OPEN ||
      state.socket.readyState ===
        WebSocket.CONNECTING
    ) {
      return;
    }
  }

  state.intentionallyClosed =
    false;

  const socket =
    new WebSocket(
      buildWebSocketUrl()
    );

  state.socket =
    socket;

  socket.addEventListener(
    "open",
    handleSocketOpen
  );

  socket.addEventListener(
    "message",
    (event) => {
      handleServerMessage(
        event.data
      );
    }
  );

  socket.addEventListener(
    "close",
    () => {
      state.socket =
        null;

      if (
        !state.intentionallyClosed
      ) {
        scheduleReconnect();
      }
    }
  );

  socket.addEventListener(
    "error",
    () => {
      // close handles reconnect.
    }
  );
}


function handleSocketOpen() {
  if (
    state.lastRequestedAction
  ) {
    sendMessage(
      state.lastRequestedAction
    );

    return;
  }

  const hostSession =
    readStorage(
      STORAGE_KEYS.hostSession
    );

  if (
    hostSession
  ) {
    state.role =
      "host";

    state.roomCode =
      hostSession.roomCode;

    state.hostToken =
      hostSession.hostToken;

    state.lastRequestedAction = {
      type:
        "resume_host",

      roomCode:
        hostSession.roomCode,

      hostToken:
        hostSession.hostToken
    };

    setConnectingState(
      "Restoring your room",
      "Reconnecting the host screen..."
    );

    sendMessage(
      state.lastRequestedAction
    );

    return;
  }

  const playerSession =
    readStorage(
      STORAGE_KEYS.playerSession
    );

  if (
    playerSession
  ) {
    state.role =
      "player";

    state.roomCode =
      playerSession.roomCode;

    state.playerToken =
      playerSession.playerToken;

    state.playerId =
      playerSession.playerId;

    state.nickname =
      playerSession.nickname;

    state.lastRequestedAction = {
      type:
        "resume_player",

      roomCode:
        playerSession.roomCode,

      playerToken:
        playerSession.playerToken
    };

    setConnectingState(
      "Restoring your seat",
      "Reconnecting to the room..."
    );

    sendMessage(
      state.lastRequestedAction
    );
  }
}


/* -------------------------------------------------- */
/* Server messages */
/* -------------------------------------------------- */

function handleServerMessage(
  rawData
) {
  let message;

  try {
    message =
      JSON.parse(
        rawData
      );
  } catch {
    return;
  }

  switch (
    message.type
  ) {
    case "connected":
      updateServerClock(
        message.serverTime
      );
      break;

    case "host_created":
      handleHostCreated(
        message
      );
      break;

    case "host_resumed":
      handleHostResumed(
        message
      );
      break;

    case "joined":
      handleJoined(
        message
      );
      break;

    case "player_resumed":
      handlePlayerResumed(
        message
      );
      break;

    case "state":
      updateServerClock(
        message.serverNow
      );

      state.latestState =
        message;

      handleState(
        message
      );

      break;

    case "error":
      handleServerError(
        message
      );
      break;

    case "pong":
      break;

    default:
      break;
  }
}


function updateServerClock(
  serverTime
) {
  if (
    Number.isFinite(
      Number(
        serverTime
      )
    )
  ) {
    state.serverOffset =
      Number(
        serverTime
      ) -
      Date.now();
  }
}


/* -------------------------------------------------- */
/* Create / join */
/* -------------------------------------------------- */

function beginHostCreation() {
  clearHostSession();

  state.role =
    "host";

  state.roomCode =
    null;

  state.hostToken =
    null;

  state.playerToken =
    null;

  state.playerId =
    null;

  state.nickname =
    null;

  state.lastRequestedAction = {
    type:
      "create_room"
  };

  setConnectingState(
    "Creating your room",
    "Starting the live Waveline game..."
  );

  showScreen(
    "connecting"
  );

  connectWebSocket();
}


function beginJoinFlow(
  code = ""
) {
  state.role =
    null;

  state.lastRequestedAction =
    null;

  roomCodeInput.value =
    code
      .replace(
        /[^a-z0-9]/gi,
        ""
      )
      .slice(
        0,
        6
      )
      .toUpperCase();

  hideJoinError();

  showScreen(
    "join"
  );

  if (
    roomCodeInput.value
  ) {
    nicknameInput.focus();
  } else {
    roomCodeInput.focus();
  }
}


function submitJoin() {
  const roomCode =
    roomCodeInput.value
      .trim()
      .toUpperCase();

  const nickname =
    nicknameInput.value
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  hideJoinError();

  if (
    !/^[A-Z0-9]{4,6}$/.test(
      roomCode
    )
  ) {
    showJoinError(
      "Enter a valid 4–6 character room code."
    );

    roomCodeInput.focus();

    return;
  }

  if (
    !nickname ||
    nickname.length > 16
  ) {
    showJoinError(
      "Choose a nickname between 1 and 16 characters."
    );

    nicknameInput.focus();

    return;
  }

  clearPlayerSession();

  state.role =
    "player";

  state.roomCode =
    roomCode;

  state.nickname =
    nickname;

  state.playerToken =
    null;

  state.playerId =
    null;

  state.lastRequestedAction = {
    type:
      "join_room",

    roomCode,

    nickname
  };

  setConnectingState(
    "Joining room",
    `Connecting you to ${roomCode}...`
  );

  showScreen(
    "connecting"
  );

  connectWebSocket();
}


/* -------------------------------------------------- */
/* Result handlers */
/* -------------------------------------------------- */

function handleHostCreated(
  message
) {
  state.role =
    "host";

  state.roomCode =
    message.roomCode;

  state.hostToken =
    message.hostToken;

  state.lastRequestedAction =
    null;

  saveHostSession(
    message.roomCode,
    message.hostToken
  );

  window.history.replaceState(
    {},
    "",
    `/?host=${encodeURIComponent(
      message.roomCode
    )}`
  );

  showScreen(
    "host"
  );

  setHostConnectionStatus(
    true
  );
}


function handleHostResumed(
  message
) {
  state.role =
    "host";

  state.roomCode =
    message.roomCode;

  state.hostToken =
    state.hostToken ||
    readStorage(
      STORAGE_KEYS.hostSession
    )?.hostToken;

  state.lastRequestedAction =
    null;

  showScreen(
    "host"
  );

  setHostConnectionStatus(
    true
  );
}


function handleJoined(
  message
) {
  state.role =
    "player";

  state.roomCode =
    message.roomCode;

  state.playerToken =
    message.playerToken;

  state.playerId =
    message.playerId;

  state.nickname =
    message.nickname;

  state.lastRequestedAction =
    null;

  savePlayerSession(
    message.roomCode,
    message.playerToken,
    message.playerId,
    message.nickname
  );

  window.history.replaceState(
    {},
    "",
    `/join/${encodeURIComponent(
      message.roomCode
    )}`
  );

  showScreen(
    "player"
  );

  setPlayerConnectionStatus(
    true
  );
}


function handlePlayerResumed(
  message
) {
  state.role =
    "player";

  state.roomCode =
    message.roomCode;

  state.playerId =
    message.playerId;

  state.lastRequestedAction =
    null;

  showScreen(
    "player"
  );

  setPlayerConnectionStatus(
    true
  );
}


function handleState(
  message
) {
  if (
    message.role ===
    "host"
  ) {
    renderHostState(
      message
    );

    showScreen(
      "host"
    );

    setHostConnectionStatus(
      true
    );

    return;
  }

  if (
    message.role ===
    "player"
  ) {
    renderPlayerState(
      message
    );

    showScreen(
      "player"
    );

    setPlayerConnectionStatus(
      true
    );
  }
}


function handleServerError(
  message
) {
  const sessionErrors =
    new Set([
      "ROOM_NOT_FOUND",
      "SESSION_NOT_FOUND",
      "HOST_SESSION_NOT_FOUND"
    ]);

  if (
    sessionErrors.has(
      message.errorCode
    )
  ) {
    if (
      state.role ===
      "host"
    ) {
      clearHostSession();
    }

    if (
      state.role ===
      "player"
    ) {
      clearPlayerSession();
    }

    state.role =
      null;

    state.lastRequestedAction =
      null;

    disconnectSocket();

    showFatalError(
      "Session expired",
      message.message
    );

    return;
  }

  if (
    state.lastRequestedAction?.type ===
    "join_room"
  ) {
    showScreen(
      "join"
    );

    showJoinError(
      message.message
    );

    state.lastRequestedAction =
      null;

    return;
  }

  showToast(
    message.message ||
      "Something went wrong."
  );
}


/* -------------------------------------------------- */
/* Connection status */
/* -------------------------------------------------- */

function setHostConnectionStatus(
  online
) {
  hostConnectionDot.classList.toggle(
    "online",
    online
  );

  hostConnectionDot.classList.toggle(
    "offline",
    !online
  );

  hostConnectionDot.replaceChildren();

  const dot =
    document.createElement(
      "span"
    );

  hostConnectionDot.appendChild(
    dot
  );

  hostConnectionDot.appendChild(
    document.createTextNode(
      online
        ? " Live"
        : " Offline"
    )
  );
}


function setPlayerConnectionStatus(
  online
) {
  playerConnectionStatus.classList.toggle(
    "online",
    online
  );

  playerConnectionStatus.classList.toggle(
    "offline",
    !online
  );

  playerConnectionStatus.replaceChildren();

  const dot =
    document.createElement(
      "span"
    );

  playerConnectionStatus.appendChild(
    dot
  );

  playerConnectionStatus.appendChild(
    document.createTextNode(
      online
        ? " Connected"
        : " Reconnecting..."
    )
  );
}


/* -------------------------------------------------- */
/* Player list */
/* -------------------------------------------------- */

function renderPlayers(
  container,
  players,
  showCaller
) {
  container.replaceChildren();

  for (
    const player
    of players
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "player-row";

    if (
      showCaller &&
      player.isCaller
    ) {
      row.classList.add(
        "caller"
      );
    }

    const main =
      document.createElement(
        "div"
      );

    main.className =
      "player-main";

    const avatar =
      document.createElement(
        "div"
      );

    avatar.className =
      "player-avatar";

    avatar.textContent =
      player.nickname
        .charAt(0)
        .toUpperCase();

    const textWrap =
      document.createElement(
        "div"
      );

    const name =
      document.createElement(
        "div"
      );

    name.className =
      "player-name";

    name.textContent =
      player.nickname;

    const status =
      document.createElement(
        "div"
      );

    status.className =
      "player-status";

    if (
      player.connected
    ) {
      status.classList.add(
        "online"
      );

      status.textContent =
        player.queuedForNextRound
          ? "Connected · next round"
          : "Connected";
    } else {
      status.textContent =
        player.queuedForNextRound
          ? "Disconnected · queued"
          : "Reconnecting";
    }

    textWrap.appendChild(
      name
    );

    textWrap.appendChild(
      status
    );

    main.appendChild(
      avatar
    );

    main.appendChild(
      textWrap
    );

    row.appendChild(
      main
    );

    if (
      player.score !==
      undefined
    ) {
      const score =
        document.createElement(
          "div"
        );

      score.className =
        "player-score";

      score.appendChild(
        makeElement(
          "span",
          "",
          "Score"
        )
      );

      score.appendChild(
        makeElement(
          "strong",
          "",
          String(
            Number(
              player.score ||
                0
            )
          )
        )
      );

      row.appendChild(
        score
      );
    }

    if (
      showCaller &&
      player.isCaller
    ) {
      const caller =
        document.createElement(
          "span"
        );

      caller.className =
        "player-caller-label";

      caller.textContent =
        "CALLER";

      row.appendChild(
        caller
      );
    }

    container.appendChild(
      row
    );
  }
}


/* -------------------------------------------------- */
/* HOST STATE */
/* -------------------------------------------------- */

function renderHostState(
  data
) {
  hostRoomCode.textContent =
    data.roomCode;

  hostPlayerCount.textContent =
    String(
      data.playerCount
    );

  hostConnectedCount.textContent =
    String(
      data.connectedPlayerCount
    );

  if (
    data.qrDataUrl
  ) {
    roomQr.src =
      data.qrDataUrl;
  }

  if (
    data.joinUrl
  ) {
    joinUrlElement.textContent =
      data.joinUrl;

    copyLinkButton.dataset.joinUrl =
      data.joinUrl;
  }

  renderPlayers(
    hostPlayerList,
    data.players || [],
    true
  );

  hostEmptyState.classList.toggle(
    "hidden",
    (
      data.players || []
    ).length > 0
  );

  const game =
    data.game;

  if (
    game.status ===
    "lobby"
  ) {
    renderHostLobby(
      data
    );

    return;
  }

  if (
    game.status ===
    "generating"
  ) {
    renderHostGenerating(
      data
    );

    return;
  }

  hostLobby.classList.add(
    "hidden"
  );

  hostGame.classList.remove(
    "hidden"
  );

  renderHostGame(
    data
  );
}


function renderHostLobby(
  data
) {
  hostLobby.classList.remove(
    "hidden"
  );

  hostGame.classList.add(
    "hidden"
  );

  vibeSelect.disabled =
    false;

  roundCountSelect.disabled =
    false;

  vibeSelect.value =
    data.game.vibe;

  roundCountSelect.value =
    String(
      data.game.totalRounds
    );

  startGameButton.disabled =
    data.connectedPlayerCount <
    3;

  startGameButton.textContent =
    "Start Game";

  hostGenerationStatus.classList.add(
    "hidden"
  );

  startGameHelp.textContent =
    data.connectedPlayerCount >=
    3
      ? "Everyone is ready. Start when you want."
      : `Need ${
          Math.max(
            0,
            3 -
              data.connectedPlayerCount
          )
        } more connected player${
          data.connectedPlayerCount ===
          2
            ? ""
            : "s"
        }.`;

  if (
    data.game.notice
  ) {
    startGameHelp.textContent =
      data.game.notice;
  }
}


function renderHostGenerating(
  data
) {
  hostLobby.classList.remove(
    "hidden"
  );

  hostGame.classList.add(
    "hidden"
  );

  vibeSelect.value =
    data.game.vibe;

  vibeSelect.disabled =
    true;

  roundCountSelect.disabled =
    true;

  startGameButton.disabled =
    true;

  startGameButton.textContent =
    "Generating...";

  startGameHelp.textContent =
    `Building ${
      vibeLabel(
        data.game.vibe
      )
    } for ${
      data.game.totalRounds
    } rounds.`;

  hostGenerationStatus.classList.remove(
    "hidden"
  );

  const statusText =
    hostGenerationStatus.querySelector(
      "span"
    );

  if (
    statusText
  ) {
    statusText.textContent =
      data.game.generationMessage ||
      "Generating a fresh game...";
  }
}


/* -------------------------------------------------- */
/* HOST GAME */
/* -------------------------------------------------- */

function phaseLabel(
  phase
) {
  switch (
    phase
  ) {
    case "round_start":
      return "GET READY";

    case "voting":
      return "VOTING";

    case "caller_guess":
      return "CALLER GUESS";

    case "reveal":
      return "REVEAL";

    case "complete":
      return "FINAL RESULTS";

    default:
      return "";
  }
}


function vibeLabel(
  vibe
) {
  return (
    VIBE_LABELS[vibe] ||
    "Family Safe"
  );
}


function contentSourceLabel(
  source
) {
  if (
    source ===
    "openai"
  ) {
    return "AI-generated";
  }

  if (
    source ===
    "fallback"
  ) {
    return "Built-in backup";
  }

  return "Game content";
}


function renderHostGame(
  data
) {
  const game =
    data.game;

  hostPhaseLabel.textContent =
    phaseLabel(
      game.phase
    );

  hostRoundLabel.textContent =
    game.phase ===
    "complete"
      ? "Final scoreboard"
      : `Round ${
          game.roundNumber
        } / ${
          game.totalRounds
        }`;

  hostScoreCount.textContent =
    game.phase ===
    "complete"
      ? "DONE"
      : game.phase ===
        "reveal"
        ? "REVEAL"
        : "LIVE";

  renderCountdown(
    hostTimer,
    hostTimerProgress,
    game.phaseEndsAt,
    game.phaseStartedAt
  );

  hostGameContent.replaceChildren();

  hostGameFooter.replaceChildren();

  if (
    game.phase ===
    "complete"
  ) {
    renderHostComplete(
      data
    );

    return;
  }

  if (
    game.phase ===
    "round_start"
  ) {
    renderHostRoundStart(
      data
    );

    return;
  }

  if (
    game.phase ===
    "voting"
  ) {
    renderHostVoting(
      data
    );

    return;
  }

  if (
    game.phase ===
    "caller_guess"
  ) {
    renderHostCallerGuess(
      data
    );

    return;
  }

  if (
    game.phase ===
    "reveal"
  ) {
    renderHostReveal(
      data
    );
  }
}


function renderHostRoundStart(
  data
) {
  const game =
    data.game;

  hostGameContent.appendChild(
    makeElement(
      "div",
      "game-kicker",
      "The prompt is live"
    )
  );

  hostGameContent.appendChild(
    createPromptElement(
      game.prompt
    )
  );

  hostGameContent.appendChild(
    createCallout(
      `${game.callerNickname} is the Caller · The answer options are hidden from the Caller`
    )
  );

  hostGameContent.appendChild(
    createSourceBadge(
      game
    )
  );

  hostGameFooter.textContent =
    "Players are getting ready. Voting opens automatically.";
}


function renderHostVoting(
  data
) {
  const game =
    data.game;

  hostGameContent.appendChild(
    makeElement(
      "div",
      "game-kicker",
      "Private voting"
    )
  );

  hostGameContent.appendChild(
    createPromptElement(
      game.prompt
    )
  );

  hostGameContent.appendChild(
    createCallout(
      `${game.callerNickname} is guessing without seeing the options`
    )
  );

  hostGameContent.appendChild(
    createSourceBadge(
      game
    )
  );

  hostGameFooter.textContent =
    "Everyone except the Caller is voting privately on their phone.";
}


function renderHostCallerGuess(
  data
) {
  const game =
    data.game;

  hostGameContent.appendChild(
    makeElement(
      "div",
      "game-kicker",
      `${game.callerNickname}'s turn`
    )
  );

  hostGameContent.appendChild(
    createPromptElement(
      game.prompt
    )
  );

  hostGameContent.appendChild(
    createCallout(
      "The Caller is choosing which answer they think won."
    )
  );

  hostGameContent.appendChild(
    createOptionGrid(
      game.options
    )
  );

  hostGameFooter.textContent =
    "Make your prediction before the timer reaches zero.";
}


function renderHostReveal(
  data
) {
  const game =
    data.game;

  hostGameContent.appendChild(
    makeElement(
      "div",
      "game-kicker",
      "THE ANSWER IS IN"
    )
  );

  hostGameContent.appendChild(
    createPromptElement(
      game.prompt
    )
  );

  const revealGrid =
    document.createElement(
      "div"
    );

  revealGrid.className =
    "reveal-grid";

  const answer =
    document.createElement(
      "div"
    );

  answer.className =
    "reveal-answer";

  if (
    game.callerCorrect ===
    false
  ) {
    answer.classList.add(
      "wrong"
    );
  }

  answer.appendChild(
    makeElement(
      "h3",
      "",
      game.winningOptionIndex ===
        null
        ? "No votes"
        : "Most-voted answer"
    )
  );

  answer.appendChild(
    makeElement(
      "p",
      "",
      game.winningOptionIndex ===
        null
        ? "Nobody submitted a vote."
        : optionText(
            game.options,
            game.winningOptionIndex
          )
    )
  );

  revealGrid.appendChild(
    answer
  );

  revealGrid.appendChild(
    createVoteBreakdown(
      game.options,
      game.voteCounts
    )
  );

  hostGameContent.appendChild(
    revealGrid
  );

  hostGameContent.appendChild(
    createRoundPointsPanel(
      game.roundPoints
    )
  );

  hostGameContent.appendChild(
    createSourceBadge(
      game
    )
  );

  const guessText =
    game.callerGuess ===
    null
      ? `${game.callerNickname} made no guess.`
      : `${game.callerNickname} guessed: “${
          optionText(
            game.options,
            game.callerGuess
          )
        }”`;

  const footerText =
    document.createElement(
      "span"
    );

  footerText.textContent =
    guessText;

  if (
    game.callerCorrect ===
    true
  ) {
    footerText.textContent +=
      " · Correct prediction.";
  } else if (
    game.callerCorrect ===
    false
  ) {
    footerText.textContent +=
      " · Wrong prediction.";
  }

  hostGameFooter.appendChild(
    footerText
  );
}


function renderHostComplete(
  data
) {
  const game =
    data.game;

  const results =
    createFinalResults(
      game,
      true
    );

  hostGameContent.appendChild(
    results
  );
}


function createFinalResults(
  game,
  isHost
) {
  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "final-results";

  const header =
    document.createElement(
      "div"
    );

  header.className =
    "final-results-header";

  header.appendChild(
    makeElement(
      "div",
      "eyebrow",
      "GAME COMPLETE"
    )
  );

  header.appendChild(
    makeElement(
      "h1",
      "",
      game.winnerType ===
        "tie"
        ? "It's a tie!"
        : "We have a winner!"
    )
  );

  header.appendChild(
    makeElement(
      "p",
      "",
      `${game.totalRounds} rounds · ${vibeLabel(
        game.vibe
      )}`
    )
  );

  wrapper.appendChild(
    header
  );

  const winnerBanner =
    document.createElement(
      "div"
    );

  winnerBanner.className =
    "winner-banner";

  winnerBanner.appendChild(
    makeElement(
      "div",
      "winner-crown",
      "★"
    )
  );

  winnerBanner.appendChild(
    makeElement(
      "div",
      "winner-eyebrow",
      game.winnerType ===
        "tie"
        ? "JOINT 1ST PLACE"
        : "1ST PLACE"
    )
  );

  const winnerNames =
    game.winners
      .map(
        (winner) =>
          winner.nickname
      )
      .join(
        " · "
      );

  winnerBanner.appendChild(
    makeElement(
      "div",
      "winner-names",
      winnerNames ||
        "No winner"
    )
  );

  winnerBanner.appendChild(
    makeElement(
      "div",
      "winner-score",
      `${game.winnerScore} ${
        game.winnerScore ===
        1
          ? "point"
          : "points"
      }`
    )
  );

  wrapper.appendChild(
    winnerBanner
  );

  wrapper.appendChild(
    createLeaderboard(
      game.leaderboard,
      game.winners
    )
  );

  const actions =
    document.createElement(
      "div"
    );

  actions.className =
    "final-actions";

  if (
    isHost
  ) {
    const playAgain =
      document.createElement(
        "button"
      );

    playAgain.type =
      "button";

    playAgain.className =
      "button button-primary";

    playAgain.textContent =
      "Play Again";

    playAgain.addEventListener(
      "click",
      () => {
        playAgain.disabled =
          true;

        playAgain.textContent =
          "Starting...";

        sendMessage({
          type:
            "play_again"
        });
      }
    );

    actions.appendChild(
      playAgain
    );

    const reset =
      document.createElement(
        "button"
      );

    reset.type =
      "button";

    reset.className =
      "button button-secondary";

    reset.textContent =
      "Back to Lobby";

    reset.addEventListener(
      "click",
      () => {
        sendMessage({
          type:
            "reset_game"
        });
      }
    );

    actions.appendChild(
      reset
    );
  }

  wrapper.appendChild(
    actions
  );

  wrapper.appendChild(
    makeElement(
      "div",
      "final-note",
      isHost
        ? "Play Again keeps the same room and players, resets scores, and generates a fresh batch of prompts."
        : "The host controls the next game."
    )
  );

  return wrapper;
}


function createLeaderboard(
  leaderboard,
  winners
) {
  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "leaderboard";

  const winnerIds =
    new Set(
      (winners || []).map(
        (winner) =>
          winner.id
      )
    );

  (leaderboard || []).forEach(
    (entry) => {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "leaderboard-row";

      if (
        entry.rank ===
        1
      ) {
        row.classList.add(
          "first"
        );
      }

      const rank =
        makeElement(
          "div",
          "leaderboard-rank",
          String(
            entry.rank
          )
        );

      const nameWrap =
        document.createElement(
          "div"
        );

      nameWrap.className =
        "leaderboard-name";

      nameWrap.textContent =
        entry.nickname;

      if (
        winnerIds.has(
          entry.id
        )
      ) {
        nameWrap.appendChild(
          makeElement(
            "span",
            "leaderboard-badge",
            "Winner"
          )
        );
      }

      const score =
        makeElement(
          "div",
          "leaderboard-score",
          String(
            entry.score
          )
        );

      row.appendChild(
        rank
      );

      row.appendChild(
        nameWrap
      );

      row.appendChild(
        score
      );

      wrapper.appendChild(
        row
      );
    }
  );

  return wrapper;
}


function createOptionGrid(
  options
) {
  const grid =
    document.createElement(
      "div"
    );

  grid.className =
    "host-options";

  options.forEach(
    (
      text,
      index
    ) => {
      const option =
        document.createElement(
          "div"
        );

      option.className =
        "host-option";

      option.appendChild(
        makeElement(
          "span",
          "option-letter",
          String.fromCharCode(
            65 +
              index
          )
        )
      );

      option.appendChild(
        makeElement(
          "span",
          "option-text",
          text
        )
      );

      grid.appendChild(
        option
      );
    }
  );

  return grid;
}


function createVoteBreakdown(
  options,
  counts
) {
  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "vote-breakdown";

  wrapper.appendChild(
    makeElement(
      "h4",
      "",
      "Vote breakdown"
    )
  );

  const safeCounts =
    Array.isArray(
      counts
    )
      ? counts
      : [];

  options.forEach(
    (
      option,
      index
    ) => {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "vote-bar";

      row.appendChild(
        makeElement(
          "span",
          "vote-bar-label",
          String.fromCharCode(
            65 +
              index
          )
        )
      );

      const track =
        document.createElement(
          "div"
        );

      track.className =
        "vote-track";

      const fill =
        document.createElement(
          "div"
        );

      fill.className =
        "vote-fill";

      const count =
        Number(
          safeCounts[
            index
          ] || 0
        );

      const max =
        Math.max(
          1,
          ...safeCounts.map(
            Number
          )
        );

      fill.style.width =
        `${
          (count / max) *
          100
        }%`;

      track.appendChild(
        fill
      );

      row.appendChild(
        track
      );

      row.appendChild(
        makeElement(
          "span",
          "vote-number",
          String(
            count
          )
        )
      );

      wrapper.appendChild(
        row
      );
    }
  );

  return wrapper;
}


function createRoundPointsPanel(
  roundPoints
) {
  const panel =
    document.createElement(
      "div"
    );

  panel.className =
    "round-points-panel";

  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "round-points-heading";

  heading.appendChild(
    makeElement(
      "h4",
      "",
      "Points this round"
    )
  );

  heading.appendChild(
    makeElement(
      "span",
      "",
      "Total score"
    )
  );

  panel.appendChild(
    heading
  );

  const list =
    document.createElement(
      "div"
    );

  list.className =
    "round-points-list";

  const rows =
    Array.isArray(
      roundPoints
    )
      ? [
          ...roundPoints
        ].sort(
          (
            a,
            b
          ) =>
            b.pointsThisRound -
            a.pointsThisRound
        )
      : [];

  if (
    rows.length ===
    0
  ) {
    list.appendChild(
      makeElement(
        "div",
        "round-points-row",
        "No scoring data."
      )
    );
  } else {
    for (
      const row
      of rows
    ) {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        "round-points-row";

      item.appendChild(
        makeElement(
          "span",
          "round-points-name",
          row.nickname
        )
      );

      item.appendChild(
        makeElement(
          "span",
          "round-points-earned",
          row.pointsThisRound >
            0
            ? `+${row.pointsThisRound}`
            : "0"
        )
      );

      item.appendChild(
        makeElement(
          "span",
          "round-points-total",
          `${row.totalScore} total`
        )
      );

      list.appendChild(
        item
      );
    }
  }

  panel.appendChild(
    list
  );

  return panel;
}


function createSourceBadge(
  game
) {
  return makeElement(
    "div",
    "source-badge",
    `${vibeLabel(
      game.vibe
    )} · ${contentSourceLabel(
      game.contentSource
    )}`
  );
}


/* -------------------------------------------------- */
/* PLAYER STATE */
/* -------------------------------------------------- */

function renderPlayerState(
  data
) {
  state.roomCode =
    data.roomCode;

  playerRoomCode.textContent =
    data.roomCode;

  playerCount.textContent =
    String(
      data.playerCount
    );

  if (
    data.self?.nickname
  ) {
    state.nickname =
      data.self.nickname;

    playerWelcome.textContent =
      `You're in, ${data.self.nickname}`;
  }

  const ownScore =
    Number(
      data.self?.score ??
      data.game?.score ??
      0
    );

  playerLobbyScore.textContent =
    String(
      ownScore
    );

  playerGameScore.textContent =
    String(
      ownScore
    );

  renderPlayers(
    playerList,
    data.players || [],
    false
  );

  const game =
    data.game;

  if (
    game.status ===
      "lobby" ||
    game.status ===
      "generating"
  ) {
    playerLobby.classList.remove(
      "hidden"
    );

    playerGame.classList.add(
      "hidden"
    );

    if (
      game.status ===
      "generating"
    ) {
      playerLobbyStatus.textContent =
        `The host picked ${
          vibeLabel(
            game.vibe
          )
        }. A fresh game is being prepared.`;

      playerWaitingText.textContent =
        "Preparing another game...";

      return;
    }

    if (
      game.notice
    ) {
      playerLobbyStatus.textContent =
        game.notice;
    } else {
      playerLobbyStatus.textContent =
        "Stay on this screen. The host will start the game when everyone is ready.";

      playerWaitingText.textContent =
        "Waiting for the host...";
    }

    return;
  }

  playerLobby.classList.add(
    "hidden"
  );

  playerGame.classList.remove(
    "hidden"
  );

  renderPlayerGame(
    data
  );
}


/* -------------------------------------------------- */
/* PLAYER GAME */
/* -------------------------------------------------- */

function renderPlayerGame(
  data
) {
  const game =
    data.game;

  playerPhaseLabel.textContent =
    phaseLabel(
      game.phase
    );

  playerRoundLabel.textContent =
    game.phase ===
    "complete"
      ? "Final scoreboard"
      : `Round ${
          game.roundNumber
        } / ${
          game.totalRounds
        }`;

  playerGameScore.textContent =
    String(
      Number(
        game.score || 0
      )
    );

  renderCountdown(
    playerTimer,
    playerTimerProgress,
    game.phaseEndsAt,
    game.phaseStartedAt
  );

  playerGameContent.replaceChildren();

  if (
    game.phase ===
    "queued"
  ) {
    renderQueuedPlayer(
      game
    );

    return;
  }

  if (
    game.phase ===
    "complete"
  ) {
    renderPlayerComplete(
      game
    );

    return;
  }

  if (
    game.phase ===
    "round_start"
  ) {
    renderPlayerRoundStart(
      data
    );

    return;
  }

  if (
    game.phase ===
    "voting"
  ) {
    renderPlayerVoting(
      data
    );

    return;
  }

  if (
    game.phase ===
    "caller_guess"
  ) {
    renderPlayerCallerGuess(
      data
    );

    return;
  }

  if (
    game.phase ===
    "reveal"
  ) {
    renderPlayerReveal(
      data
    );
  }
}


function renderPlayerRoundStart(
  data
) {
  const game =
    data.game;

  const isCaller =
    Boolean(
      game.isCaller
    );

  playerGameContent.appendChild(
    makeElement(
      "div",
      "game-kicker",
      isCaller
        ? "YOU ARE THE CALLER"
        : "GET READY TO VOTE"
    )
  );

  playerGameContent.appendChild(
    createPromptElement(
      game.prompt
    )
  );

  if (
    isCaller
  ) {
    playerGameContent.appendChild(
      createCallout(
        "The answer options are hidden from you. Watch the prompt and trust your instincts."
      )
    );
  } else {
    playerGameContent.appendChild(
      createCallout(
        `${game.callerNickname} is the Caller. Your answer choices are private.`
      )
    );

    if (
      game.options.length > 0
    ) {
      playerGameContent.appendChild(
        createMobileOptions(
          game.options,
          game.myVote,
          false,
          false
        )
      );
    }
  }
}


function renderPlayerVoting(
  data
) {
  const game =
    data.game;

  if (
    game.isCaller
  ) {
    playerGameContent.appendChild(
      makeElement(
        "div",
        "game-kicker",
        "YOU ARE THE CALLER"
      )
    );

    playerGameContent.appendChild(
      createPromptElement(
        game.prompt
      )
    );

    playerGameContent.appendChild(
      createCallout(
        "Everyone else is voting privately. Their choices stay hidden until the reveal."
      )
    );

    return;
  }

  playerGameContent.appendChild(
    makeElement(
      "div",
      "game-kicker",
      "MAKE YOUR CHOICE"
    )
  );

  playerGameContent.appendChild(
    createPromptElement(
      game.prompt
    )
  );

  playerGameContent.appendChild(
    createMobileOptions(
      game.options,
      game.myVote,
      true,
      false
    )
  );

  playerGameContent.appendChild(
    makeElement(
      "div",
      "selection-status",
      game.myVote ===
        null
        ? "Choose an answer."
        : `Your vote: ${String.fromCharCode(
            65 +
              game.myVote
          )}`
    )
  );
}


function renderPlayerCallerGuess(
  data
) {
  const game =
    data.game;

  if (
    !game.isCaller
  ) {
    playerGameContent.appendChild(
      makeElement(
        "div",
        "game-kicker",
        "WAIT FOR THE CALLER"
      )
    );

    playerGameContent.appendChild(
      createPromptElement(
        game.prompt
      )
    );

    playerGameContent.appendChild(
      createCallout(
        `${game.callerNickname} is deciding which answer they think got the most votes.`
      )
    );

    playerGameContent.appendChild(
      createMobileOptions(
        game.options,
        null,
        false,
        false
      )
    );

    return;
  }

  playerGameContent.appendChild(
    makeElement(
      "div",
      "game-kicker",
      "YOUR GUESS"
    )
  );

  playerGameContent.appendChild(
    createPromptElement(
      game.prompt
    )
  );

  playerGameContent.appendChild(
    createCallout(
      "Which answer got the most votes?"
    )
  );

  playerGameContent.appendChild(
    createMobileOptions(
      game.options,
      game.callerGuess,
      true,
      true
    )
  );
}


function renderPlayerReveal(
  data
) {
  const game =
    data.game;

  playerGameContent.appendChild(
    makeElement(
      "div",
      "game-kicker",
      "REVEAL"
    )
  );

  playerGameContent.appendChild(
    createPromptElement(
      game.prompt
    )
  );

  const reveal =
    document.createElement(
      "div"
    );

  reveal.className =
    "reveal-mobile";

  reveal.appendChild(
    makeElement(
      "h2",
      "",
      game.winningOptionIndex ===
        null
        ? "No majority"
        : "Most-voted answer"
    )
  );

  const answer =
    document.createElement(
      "div"
    );

  answer.className =
    "reveal-answer";

  if (
    game.callerCorrect ===
    false
  ) {
    answer.classList.add(
      "wrong"
    );
  }

  answer.appendChild(
    makeElement(
      "p",
      "",
      game.winningOptionIndex ===
        null
        ? "Nobody submitted a vote."
        : optionText(
            game.options,
            game.winningOptionIndex
          )
    )
  );

  reveal.appendChild(
    answer
  );

  if (
    Number.isInteger(
      game.callerGuess
    )
  ) {
    const callerResult =
      makeElement(
        "div",
        "caller-result",
        `${game.callerNickname} guessed ${
          optionText(
            game.options,
            game.callerGuess
          )
        }`
      );

    if (
      game.callerCorrect ===
      true
    ) {
      callerResult.classList.add(
        "correct"
      );

      callerResult.textContent +=
        " · Correct!";
    }

    if (
      game.callerCorrect ===
      false
    ) {
      callerResult.classList.add(
        "incorrect"
      );

      callerResult.textContent +=
        " · Wrong!";
    }

    reveal.appendChild(
      callerResult
    );
  } else {
    reveal.appendChild(
      makeElement(
        "div",
        "caller-result",
        `${game.callerNickname} made no guess.`
      )
    );
  }

  const myPoints =
    Number(
      game.myRoundPoints ||
      0
    );

  reveal.appendChild(
    makeElement(
      "div",
      "my-round-points",
      myPoints > 0
        ? `+${myPoints} this round · ${game.score} total`
        : `0 this round · ${game.score} total`
    )
  );

  reveal.appendChild(
    createVoteBreakdown(
      game.options,
      game.voteCounts
    )
  );

  playerGameContent.appendChild(
    reveal
  );
}


function renderPlayerComplete(
  game
) {
  const results =
    createFinalResults(
      game,
      false
    );

  results.classList.add(
    "player-final-results"
  );

  playerGameContent.appendChild(
    results
  );
}


function renderQueuedPlayer(
  game
) {
  const card =
    makeElement(
      "div",
      "queue-card"
    );

  card.appendChild(
    makeElement(
      "div",
      "eyebrow",
      "YOU JOINED MID-ROUND"
    )
  );

  card.appendChild(
    makeElement(
      "h2",
      "",
      "You're in the room"
    )
  );

  card.appendChild(
    makeElement(
      "p",
      "",
      "This round is already underway, so your first active round will be the next one."
    )
  );

  if (
    game.callerNickname
  ) {
    card.appendChild(
      makeElement(
        "p",
        "",
        `Current Caller: ${game.callerNickname}`
      )
    );
  }

  card.appendChild(
    makeElement(
      "div",
      "my-round-points",
      `Your score: ${game.score}`
    )
  );

  playerGameContent.appendChild(
    card
  );
}


function createMobileOptions(
  options,
  selectedIndex,
  interactive,
  callerMode
) {
  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "mobile-options";

  options.forEach(
    (
      option,
      index
    ) => {
      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "mobile-option";

      if (
        selectedIndex ===
        index
      ) {
        button.classList.add(
          "selected"
        );
      }

      button.disabled =
        !interactive;

      button.appendChild(
        makeElement(
          "span",
          "mobile-option letter",
          String.fromCharCode(
            65 +
              index
          )
        )
      );

      button.appendChild(
        makeElement(
          "span",
          "mobile-option-text",
          option
        )
      );

      if (
        interactive
      ) {
        button.addEventListener(
          "click",
          () => {
            if (
              callerMode
            ) {
              sendMessage({
                type:
                  "caller_guess",

                optionIndex:
                  index
              });

              return;
            }

            sendMessage({
              type:
                "vote",

              optionIndex:
                index
            });
          }
        );
      }

      wrapper.appendChild(
        button
      );
    }
  );

  return wrapper;
}


/* -------------------------------------------------- */
/* Countdown */
/* -------------------------------------------------- */

function renderCountdown(
  timerElement,
  progressElement,
  phaseEndsAt,
  phaseStartedAt
) {
  if (
    !phaseEndsAt ||
    !Number.isFinite(
      Number(
        phaseEndsAt
      )
    )
  ) {
    timerElement.textContent =
      "--";

    timerElement.classList.remove(
      "urgent"
    );

    progressElement.style.width =
      "0%";

    return;
  }

  const adjustedNow =
    Date.now() +
    state.serverOffset;

  const end =
    Number(
      phaseEndsAt
    );

  const start =
    Number(
      phaseStartedAt ||
      adjustedNow
    );

  const duration =
    Math.max(
      1,
      end - start
    );

  const remaining =
    Math.max(
      0,
      end -
        adjustedNow
    );

  const seconds =
    Math.ceil(
      remaining /
        1000
    );

  const percentage =
    Math.max(
      0,
      Math.min(
        100,
        (remaining /
          duration) *
          100
      )
    );

  timerElement.textContent =
    String(
      seconds
    ).padStart(
      2,
      "0"
    );

  timerElement.classList.toggle(
    "urgent",
    seconds <= 3 &&
      remaining > 0
  );

  progressElement.style.width =
    `${percentage}%`;
}


function startCountdownTicker() {
  if (
    state.countdownTimer
  ) {
    clearInterval(
      state.countdownTimer
    );
  }

  state.countdownTimer =
    setInterval(
      () => {
        const message =
          state.latestState;

        if (!message) {
          return;
        }

        const phase =
          message.game?.phase;

        const endsAt =
          message.game?.phaseEndsAt;

        const startsAt =
          message.game?.phaseStartedAt;

        if (
          state.role ===
          "host"
        ) {
          renderCountdown(
            hostTimer,
            hostTimerProgress,
            endsAt,
            startsAt
          );
        }

        if (
          state.role ===
          "player"
        ) {
          renderCountdown(
            playerTimer,
            playerTimerProgress,
            endsAt,
            startsAt
          );
        }
      },
      100
    );
}


/* -------------------------------------------------- */
/* Generic render helpers */
/* -------------------------------------------------- */

function createPromptElement(
  text
) {
  return makeElement(
    "div",
    "game-prompt",
    text
  );
}


function createCallout(
  text
) {
  return makeElement(
    "div",
    "callout",
    text
  );
}


function optionText(
  options,
  index
) {
  if (
    !Array.isArray(
      options
    ) ||
    !Number.isInteger(
      index
    )
  ) {
    return "";
  }

  return (
    options[index] ??
    ""
  );
}


/* -------------------------------------------------- */
/* Errors / copy */
/* -------------------------------------------------- */

async function copyJoinLink() {
  const joinUrl =
    copyLinkButton.dataset
      .joinUrl;

  if (!joinUrl) {
    return;
  }

  try {
    await navigator.clipboard.writeText(
      joinUrl
    );

    const originalText =
      copyLinkButton.textContent;

    copyLinkButton.textContent =
      "Copied!";

    window.setTimeout(
      () => {
        copyLinkButton.textContent =
          originalText;
      },
      1500
    );
  } catch {
    showToast(
      "Copy failed. Use the displayed join link."
    );
  }
}


function showFatalError(
  title,
  message
) {
  fatalErrorTitle.textContent =
    title;

  fatalErrorMessage.textContent =
    message;

  showScreen(
    "error"
  );
}


function returnToStart() {
  disconnectSocket();

  clearHostSession();

  clearPlayerSession();

  state.role =
    null;

  state.roomCode =
    null;

  state.hostToken =
    null;

  state.playerToken =
    null;

  state.playerId =
    null;

  state.nickname =
    null;

  state.lastRequestedAction =
    null;

  state.latestState =
    null;

  showScreen(
    "landing"
  );
}


/* -------------------------------------------------- */
/* Events */
/* -------------------------------------------------- */

createRoomButton.addEventListener(
  "click",
  beginHostCreation
);


showJoinButton.addEventListener(
  "click",
  () => {
    beginJoinFlow("");
  }
);


joinBackButton.addEventListener(
  "click",
  () => {
    showScreen(
      "landing"
    );
  }
);


joinForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    submitJoin();
  }
);


roomCodeInput.addEventListener(
  "input",
  () => {
    roomCodeInput.value =
      roomCodeInput.value
        .replace(
          /[^a-z0-9]/gi,
          ""
        )
        .slice(
          0,
          6
        )
        .toUpperCase();

    hideJoinError();
  }
);


nicknameInput.addEventListener(
  "input",
  hideJoinError
);


copyLinkButton.addEventListener(
  "click",
  copyJoinLink
);


startGameButton.addEventListener(
  "click",
  () => {
    const totalRounds =
      Number(
        roundCountSelect.value
      );

    const vibe =
      vibeSelect.value;

    startGameButton.disabled =
      true;

    sendMessage({
      type:
        "start_game",

      totalRounds,

      vibe
    });
  }
);


fatalErrorButton.addEventListener(
  "click",
  returnToStart
);


window.addEventListener(
  "online",
  () => {
    if (
      state.role &&
      !state.intentionallyClosed
    ) {
      connectWebSocket();
    }
  }
);


window.addEventListener(
  "offline",
  () => {
    if (
      state.role ===
      "host"
    ) {
      setHostConnectionStatus(
        false
      );
    }

    if (
      state.role ===
      "player"
    ) {
      setPlayerConnectionStatus(
        false
      );
    }
  }
);


/* -------------------------------------------------- */
/* Initial restoration */
/* -------------------------------------------------- */

function tryRestoreExistingSession() {
  const pathCode =
    getJoinCodeFromLocation();

  if (
    pathCode
  ) {
    const playerSession =
      readStorage(
        STORAGE_KEYS.playerSession
      );

    if (
      playerSession &&
      playerSession.roomCode ===
        pathCode
    ) {
      state.role =
        "player";

      state.roomCode =
        playerSession.roomCode;

      state.playerToken =
        playerSession.playerToken;

      state.playerId =
        playerSession.playerId;

      state.nickname =
        playerSession.nickname;

      setConnectingState(
        "Restoring your seat",
        "Reconnecting to your Waveline room..."
      );

      showScreen(
        "connecting"
      );

      connectWebSocket();

      return;
    }

    beginJoinFlow(
      pathCode
    );

    return;
  }

  const hostSession =
    readStorage(
      STORAGE_KEYS.hostSession
    );

  if (
    hostSession
  ) {
    state.role =
      "host";

    state.roomCode =
      hostSession.roomCode;

    state.hostToken =
      hostSession.hostToken;

    setConnectingState(
      "Restoring your room",
      "Reconnecting the Waveline host screen..."
    );

    showScreen(
      "connecting"
    );

    connectWebSocket();

    return;
  }

  showScreen(
    "landing"
  );
}


startCountdownTicker();

tryRestoreExistingSession();