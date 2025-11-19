// Frontend logic for Granite Advanced Chatbot

const API_BASE = "http://127.0.0.1:8000";

let currentSessionId = null;
let sessions = {};
let ttsEnabled = true;
let recognition = null;

// Utility: generate session ID
function generateSessionId() {
  return "sess_" + Math.random().toString(36).substring(2, 10);
}

// DOM elements
const chatContainer = document.getElementById("chatContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const ttsToggleBtn = document.getElementById("ttsToggleBtn");
const ragToggle = document.getElementById("ragToggle");
const modeSelect = document.getElementById("modeSelect");
const clearChatBtn = document.getElementById("clearChatBtn");
const newSessionBtn = document.getElementById("newSessionBtn");
const sessionsList = document.getElementById("sessionsList");
const activeSessionIdLabel = document.getElementById("activeSessionId");
const fileInput = document.getElementById("fileInput");
const fileLabelInput = document.getElementById("fileLabelInput");
const uploadBtn = document.getElementById("uploadBtn");
const corpusCountLabel = document.getElementById("corpusCount");
const exportButtons = document.querySelectorAll(".export-btn");

// ----- Chat UI helpers -----

function appendMessage(role, text, options = {}) {
  const row = document.createElement("div");
  row.className = `msg-row ${role === "user" ? "user" : "assistant"}`;

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;

  if (options.isTyping) {
    bubble.innerHTML = `
      <span class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </span>
    `;
  }

  row.appendChild(bubble);
  chatContainer.appendChild(row);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return bubble;
}

function clearChatUI() {
  chatContainer.innerHTML = "";
}

// ----- Session handling -----

function createNewSession(label = "New chat") {
  const id = generateSessionId();
  sessions[id] = { id, label };
  setActiveSession(id);
  renderSessions();
}

function setActiveSession(id) {
  currentSessionId = id;
  activeSessionIdLabel.textContent = id || "";
  renderSessions();
}

function renderSessions() {
  sessionsList.innerHTML = "";
  Object.values(sessions).forEach((s) => {
    const pill = document.createElement("button");
    pill.className = "session-pill" + (s.id === currentSessionId ? " active" : "");
    pill.textContent = s.label;
    pill.addEventListener("click", () => {
      setActiveSession(s.id);
      clearChatUI(); // UI only; backend still has memory
    });
    sessionsList.appendChild(pill);
  });
}

// ----- Backend calls -----

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.corpus_chunks === "number") {
      corpusCountLabel.textContent = data.corpus_chunks;
    }
  } catch (e) {
    console.warn("Health check failed", e);
  }
}

async function sendChatMessage() {
  const text = userInput.value.trim();
  if (!text || !currentSessionId) return;

  userInput.value = "";
  const useRag = ragToggle.checked;
  const mode = modeSelect.value || "general";

  appendMessage("user", text);
  const typingBubble = appendMessage("assistant", "", { isTyping: true });

  try {
    const res = await fetch(`${API_BASE}/chat_stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        message: text,
        use_rag: useRag,
        mode: mode,
      }),
    });

    if (!res.ok || !res.body) {
      typingBubble.textContent = "[Error from backend]";
      return;
    }

    // Stream handling
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";

    typingBubble.innerHTML = "";
    const span = document.createElement("span");
    typingBubble.appendChild(span);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      span.textContent = fullText;
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    if (ttsEnabled && fullText.trim()) {
      speak(fullText);
    }
  } catch (err) {
    typingBubble.textContent = `[Error] ${err}`;
  }
}

async function clearSessionOnServer() {
  if (!currentSessionId) return;
  try {
    await fetch(`${API_BASE}/clear_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId }),
    });
  } catch (e) {
    console.warn("Failed to clear session", e);
  }
}

async function uploadFile() {
  const file = fileInput.files[0];
  if (!file) return alert("Choose a file first.");

  const label = fileLabelInput.value || file.name;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source_name", label);

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    const res = await fetch(`${API_BASE}/upload_file`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.status === "ok") {
      corpusCountLabel.textContent = data.total_chunks ?? corpusCountLabel.textContent;
      alert(`Indexed ${data.chunks_added} chunks from ${data.file}`);
    } else {
      alert("Upload failed: " + (data.error || "Unknown error"));
    }
  } catch (e) {
    alert("Upload error: " + e);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload & Index";
    fileInput.value = "";
    fileLabelInput.value = "";
  }
}

async function exportChat(format) {
  if (!currentSessionId) return alert("No active session.");

  try {
    const res = await fetch(`${API_BASE}/export_chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, format }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("Export failed: " + (err.error || "Unknown error"));
      return;
    }

    // Download file
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `granite_chat_${currentSessionId}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Export error: " + e);
  }
}

// ----- TTS -----
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  speechSynthesis.speak(utter);
}

// ----- STT (Microphone) -----
function initSpeechRecognition() {
  const SR =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (!SR) {
    alert("Speech recognition not supported in this browser.");
    return null;
  }
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInput.value = transcript;
  };
  rec.onerror = (e) => console.warn("Speech recognition error", e);
  return rec;
}

// ----- Event listeners -----

sendBtn.addEventListener("click", sendChatMessage);

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

clearChatBtn.addEventListener("click", async () => {
  if (confirm("Clear this session's chat?")) {
    clearChatUI();
    await clearSessionOnServer();
  }
});

newSessionBtn.addEventListener("click", () => {
  createNewSession("New chat");
});

uploadBtn.addEventListener("click", uploadFile);

exportButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const fmt = btn.getAttribute("data-format");
    exportChat(fmt);
  });
});

ttsToggleBtn.addEventListener("click", () => {
  ttsEnabled = !ttsEnabled;
  ttsToggleBtn.style.borderColor = ttsEnabled ? "#22c55e" : "#4b5563";
});

micBtn.addEventListener("click", () => {
  if (!recognition) {
    recognition = initSpeechRecognition();
  }
  if (!recognition) return;
  recognition.start();
});

// ----- Init -----
(function init() {
  createNewSession("First chat");
  fetchHealth();
})();
