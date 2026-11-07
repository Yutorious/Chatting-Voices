
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

const $ = id => document.getElementById(id);

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 3500);
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
    button.classList.toggle("selected", button.dataset.room === currentRoom);
  });

  $("memberGrid").innerHTML = joined
    ? `<div class="member-card">
         <div class="avatar green">Y</div>
         <div><strong>You</strong><small>MEMBER · YOU</small></div>
       </div>`
    : `<div class="empty-members">Nobody is in this room yet.</div>`;

  $("memberCount").textContent = joined ? "1 online" : "0 online";
}

function selectRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (joined) {
    notify("Leave your current voice room before switching.");
    return;
  }

  currentRoom = roomId;
  renderRoom();
}

document.querySelectorAll(".channel").forEach(button => {
  button.addEventListener("click", () => {
    const id = button.dataset.room;
    const room = rooms[id];

    if (room.private) {
      notify("Private room access requires the secure backend.");
      return;
    }

    selectRoom(id);
  });
});

$("joinButton").addEventListener("click", () => {
  notify("Voice server not configured yet. Next we'll connect LiveKit.");
});

$("createRoom").addEventListener("click", () => {
  $("roomModal").classList.remove("hidden");
});

$("closeModal").addEventListener("click", () => {
  $("roomModal").classList.add("hidden");
});

$("roomType").addEventListener("change", event => {
  $("passwordField").classList.toggle(
    "hidden", event.target.value !== "private"
  );
  $("roomPassword").required = event.target.value === "private";
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
    ? "Private room creation needs the secure backend. No password has been saved."
    : "Room creation needs the server backend before it can be published.");

  $("roomModal").classList.add("hidden");
});

$("muteButton").addEventListener("click", () => {
  muted = !muted;
  $("muteButton").textContent = muted ? "🔇" : "🎙️";
});

$("deafenButton").addEventListener("click", () => {
  deafened = !deafened;
  $("deafenButton").textContent = deafened ? "🔕" : "🎧";
});

$("leaveButton").addEventListener("click", () => {
  joined = false;
  muted = false;
  deafened = false;
  $("muteButton").disabled = true;
  $("deafenButton").disabled = true;
  $("leaveButton").disabled = true;
  $("connectionStatus").textContent = "● Not connected";
  $("voiceTitle").textContent = "Not in a voice room";
  $("voiceSubtitle").textContent = "Join a room to start talking";
  $("muteButton").textContent = "🎙️";
  $("deafenButton").textContent = "🎧";
  $("voice-dot")?.classList.remove("connected");
  renderRoom();
});

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

renderRoom();
