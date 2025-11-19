const API_BASE = "http://127.0.0.1:8000";
const STORAGE_KEY = "granite_chat_sessions_v2";

const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const ragToggle = document.getElementById("rag-toggle");
const clearChatBtn = document.getElementById("clear-chat-btn");
const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const sourceNameInput = document.getElementById("source-name");
const uploadStatus = document.getElementById("upload-status");
const modeSelect = document.getElementById("mode-select");
const micBtn = document.getElementById("mic-btn");
const ttsToggleBtn = document.getElementById("tts-toggle-btn");
const newSessionBtn = document.getElementById("new-session-btn");
const sessionListEl = document.getElementById("session-list");
const activeSessionIdEl = document.getElementById("active-session-id");

const exportTxtBtn  = document.getElementById("export-txt-btn");
const exportDocxBtn = document.getElementById("export-docx-btn");
const exportPdfBtn  = document.getElementById("export-pdf-btn");

let sessions = {}; // id -> {id, title, messages}
let SESSION_ID = null;
let chatHistory = []; // currently active session messages
let ttsEnabled = false;

// ---------- Session storage helpers ----------

function saveSessions() {
  const payload = {
    currentId: SESSION_ID,
    sessions,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function createNewSession(initial = false) {
  const id = "sess_" + Math.random().toString(36).slice(2);
  sessions[id] = {
    id,
    title: "New chat",
    messages: [],
  };
  SESSION_ID = id;
  chatHistory = sessions[id].messages;
  if (!initial) {
    saveSessions();
  }
  renderSessionList();
  renderChatFromHistory();
}

function loadSessions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    sessions = {};
    createNewSession(true);
    saveSessions();
    return;
  }
  try {
    const parsed = JSON.parse(saved);
    sessions = parsed.sessions || {};
    SESSION_ID = parsed.currentId || null;
  } catch {
    sessions = {};
    SESSION_ID = null;
  }

  const ids = Object.keys(sessions);
  if (!ids.length) {
    createNewSession(true);
    saveSessions();
    return;
  }

  if (!SESSION_ID || !sessions[SESSION_ID]) {
    SESSION_ID = ids[0];
  }

  chatHistory = sessions[SESSION_ID].messages || [];
  renderSessionList();
  renderChatFromHistory();
}

function renderSessionList() {
  sessionListEl.innerHTML = "";
  const ids = Object.keys(sessions);
  if (!ids.length) {
    activeSessionIdEl.textContent = "";
    return;
  }

  ids.forEach((id) => {
    const session = sessions[id];
    const item = document.createElement("div");
    item.className = "session-item" + (id === SESSION_ID ? " active" : "");
    item.title = session.title || "Untitled";

    const titleSpan = document.createElement("div");
    titleSpan.className = "session-item-title";
    titleSpan.textContent = session.title || "Untitled";

    const idSpan = document.createElement("div");
    idSpan.className = "session-item-id";
    idSpan.textContent = id.slice(0, 8);

    item.appendChild(titleSpan);
    item.appendChild(idSpan);

    item.addEventListener("click", () => {
      switchSession(id);
    });

    sessionListEl.appendChild(item);
  });

  activeSessionIdEl.textContent = "Active: " + SESSION_ID;
}

function switchSession(id) {
  if (!sessions[id]) return;
  SESSION_ID = id;
  chatHistory = sessions[id].messages || [];
  saveSessions();
  renderSessionList();
  renderChatFromHistory();
}

function renderChatFromHistory() {
  chatWindow.innerHTML = "";
  for (const msg of chatHistory) {
    appendMessage(msg.role, msg.text);
  }
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateSessionTitleIfNeeded() {
  const s = sessions[SESSION_ID];
  if (!s) return;
  if (s.title && s.title !== "New chat") return;
  const firstUser = s.messages.find((m) => m.role === "user");
  if (!firstUser) return;
  const raw = firstUser.text.replace(/\s+/g, " ").trim();
  if (!raw) return;
  s.title = raw.length > 35 ? raw.slice(0, 32) + "..." : raw;
  saveSessions();
  renderSessionList();
}

// ---------- UI helpers ----------

function appendMessage(role, text) {
  const row = document.createElement("div");
  row.className = "message-row " + (role === "user" ? "user" : "bot");

  const avatar = document.createElement("div");
  avatar.className = "avatar " + (role === "user" ? "user" : "bot");
  avatar.textContent = role === "user" ? "U" : "G";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const label = document.createElement("div");
  label.className = "name-label";
  label.textContent = role === "user" ? "You" : "Granite";

  const body = document.createElement("div");
  body.className = "message-text";
  body.innerHTML = (text || "").replace(/\n/g, "<br>");

  bubble.appendChild(label);
  bubble.appendChild(body);

  if (role === "user") {
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return { row, body };
}

function getLastBotRow() {
  const rows = chatWindow.querySelectorAll(".message-row.bot");
  if (!rows.length) return null;
  return rows[rows.length - 1];
}

function attachSourcesToLastBot(sources) {
  const row = getLastBotRow();
  if (!row) return;
  const bubble = row.querySelector(".message-bubble");
  if (!bubble) return;

  const old = bubble.querySelector(".sources-row");
  if (old) old.remove();

  if (!sources || !sources.length) return;

  const rowDiv = document.createElement("div");
  rowDiv.className = "sources-row";

  const unique = [...new Set(sources)];

  unique.forEach((src) => {
    const pill = document.createElement("div");
    pill.className = "source-pill";
    pill.innerHTML = `<span>${src}</span>`;
    rowDiv.appendChild(pill);
  });

  bubble.appendChild(rowDiv);
}

// ---------- TTS ----------

function speakText(text) {
  if (!ttsEnabled) return;
  if (!("speechSynthesis" in window)) {
    console.warn("speechSynthesis not supported");
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  utter.pitch = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

ttsToggleBtn.addEventListener("click", () => {
  ttsEnabled = !ttsEnabled;
  ttsToggleBtn.classList.toggle("active-tts", ttsEnabled);
});

// ---------- Mic / STT ----------

let recognition = null;
let recognizing = false;

function getRecognition() {
  if (!("webkitSpeechRecognition" in window)) {
    return null;
  }
  if (!recognition) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      userInput.value = (userInput.value ? userInput.value + " " : "") + transcript;
      userInput.dispatchEvent(new Event("input"));
    };

    recognition.onend = () => {
      recognizing = false;
      micBtn.classList.remove("active-mic");
    };

    recognition.onerror = () => {
      recognizing = false;
      micBtn.classList.remove("active-mic");
    };
  }
  return recognition;
}

micBtn.addEventListener("click", () => {
  const rec = getRecognition();
  if (!rec) {
    alert("Voice input is not supported in this browser.");
    return;
  }
  if (recognizing) {
    rec.stop();
    recognizing = false;
    micBtn.classList.remove("active-mic");
  } else {
    try {
      rec.start();
      recognizing = true;
      micBtn.classList.add("active-mic");
    } catch (e) {
      console.error(e);
    }
  }
});

// ---------- Chat sending ----------

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = userInput.value.trim();
  if (!msg) return;

  const mode = modeSelect.value || "general";

  appendMessage("user", msg);
  chatHistory.push({ role: "user", text: msg });
  sessions[SESSION_ID].messages = chatHistory;
  saveSessions();
  updateSessionTitleIfNeeded();

  userInput.value = "";
  userInput.style.height = "auto";

  try {
    sendBtn.disabled = true;

    const useRag = ragToggle.checked;

    const response = await fetch(API_BASE + "/chat_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: SESSION_ID,
        message: msg,
        use_rag: useRag,
        mode: mode,
      }),
    });

    if (!response.ok || !response.body) {
      const errText = "Error: backend HTTP " + response.status;
      appendMessage("bot", errText);
      chatHistory.push({ role: "bot", text: errText });
      sessions[SESSION_ID].messages = chatHistory;
      saveSessions();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const { body } = appendMessage("bot", "");
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      body.innerHTML = fullText.replace(/\n/g, "<br>");
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    chatHistory.push({ role: "bot", text: fullText });
    sessions[SESSION_ID].messages = chatHistory;
    saveSessions();

    speakText(fullText);

    if (useRag) {
      try {
        const res = await fetch(API_BASE + "/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: msg, top_k: 4 }),
        });
        const data = await res.json();
        const srcs = (data.results || []).map((r) => r.source || "document");
        attachSourcesToLastBot(srcs);
      } catch (e) {
        console.warn("Failed to fetch sources", e);
      }
    }

  } catch (err) {
    console.error(err);
    const errText = "Error talking to backend: " + err.message;
    appendMessage("bot", errText);
    chatHistory.push({ role: "bot", text: errText });
    sessions[SESSION_ID].messages = chatHistory;
    saveSessions();
  } finally {
    sendBtn.disabled = false;
  }
});

// auto-resize textarea
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 90) + "px";
});

// clear current chat (same session id, just wipe messages)
clearChatBtn.addEventListener("click", async () => {
  chatWindow.innerHTML = "";
  chatHistory = [];
  sessions[SESSION_ID].messages = [];
  sessions[SESSION_ID].title = "New chat";
  saveSessions();
  renderSessionList();

  appendMessage("bot", "Conversation cleared. How can I help now?");
  chatHistory.push({ role: "bot", text: "Conversation cleared. How can I help now?" });
  sessions[SESSION_ID].messages = chatHistory;
  saveSessions();

  try {
    await fetch(API_BASE + "/clear_session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION_ID }),
    });
  } catch (e) {
    console.warn("Failed to clear session on server", e);
  }
});

// ---------- Export (TXT, DOCX, PDF) via backend ----------

async function exportChat(format) {
  if (!chatHistory.length) {
    alert("No messages to export.");
    return;
  }
  try {
    const res = await fetch(API_BASE + "/export_chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION_ID, format }),
    });
    if (!res.ok) {
      const errText = await res.text();
      alert("Export error: " + errText);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ext = format.toLowerCase();
    a.href = url;
    a.download = `granite_chat_${SESSION_ID}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("Export error: " + e.message);
  }
}

exportTxtBtn.addEventListener("click", () => exportChat("txt"));
exportDocxBtn.addEventListener("click", () => exportChat("docx"));
exportPdfBtn.addEventListener("click", () => exportChat("pdf"));

// new session button
newSessionBtn.addEventListener("click", () => {
  createNewSession(false);
  saveSessions();
});

// upload + index documents/images
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    uploadStatus.textContent = "Please choose a file first.";
    uploadStatus.style.color = "var(--danger)";
    return;
  }

  uploadStatus.textContent = "Uploading and indexing...";
  uploadStatus.style.color = "var(--text-muted)";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("source_name", sourceNameInput.value || file.name);

  try {
    const res = await fetch(API_BASE + "/upload_file", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.status === "ok") {
      uploadStatus.textContent =
        `Indexed "${data.file}" · Chunks added: ${data.chunks_added} · Total chunks: ${data.total_chunks}`;
      uploadStatus.style.color = "var(--accent)";
      fileInput.value = "";
      sourceNameInput.value = "";
    } else {
      uploadStatus.textContent = "Upload error: " + (data.error || "Unknown");
      uploadStatus.style.color = "var(--danger)";
    }
  } catch (err) {
    console.error(err);
    uploadStatus.textContent = "Upload error: " + err.message;
    uploadStatus.style.color = "var(--danger)";
  }
});

// initial load
loadSessions();
activeSessionIdEl.textContent = "Active: " + SESSION_ID;
