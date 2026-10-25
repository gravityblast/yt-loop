const $ = (id) => document.getElementById(id);
const startInput = $('start');
const endInput = $('end');
const statusEl = $('status');

let currentVideoId = null;
let holdMessageUntil = 0; // keep validation errors visible for a moment

// Runs inside the YouTube page itself (world: MAIN), so it can call the
// player's internal API. Must be self-contained: no references to outer scope.
// For 'start' the args are (start, end); for 'speed' the first arg is the rate.
function playerCommand(cmd, start, end) {
  const player = document.getElementById('movie_player');
  if (!player || typeof player.getCurrentTime !== 'function') {
    return { ok: false, error: 'No YouTube player found. Open a watch page.' };
  }
  const videoId = () => new URL(location.href).searchParams.get('v');

  const stop = () => {
    if (window.__ytLoop) clearInterval(window.__ytLoop.intervalId);
    window.__ytLoop = null;
  };

  if (cmd === 'start') {
    stop();
    const loopVideo = videoId();
    player.seekTo(start, true);
    player.playVideo();
    const intervalId = setInterval(() => {
      // Stop automatically if the user navigates to another video.
      if (videoId() !== loopVideo) return stop();
      if (player.getCurrentTime() >= end) player.seekTo(start, true);
    }, 100);
    window.__ytLoop = { intervalId, start, end, videoId: loopVideo };
  } else if (cmd === 'stop') {
    stop();
  } else if (cmd === 'speed') {
    // Go through YouTube's API so its own speed menu stays in sync, then set the
    // <video> element directly so values YouTube doesn't offer (e.g. 0.85) work too.
    player.setPlaybackRate(start);
    const video = player.querySelector('video');
    if (video) video.playbackRate = start;
  }

  const video = player.querySelector('video');

  const loop = window.__ytLoop;
  return {
    ok: true,
    videoId: videoId(),
    time: player.getCurrentTime(),
    duration: player.getDuration(),
    loop: loop ? { start: loop.start, end: loop.end } : null,
    rate: video ? video.playbackRate : player.getPlaybackRate(),
  };
}

async function getYouTubeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:\/\/([^/]+\.)?youtube\.com\//.test(tab.url)) {
    return null;
  }
  return tab;
}

async function run(cmd, start, end) {
  const tab = await getYouTubeTab();
  if (!tab) return { ok: false, error: 'Switch to a YouTube tab.' };
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: playerCommand,
      args: [cmd, start ?? 0, end ?? 0],
    });
    return res.result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// "65", "1:05", "1:05.5", "1:02:03" -> seconds
function parseTime(str) {
  const s = str.trim();
  if (!s) return NaN;
  const parts = s.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN;
  return parts.reduce((acc, p) => acc * 60 + parseFloat(p), 0);
}

function formatTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  const neg = sec < 0;
  sec = Math.round(Math.abs(sec) * 10) / 10;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  // Keep one decimal only when it's not a whole second.
  let ss = s.toFixed(1).replace(/\.0$/, '');
  if (s < 10) ss = '0' + ss;
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  return (neg ? '-' : '') + body;
}

function setStatus(text, looping = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('looping', looping);
}

function render(res) {
  if (!res.ok) {
    $('current').textContent = '--:--';
    $('duration').textContent = '--:--';
    setStatus(res.error);
    return;
  }
  $('current').textContent = formatTime(res.time);
  $('duration').textContent = formatTime(res.duration);
  if (res.loop) {
    setStatus(`Looping ${formatTime(res.loop.start)} → ${formatTime(res.loop.end)}`, true);
  } else if (Date.now() > holdMessageUntil) {
    setStatus('Not looping');
  }
  renderSpeed(res.rate);
  if (res.videoId !== currentVideoId) {
    currentVideoId = res.videoId;
    restoreForVideo(res);
  }
}

// Remember start/end per video so you can come back to it later.
async function restoreForVideo(res) {
  if (res.loop) {
    startInput.value = formatTime(res.loop.start);
    endInput.value = formatTime(res.loop.end);
    return;
  }
  if (!currentVideoId) return;
  const key = `video:${currentVideoId}`;
  const saved = (await chrome.storage.local.get(key))[key];
  startInput.value = saved ? formatTime(saved.start) : '';
  endInput.value = saved ? formatTime(saved.end) : '';
}

function saveForVideo(start, end) {
  if (!currentVideoId) return;
  chrome.storage.local.set({ [`video:${currentVideoId}`]: { start, end } });
}

function showError(text) {
  holdMessageUntil = Date.now() + 3000;
  setStatus(text);
}

function readInputs() {
  const start = parseTime(startInput.value);
  const end = parseTime(endInput.value);
  startInput.classList.toggle('invalid', Number.isNaN(start));
  endInput.classList.toggle('invalid', Number.isNaN(end));
  if (Number.isNaN(start) || Number.isNaN(end)) {
    showError('Invalid time format.');
    return null;
  }
  if (end <= start) {
    endInput.classList.add('invalid');
    showError('End must be after start.');
    return null;
  }
  return { start, end };
}

async function startLoop() {
  const t = readInputs();
  if (!t) return;
  const res = await run('start', t.start, t.end);
  if (res.ok) saveForVideo(t.start, t.end);
  render(res);
}

async function setFromNow(input) {
  const res = await run('status');
  if (!res.ok) return render(res);
  input.value = formatTime(res.time);
  input.classList.remove('invalid');
}

function nudge(input, delta) {
  const v = parseTime(input.value);
  const base = Number.isNaN(v) ? 0 : v;
  input.value = formatTime(Math.max(0, Math.round((base + delta) * 10) / 10));
  input.classList.remove('invalid');
}

const MIN_SPEED = 0.1;
const MAX_SPEED = 4;
const speedSlider = $('speedSlider');

function renderSpeed(rate) {
  if (!Number.isFinite(rate)) return;
  $('speedValue').textContent = `${+rate.toFixed(2)}×`;
  // Don't yank the slider out from under the user while they're dragging it.
  if (document.activeElement !== speedSlider) speedSlider.value = rate;
  document.querySelectorAll('#speedPresets button').forEach((b) => {
    b.classList.toggle('active', Math.abs(parseFloat(b.dataset.rate) - rate) < 0.001);
  });
}

async function setSpeed(rate) {
  rate = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(rate * 100) / 100));
  render(await run('speed', rate));
}

async function nudgeSpeed(delta) {
  const res = await run('status');
  if (!res.ok) return render(res);
  setSpeed(res.rate + delta);
}

speedSlider.addEventListener('input', () => setSpeed(parseFloat(speedSlider.value)));
$('speedDown').addEventListener('click', () => nudgeSpeed(-0.05));
$('speedUp').addEventListener('click', () => nudgeSpeed(0.05));
$('speedPresets').addEventListener('click', (e) => {
  const rate = e.target.dataset.rate;
  if (rate) setSpeed(parseFloat(rate));
});

$('loop').addEventListener('click', startLoop);
$('stop').addEventListener('click', async () => render(await run('stop')));
$('startNow').addEventListener('click', () => setFromNow(startInput));
$('endNow').addEventListener('click', () => setFromNow(endInput));

for (const input of [startInput, endInput]) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startLoop();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 1 : 0.1;
      nudge(input, e.key === 'ArrowUp' ? step : -step);
    }
  });
}

document.querySelectorAll('.nudge').forEach((group) => {
  const input = $(group.dataset.target);
  group.addEventListener('click', (e) => {
    const delta = e.target.dataset.delta;
    if (delta) nudge(input, parseFloat(delta));
  });
});

// Keep the clock and loop status fresh while the panel is open.
async function poll() {
  render(await run('status'));
}
poll();
setInterval(poll, 500);
chrome.tabs.onActivated.addListener(poll);
