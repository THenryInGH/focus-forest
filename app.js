/* Focus Forest - static GitHub Pages app
 *
 * 1) Paste your Google Form settings below.
 * 2) Deploy to GitHub Pages.
 *
 * Notes:
 * - Google Forms doesn't support CORS, so we use fetch(..., {mode: 'no-cors'}).
 * - This means you won't get a success/fail response in the browser.
 * - Verify by checking your Form responses / linked Google Sheet.
 */

// ========= 1) GOOGLE FORM CONFIG =========
//
// Example formResponse URL format:
//   https://docs.google.com/forms/d/e/FORM_ID/formResponse
//
// To find your entry IDs (entry.123456789):
//   Google Form -> ⋮ -> Get pre-filled link -> fill sample -> Get link
//   The URL will include: entry.XXXX=value
//
// IMPORTANT: The form must accept responses and ideally not require sign-in.
//
const FORM = {
  enabled: true,
  formResponseUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSfPe1pgQjgSrxvuJnen8YGDCJK4_rXXdatHue1yvioZFCgH0Q/formResponse",
  entry: {
    date: "entry.1754781842",
    focusMinutes: "entry.1135211424",
    sessions: "entry.1185003180",
    notes: "entry.1775917514",
  },
};


// ========= 2) STORAGE (per-day) =========
const STORAGE_KEY = "focusForest.daily.v1";

function ymdLocal(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { date: ymdLocal(), sessions: [] };

  try {
    const data = JSON.parse(raw);
    // reset automatically when the day changes
    if (!data.date || data.date !== ymdLocal()) {
      return { date: ymdLocal(), sessions: [] };
    }
    if (!Array.isArray(data.sessions)) data.sessions = [];
    return data;
  } catch {
    return { date: ymdLocal(), sessions: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ========= 3) TIMER =========
let state = loadState();

let running = false;
let paused = false;
let endAt = 0;          // ms timestamp when the session should end
let remainingMs = 0;    // used when paused
let tickHandle = null;

const el = {
  timeDisplay: document.getElementById("timeDisplay"),
  status: document.getElementById("status"),
  minutesInput: document.getElementById("minutesInput"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  stopBtn: document.getElementById("stopBtn"),
  autoSubmit: document.getElementById("autoSubmit"),
  submitBtn: document.getElementById("submitBtn"),
  resetBtn: document.getElementById("resetBtn"),
  todayDate: document.getElementById("todayDate"),
  todayFocused: document.getElementById("todayFocused"),
  todaySessions: document.getElementById("todaySessions"),
  sessionList: document.getElementById("sessionList"),
  forest: document.getElementById("forest"),
};

function fmtMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function setStatus(text) { el.status.textContent = text; }

function setButtons() {
  el.startBtn.disabled = running && !paused;
  el.pauseBtn.disabled = !running;
  el.stopBtn.disabled = !running;
  el.minutesInput.disabled = running && !paused;
}

function tick() {
  if (!running) return;

  const now = Date.now();
  const msLeft = paused ? remainingMs : Math.max(0, endAt - now);
  const secLeft = Math.ceil(msLeft / 1000);

  el.timeDisplay.textContent = fmtMMSS(secLeft);

  if (!paused && msLeft <= 0) {
    completeSession();
  }
}

function startTimer() {
  // refresh day if needed
  state = loadState();
  render();

  const mins = Number(el.minutesInput.value || 25);
  const durationMs = Math.max(1, mins) * 60 * 1000;

  running = true;
  paused = false;
  endAt = Date.now() + durationMs;
  remainingMs = durationMs;

  setStatus("Focusing…");
  setButtons();

  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(tick, 250);
  tick();
}

function pauseResume() {
  if (!running) return;

  if (!paused) {
    // pause
    paused = true;
    remainingMs = Math.max(0, endAt - Date.now());
    setStatus("Paused");
    el.pauseBtn.textContent = "Resume";
  } else {
    // resume
    paused = false;
    endAt = Date.now() + remainingMs;
    setStatus("Focusing…");
    el.pauseBtn.textContent = "Pause";
  }
  setButtons();
  tick();
}

function stopTimer() {
  if (!running) return;

  running = false;
  paused = false;
  endAt = 0;
  remainingMs = 0;

  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;

  el.pauseBtn.textContent = "Pause";
  setStatus("Stopped");
  setButtons();

  // reset display to chosen minutes
  const mins = Number(el.minutesInput.value || 25);
  el.timeDisplay.textContent = fmtMMSS(mins * 60);
}

function completeSession() {
  // store the session as completed
  const mins = Number(el.minutesInput.value || 25);
  state.sessions.push({
    at: new Date().toISOString(),
    minutes: Math.max(1, mins),
  });
  saveState(state);

  // stop timer
  running = false;
  paused = false;
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  el.pauseBtn.textContent = "Pause";
  setStatus("Completed ✅");
  setButtons();

  // update UI and optionally auto-submit
  render();

  // little "celebration" ping (optional, safe)
  try { navigator.vibrate?.(60); } catch {}

  if (el.autoSubmit.checked) {
    submitToday({ note: `Auto: +${mins} min session` });
  }

  // reset display for next run
  const nextMins = Number(el.minutesInput.value || 25);
  el.timeDisplay.textContent = fmtMMSS(nextMins * 60);
}

// ========= 4) GOOGLE FORM SUBMISSION =========
function totalsForToday() {
  const totalMinutes = state.sessions.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
  return { totalMinutes, sessions: state.sessions.length, date: state.date };
}

async function submitToGoogleForm(payload) {
  if (!FORM.enabled) {
    alert("Google Form submission is disabled. Open app.js and set FORM.enabled = true after configuring your form.");
    return;
  }

  const params = new URLSearchParams();
  params.append(FORM.entry.date, payload.date);
  params.append(FORM.entry.focusMinutes, String(payload.totalMinutes));
  params.append(FORM.entry.sessions, String(payload.sessions));
  if (FORM.entry.notes && payload.note) params.append(FORM.entry.notes, payload.note);

  // no-cors: browser won't block due to missing CORS headers, but you also cannot read the response.
  await fetch(FORM.formResponseUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: params.toString(),
  });

  // Best-effort UX (can't confirm success)
  alert("Submitted! ✅\nCheck your Google Form responses / linked sheet to confirm.");
}

function submitToday({ note } = {}) {
  // ensure state is on correct day
  state = loadState();
  render();

  const t = totalsForToday();
  if (t.sessions === 0) {
    alert("No sessions yet for today.");
    return;
  }
  submitToGoogleForm({ ...t, note: note || "" }).catch((e) => {
    console.error(e);
    alert("Couldn't submit (network error). See console.");
  });
}

// ========= 5) RENDER =========
function render() {
  // date + totals
  el.todayDate.textContent = state.date;
  const t = totalsForToday();
  el.todayFocused.textContent = `${t.totalMinutes} min`;
  el.todaySessions.textContent = String(t.sessions);

  // sessions list
  el.sessionList.innerHTML = "";
  state.sessions.slice().reverse().forEach((s) => {
    const li = document.createElement("li");
    const time = new Date(s.at);
    const hh = String(time.getHours()).padStart(2,"0");
    const mm = String(time.getMinutes()).padStart(2,"0");
    li.textContent = `${hh}:${mm} — ${s.minutes} min`;
    el.sessionList.appendChild(li);
  });

  // forest
  el.forest.innerHTML = "";
  const maxTrees = 64;
  const trees = Math.min(maxTrees, t.sessions);
  for (let i = 0; i < trees; i++) {
    const cell = document.createElement("div");
    cell.className = "tree";
    cell.textContent = "🌲";
    el.forest.appendChild(cell);
  }

  // pad empty cells for a tidy grid
  for (let i = trees; i < maxTrees; i++) {
    const cell = document.createElement("div");
    cell.className = "tree";
    cell.textContent = "·";
    el.forest.appendChild(cell);
  }
}

// ========= 6) EVENTS =========
el.startBtn.addEventListener("click", startTimer);
el.pauseBtn.addEventListener("click", pauseResume);
el.stopBtn.addEventListener("click", stopTimer);
el.submitBtn.addEventListener("click", () => submitToday({ note: "Manual submit" }));
el.resetBtn.addEventListener("click", () => {
  if (!confirm("Reset today? This clears your local sessions for today.")) return;
  state = { date: ymdLocal(), sessions: [] };
  saveState(state);
  render();
});

window.addEventListener("load", () => {
  // ensure we reset on day change
  state = loadState();
  render();

  // initialize timer display from minutes input
  const mins = Number(el.minutesInput.value || 25);
  el.timeDisplay.textContent = fmtMMSS(mins * 60);
  setButtons();
});
