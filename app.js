
const rooms = {
  "public-lounge": {
    name: "Public Lounge",
    description: "The community hangout spot",
    private: false
  },
  gaming: {
    name: "Gaming",
    description: "Talk games and play together",
    private: false
  },
  chill: {
    name: "Chill Zone",
    description: "Relax and meet new people",
    private: false
  },
  staff: {
    name: "Staff Room",
    description: "A private space for staff",
    private: true
  },
  friends: {
    name: "Friends Room",
    description: "A private room for friends",
    private: true
  },
  announcements: {
    name: "Announcements",
    description: "Community news and updates",
    private: false
  }
};

let currentRoom = "public-lounge";
let joined = false;
let muted = false;
let deafened = false;
let livekitRoom = null;
let connecting = false;

const $ = id => document.getElementById(id);

function notify(message) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(notify.timer);
  notify.timer = setTimeout(
    () => toast.classList.remove("show"),
    3500
  );
}

function updateVoiceUI() {
  if ($("joinButton")) $("joinButton").disabled = joined || connecting;
  if ($("leaveButton")) $("leaveButton").disabled = !joined;
  if ($("muteButton")) $("muteButton").disabled = !joined;
  if ($("deafenButton")) $("deafenButton").disabled = !joined;

  if ($("connectionStatus")) {
    $("connectionStatus").textContent =
      joined ? "● Connected" :
      connecting ? "● Connecting..." :
      "● Not connected";
  }

  if ($("voiceTitle")) {
    $("voiceTitle").textContent =
      joined ? "Connected to " + rooms[currentRoom].name :
      "Not in a voice room";
  }

  if ($("voiceSubtitle")) {
    $("voiceSubtitle").textContent =
      joined ? "You're connected to voice chat" :
      "Join a room to start talking";
  }

  $("voice-dot")?.classList.toggle("connected", joined);
}

function setParticipantSpeaking(participants) {
  const speaking = new Set(
    participants.map(participant => participant.identity)
  );

  document.querySelectorAll(".member-card").forEach(card => {
    card.classList.toggle(
      "speaking",
      speaking.has(card.dataset.identity)
    );
  });
}

function renderMembers() {
  const grid = $("memberGrid");
  if (!grid) return;

  grid.replaceChildren();

  if (!joined || !livekitRoom) {
    const empty = document.createElement("div");
    empty.className = "empty-members";
    empty.textContent = "Nobody is in this room yet.";
    grid.appendChild(empty);

    $("memberCount").textContent = "0 online";
    return;
  }

  const local = livekitRoom.localParticipant;
  const participants = [
    local,
    ...livekitRoom.remoteParticipants.values()
  ];

  participants.forEach(participant => {
    const card = document.createElement("div");
    card.className = "member-card";
    card.dataset.identity = participant.identity;

    const avatar = document.createElement("div");
    avatar.className = "avatar green";
    avatar.textContent =
      participant.identity.charAt(0).toUpperCase();

    const details = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent =
      participant === local ? "You" : participant.identity;

    const status = document.createElement("small");
    status.textContent =
      participant === local ? "MEMBER · YOU" : "MEMBER";

    details.append(name, status);
    card.append(avatar, details);
    grid.appendChild(card);
  });

  $("memberCount").textContent =
    participants.length + " online";
}

function renderRoom() {
  const room = rooms[currentRoom];

  $("roomTitle").textContent = room.name;

  $("welcomeTitle").textContent = room.private
    ? "Welcome to " + room.name
    : "Welcome to ChattingVoices!";

  $("roomSubtitle").textContent = room.description;

  $("welcomeDescription").textContent = room.private
    ? "This room is private. Access requires authorization."
    : "Meet people, make friends and talk about anything.";

  document.querySelectorAll(".channel").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.room === currentRoom
    );
  });

  renderMembers();
}

function selectRoom(roomId) {
  if (!rooms[roomId]) return;

  if (joined || connecting) {
    notify("Leave your current voice room before switching.");
    return;
  }

  currentRoom = roomId;
  renderRoom();
}

function applyDeafen() {
  if (!livekitRoom) return;

  livekitRoom.remoteParticipants.forEach(participant => {
    participant.audioTrackPublications.forEach(publication => {
      if (publication.track &&
          typeof publication.track.setVolume === "function") {
        publication.track.setVolume(deafened ? 0 : 1);
      }
    });
  });
}

function setupLiveKitEvents(room) {
  const events = LivekitClient.RoomEvent || {};

  room.on(
    events.ParticipantConnected || "participantConnected",
    () => renderMembers()
  );

  room.on(
    events.ParticipantDisconnected || "participantDisconnected",
    () => renderMembers()
  );

  room.on(
    events.ActiveSpeakersChanged || "activeSpeakersChanged",
    speakers => setParticipantSpeaking(speakers)
  );

  room.on(
    events.TrackSubscribed || "trackSubscribed",
    (track, publication) => {
      if (publication.kind === "audio" && deafened) {
        if (typeof track.setVolume === "function") {
          track.setVolume(0);
        }
      }
    }
  );

  room.on(
    events.TrackUnsubscribed || "trackUnsubscribed",
    () => renderMembers()
  );

  room.on(
    events.Disconnected || "disconnected",
    () => {
      if (livekitRoom !== room) return;

      livekitRoom = null;
      joined = false;
      connecting = false;
      muted = false;
      deafened = false;

      updateVoiceUI();
      updateAudioButtons();
      renderRoom();
    }
  );
}

function updateAudioButtons() {
  if ($("muteButton")) {
    $("muteButton").textContent = muted ? "🔇" : "🎙️";
  }

  if ($("deafenButton")) {
    $("deafenButton").textContent = deafened ? "🔕" : "🎧";
  }
}

// Channel selection
document.querySelectorAll(".channel").forEach(button => {
  button.addEventListener("click", () => {
    const id = button.dataset.room;
    const room = rooms[id];

    if (room?.private) {
      notify("Private room access requires the secure backend.");
      return;
    }

    selectRoom(id);
  });
});

// Join voice
$("joinButton").addEventListener("click", async () => {
  if (joined || connecting) return;

  connecting = true;
  updateVoiceUI();
  notify("Connecting to voice server...");

  let newRoom = null;

  try {
    const response = await fetch(
      "https://chattingvoices-api.ho-anh.workers.dev/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identity: "Guest-" +
            Math.random().toString(36).slice(2, 8),
          room: currentRoom
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Token request failed");
    }

    newRoom = new LivekitClient.Room();
    livekitRoom = newRoom;

    setupLiveKitEvents(newRoom);

    await newRoom.connect(data.serverUrl, data.token);

    await newRoom.localParticipant.setMicrophoneEnabled(true);

    joined = true;
    connecting = false;
    muted = false;
    deafened = false;

    updateVoiceUI();
    updateAudioButtons();
    renderRoom();

    notify("Connected to voice chat!");

  } catch (error) {
    console.error("Voice connection error:", error);

    if (newRoom) {
      try {
        await newRoom.disconnect();
      } catch (disconnectError) {
        console.error(disconnectError);
      }
    }

    if (livekitRoom === newRoom) {
      livekitRoom = null;
    }

    joined = false;
    connecting = false;

    updateVoiceUI();
    updateAudioButtons();
    renderRoom();

    notify("Connection failed: " + error.message);
  }
});

// Leave voice
$("leaveButton").addEventListener("click", async () => {
  if (!livekitRoom || !joined) return;

  const roomToLeave = livekitRoom;

  joined = false;
  muted = false;
  deafened = false;
  livekitRoom = null;

  updateVoiceUI();
  updateAudioButtons();
  renderRoom();

  try {
    await roomToLeave.disconnect();
    notify("You left the voice room.");
  } catch (error) {
    console.error("Disconnect error:", error);
    notify("Disconnected with a warning.");
  }
});

// Mute microphone
$("muteButton").addEventListener("click", async () => {
  if (!livekitRoom || !joined) return;

  const nextMuted = !muted;

  try {
    await livekitRoom.localParticipant.setMicrophoneEnabled(
      !nextMuted
    );

    muted = nextMuted;
    updateAudioButtons();

    notify(muted ? "Microphone muted." : "Microphone unmuted.");
  } catch (error) {
    console.error(error);
    notify("Could not change microphone state.");
  }
});

// Deafen
$("deafenButton").addEventListener("click", () => {
  if (!livekitRoom || !joined) return;

  deafened = !deafened;
  applyDeafen();
  updateAudioButtons();

  notify(deafened ? "Audio deafened." : "Audio restored.");
});

// Create room modal
$("createRoom").addEventListener("click", () => {
  $("roomModal").classList.remove("hidden");
});

$("closeModal").addEventListener("click", () => {
  $("roomModal").classList.add("hidden");
});

$("roomType").addEventListener("change", event => {
  $("passwordField").classList.toggle(
    "hidden",
    event.target.value !== "private"
  );

  $("roomPassword").required =
    event.target.value === "private";
});

$("roomForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("roomName").value.trim();
  const type = $("roomType").value;
  const password = $("roomPassword").value;

  if (!name) return;

  if (type === "private" && password.length < 8) {
    notify("Private room passwords must have at least 8 characters.");
    return;
  }

  notify(type === "private"
    ? "Private room creation needs the secure backend."
    : "Room creation needs the server backend before it can be published.");

  $("roomModal").classList.add("hidden");
});

// Invite
$("inviteButton").addEventListener("click", () => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(location.href)
      .then(() => notify("Website link copied!"))
      .catch(() => notify("Share your website link with friends."));
  } else {
    notify("Website link: " + location.href);
  }
});

$("settingsButton").addEventListener("click", () => {
  notify("Profile and settings are coming soon.");
});

$("serverMenu").addEventListener("click", () => {
  notify("Server settings are coming soon.");
});

// Initial interface
updateVoiceUI();
updateAudioButtons();
renderRoom();
