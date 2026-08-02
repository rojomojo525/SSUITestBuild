import Keycloak from "keycloak-js";
import { HeadlessAPI } from "biodaw";
import keycloakConfig from "./keycloak-config.js";

async function establishAudioIsolation() {
  if (window.crossOriginIsolated || !("serviceWorker" in navigator)) return;

  const workerUrl = new URL("./coi-serviceworker.js", document.baseURI);
  await navigator.serviceWorker.register(workerUrl, { scope: "./" });

  if (!navigator.serviceWorker.controller) {
    await navigator.serviceWorker.ready;
    window.location.reload();
    await new Promise(() => {});
  }
}

await establishAudioIsolation();

const { parseE4Session, sampleToMidi } = await import("./e4-parser.js");

const elements = {
  startButton: document.querySelector("#startButton"),
  playButton: document.querySelector("#playButton"),
  stopButton: document.querySelector("#stopButton"),
  statusDot: document.querySelector("#statusDot"),
  engineState: document.querySelector("#engineState"),
  statusMessage: document.querySelector("#statusMessage"),
  biodawProof: document.querySelector("#biodawProof"),
  medimuseProof: document.querySelector("#medimuseProof"),
  audioProof: document.querySelector("#audioProof"),
  dropZone: document.querySelector("#dropZone"),
  dropTitle: document.querySelector("#dropTitle"),
  dropHelp: document.querySelector("#dropHelp"),
  folderInput: document.querySelector("#folderInput"),
  zipInput: document.querySelector("#zipInput"),
  chooseFolderButton: document.querySelector("#chooseFolderButton"),
  chooseZipButton: document.querySelector("#chooseZipButton"),
  sampleSession: document.querySelector("#sampleSession"),
  sessionPanel: document.querySelector("#sessionPanel"),
  sessionName: document.querySelector("#sessionName"),
  signalCount: document.querySelector("#signalCount"),
  sessionDuration: document.querySelector("#sessionDuration"),
  trackList: document.querySelector("#trackList"),
  workspaceStatus: document.querySelector("#workspaceStatus"),
  clearSessionButton: document.querySelector("#clearSessionButton"),
  previewSessionButton: document.querySelector("#previewSessionButton"),
  previewLength: document.querySelector("#previewLength"),
  previewLengthValue: document.querySelector("#previewLengthValue"),
  previewPlayhead: document.querySelector("#previewPlayhead"),
  previewPlayheadValue: document.querySelector("#previewPlayheadValue"),
  previewVolume: document.querySelector("#previewVolume"),
  previewVolumeValue: document.querySelector("#previewVolumeValue"),
  authPill: document.querySelector("#authPill"),
  authStatus: document.querySelector("#authStatus"),
  userDisplay: document.querySelector("#userDisplay"),
  licenseDisplay: document.querySelector("#licenseDisplay"),
  backendSessionDisplay: document.querySelector("#backendSessionDisplay"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  createBackendSessionButton: document.querySelector(
    "#createBackendSessionButton",
  ),
};

const runtimeBase = new URL("./app", document.baseURI).href.replace(
  /\/$/,
  "",
);

let helloTrackIndex = -1;
let noteTimer = null;
let activeSession = null;
let engineReady = false;
let previewTimers = [];
let sessionTrackIndexes = [];
let tokenRefreshInterval = null;
const previewStepCount = 40;
let previewDurationSeconds = 30;
let previewOffsetSeconds = 0;
let previewStartedAt = 0;
let previewTicker = 0;
let previewPlaying = false;
let previewVolume = 0.35;
const keycloak = new Keycloak(keycloakConfig);
const MediMuseAPI = HeadlessAPI.MediMuse;

const musicalRoles = {
  ACC: ["Motion melody", "Rhythmic trigger", "Filter motion"],
  BVP: ["Pulse rhythm", "Percussion", "Bass pulse"],
  EDA: ["Texture", "Harmony density", "Filter motion"],
  HR: ["Master tempo", "Bass voice", "Pulse melody"],
  TEMP: ["Warm pad", "Timbre color", "Ambient bed"],
};

const instruments = [
  { value: 0, label: "Acoustic piano" },
  { value: 4, label: "Electric piano" },
  { value: 16, label: "Drawbar organ" },
  { value: 24, label: "Acoustic guitar" },
  { value: 33, label: "Electric bass" },
  { value: 48, label: "String ensemble" },
  { value: 73, label: "Flute" },
  { value: 80, label: "Square synth" },
  { value: 81, label: "Saw synth" },
  { value: 89, label: "Warm pad" },
];

function setAuthenticatedUI(isAuthenticated) {
  elements.loginButton.hidden = isAuthenticated;
  elements.logoutButton.hidden = !isAuthenticated;
  elements.createBackendSessionButton.disabled = !isAuthenticated;
  elements.authPill.textContent = isAuthenticated ? "Secure session" : "Public mode";
  elements.authPill.classList.toggle("is-authenticated", isAuthenticated);

  if (!isAuthenticated) {
    elements.userDisplay.textContent = "Public user";
    elements.licenseDisplay.textContent = "Not authenticated";
    elements.backendSessionDisplay.textContent = "Not created";
    if (tokenRefreshInterval) {
      window.clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  }
}

function updateLicenseDisplay() {
  const claims = keycloak.tokenParsed || {};
  const licenseType = claims.type_lic;
  const expiry = claims.lic_exp_human;

  if (licenseType === "SUPER") {
    elements.licenseDisplay.textContent = "Pro access";
  } else if (licenseType && expiry) {
    elements.licenseDisplay.textContent = `${licenseType} · expires ${expiry}`;
  } else {
    elements.licenseDisplay.textContent = licenseType || "Authenticated";
  }
}

async function loadAuthenticatedProfile() {
  try {
    const profile = await keycloak.loadUserProfile();
    elements.userDisplay.textContent =
      profile.firstName || profile.username || profile.email || "Authenticated user";
  } catch {
    elements.userDisplay.textContent =
      keycloak.tokenParsed?.preferred_username || "Authenticated user";
  }
}

function startTokenRefresh() {
  if (tokenRefreshInterval) window.clearInterval(tokenRefreshInterval);

  tokenRefreshInterval = window.setInterval(async () => {
    try {
      await keycloak.updateToken(30);
    } catch (error) {
      console.error("[StateSong] Keycloak token refresh failed", error);
      setAuthenticatedUI(false);
      elements.authStatus.textContent =
        "Your secure session expired. Please sign in again.";
    }
  }, 10000);
}

async function initializeAuthentication() {
  MediMuseAPI.setTokenProvider(async () => {
    if (!keycloak.authenticated) return null;
    await keycloak.updateToken(30);
    return keycloak.token;
  });

  try {
    const authenticated = await keycloak.init({
      onLoad: "check-sso",
      checkLoginIframe: false,
      pkceMethod: "S256",
      silentCheckSsoRedirectUri: new URL(
        "silent-check-sso.html",
        document.baseURI,
      ).href,
    });

    setAuthenticatedUI(authenticated);
    if (!authenticated) {
      elements.authStatus.textContent =
        "Local E4 preview is available. Sign in for secured MediMuse services.";
      return;
    }

    updateLicenseDisplay();
    await loadAuthenticatedProfile();
    startTokenRefresh();
    elements.authStatus.textContent =
      "Authenticated with Keycloak. The MediMuse client is ready.";
  } catch (error) {
    console.error("[StateSong] Keycloak initialization failed", error);
    setAuthenticatedUI(false);
    elements.authStatus.textContent =
      "Secure login could not initialize. Local E4 preview remains available.";
  }
}

async function createBackendSession() {
  elements.createBackendSessionButton.disabled = true;
  elements.authStatus.textContent = "Creating a secure MediMuse session…";

  try {
    const session = await MediMuseAPI.createSession();
    const sessionId = MediMuseAPI.sessionId || session.name;
    elements.backendSessionDisplay.textContent = sessionId || "Created";
    elements.authStatus.textContent =
      "Secure MediMuse session connected. Generation remains in development.";
  } catch (error) {
    console.error("[StateSong] MediMuse session creation failed", error);
    elements.authStatus.textContent =
      "MediMuse rejected the session request. Please sign in again or try later.";
  } finally {
    elements.createBackendSessionButton.disabled = !keycloak.authenticated;
  }
}

function setStatus(state, message) {
  elements.engineState.textContent = state;
  elements.statusMessage.textContent = message;
}

function markReady() {
  engineReady = true;
  elements.statusDot.classList.add("is-ready");
  elements.startButton.disabled = true;
  elements.startButton.querySelector("span").textContent = "Engine online";
  elements.playButton.disabled = false;
  elements.stopButton.disabled = false;
  elements.biodawProof.textContent = "Online";
  elements.medimuseProof.textContent = HeadlessAPI.MediMuse
    ? "Client ready"
    : "Unavailable";
  elements.audioProof.textContent = `${HeadlessAPI.getSampleRate()} Hz`;
  if (activeSession) {
    elements.previewSessionButton.disabled = false;
    elements.workspaceStatus.textContent =
      "BioDAW is online. Choose mappings, then preview the E4 session.";
  }
}

function stopHelloTone() {
  if (noteTimer) {
    window.clearTimeout(noteTimer);
    noteTimer = null;
  }

  if (helloTrackIndex >= 0) {
    HeadlessAPI.stopSynthNote(helloTrackIndex, 60);
    HeadlessAPI.stopSynthNote(helloTrackIndex, 67);
    HeadlessAPI.stopSynthNote(helloTrackIndex, 72);
  }

  HeadlessAPI.closeAllSynths();
  setStatus("Engine online", "The hello tone is stopped. BioDAW remains ready.");
}

async function startEngine() {
  elements.startButton.disabled = true;
  setStatus("Engine waking", "Loading the BioDAW audio engine and sound library…");
  elements.startButton.querySelector("span").textContent = "Starting…";

  try {
    HeadlessAPI.setAssetBaseUrl(runtimeBase);
    await HeadlessAPI.boot();

    const track = await HeadlessAPI.addTrack("Hello rOjO", "midi");
    const project = HeadlessAPI.getProjectData();
    helloTrackIndex = project.tracks.findIndex((item) => item.id === track.id);
    HeadlessAPI.setTrackInstrument(helloTrackIndex, 0, 89);

    markReady();
    setStatus(
      "Engine online",
      "BioDAW and MediMuse are running locally in this browser.",
    );
  } catch (error) {
    console.error("[Hello rOjO] BioDAW boot failed", error);
    elements.startButton.disabled = false;
    elements.startButton.querySelector("span").textContent = "Try again";
    elements.biodawProof.textContent = "Boot failed";
    elements.audioProof.textContent = "Unavailable";
    setStatus(
      "Engine needs attention",
      `BioDAW could not start: ${error.message}`,
    );
  }
}

function playHelloTone() {
  if (helloTrackIndex < 0) return;

  stopHelloTone();
  setStatus("Signal playing", "A C-major hello is sounding through BioDAW.");

  HeadlessAPI.playSynthNote(helloTrackIndex, 60, 84);
  HeadlessAPI.playSynthNote(helloTrackIndex, 67, 76);
  HeadlessAPI.playSynthNote(helloTrackIndex, 72, 68);

  noteTimer = window.setTimeout(stopHelloTone, 1800);
}

function stopSessionPreview() {
  previewTimers.forEach(window.clearTimeout);
  previewTimers = [];
  window.cancelAnimationFrame(previewTicker);
  previewPlaying = false;
  elements.previewSessionButton.querySelector("span").textContent = "Play";
  sessionTrackIndexes.forEach((trackIndex) => {
    for (let pitch = 36; pitch <= 84; pitch += 1) {
      HeadlessAPI.stopSynthNote(trackIndex, pitch);
    }
  });
}

function updatePlayhead(value) {
  const seconds = Math.max(0, Math.min(previewDurationSeconds, Number(value) || 0));
  elements.previewPlayhead.value = String(seconds);
  elements.previewPlayheadValue.textContent = formatDuration(seconds);
}

function tickPlayhead() {
  if (!previewStartedAt) return;
  const elapsed = previewOffsetSeconds + (performance.now() - previewStartedAt) / 1000;
  updatePlayhead(Math.min(previewDurationSeconds, elapsed));
  if (elapsed < previewDurationSeconds) previewTicker = requestAnimationFrame(tickPlayhead);
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function selectMarkup(options, selected) {
  return options
    .map((option) => {
      const value = typeof option === "object" ? option.value : option;
      const label = typeof option === "object" ? option.label : option;
      return `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${label}</option>`;
    })
    .join("");
}

function renderSession(session) {
  elements.sessionName.textContent = `E4 · ${session.folderName}`;
  elements.signalCount.textContent = String(session.tracks.length);
  elements.sessionDuration.textContent = formatDuration(
    Math.max(...session.tracks.map((track) => track.durationSeconds)),
  );

  elements.trackList.innerHTML = session.tracks
    .map((track, index) => {
      const defaultPrograms = { ACC: 80, BVP: 33, EDA: 48, HR: 16, TEMP: 89 };
      return `
        <article class="track-row" data-track-index="${index}">
          <div class="track-identity">
            <span class="track-color track-${track.name.toLowerCase()}"></span>
            <div>
              <strong>${track.name}</strong>
              <small>${track.frequency} Hz · ${track.dimensions}D</small>
            </div>
          </div>
          <span class="sample-count">${track.samples.length.toLocaleString()}</span>
          <label>
            <span class="sr-only">Musical role for ${track.name}</span>
            <select class="role-select">
              ${selectMarkup(musicalRoles[track.name], musicalRoles[track.name][0])}
            </select>
          </label>
          <label>
            <span class="sr-only">Sound for ${track.name}</span>
            <select class="instrument-select">
              ${selectMarkup(instruments, defaultPrograms[track.name])}
            </select>
          </label>
        </article>
      `;
    })
    .join("");

  elements.sessionPanel.hidden = false;
  const maxDuration = Math.max(...session.tracks.map((track) => track.durationSeconds));
  previewDurationSeconds = Math.max(10, Math.min(3600, Math.round(maxDuration)));
  elements.previewLength.max = String(Math.max(10, Math.min(3600, Math.round(maxDuration))));
  elements.previewLength.value = String(Math.min(30, previewDurationSeconds));
  previewDurationSeconds = Number(elements.previewLength.value);
  elements.previewLengthValue.textContent = `${previewDurationSeconds}s`;
  elements.previewPlayhead.max = String(previewDurationSeconds);
  elements.previewPlayhead.disabled = false;
  updatePlayhead(0);
  elements.previewSessionButton.disabled = !engineReady;
  elements.workspaceStatus.textContent = engineReady
    ? "E4 session validated locally. Choose mappings, then preview them in BioDAW."
    : "E4 session validated locally. Start BioDAW above to preview the mappings.";
}

async function loadSession(files) {
  if (!files.length) return;
  elements.dropZone.classList.add("is-processing");
  elements.dropTitle.textContent = "Reading E4 session…";

  try {
    activeSession = await parseE4Session(files);
    renderSession(activeSession);
    elements.dropZone.classList.remove("is-processing");
    elements.dropTitle.textContent = "E4 session ready";
    elements.dropHelp.textContent =
      "Your biometric files remain on this device unless you explicitly generate a StateSong.";
  } catch (error) {
    activeSession = null;
    elements.sessionPanel.hidden = true;
    elements.dropZone.classList.remove("is-processing");
    elements.dropTitle.textContent = "That folder is not a complete E4 session";
    elements.dropHelp.textContent = error.message;
  }
}

async function filesFromEntry(entry) {
  if (entry.isFile) {
    return new Promise((resolve, reject) =>
      entry.file((file) => resolve([file]), reject),
    );
  }

  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const entries = [];
  let batch = [];
  do {
    batch = await new Promise((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    entries.push(...batch);
  } while (batch.length);

  return (await Promise.all(entries.map(filesFromEntry))).flat();
}

async function droppedFiles(dataTransfer) {
  const entries = [...dataTransfer.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);

  if (!entries.length) return [...dataTransfer.files];
  return (await Promise.all(entries.map(filesFromEntry))).flat();
}

async function previewSession(offset = Number(elements.previewPlayhead.value) || 0) {
  if (!activeSession || !engineReady) return;
  stopSessionPreview();
  previewPlaying = true;
  elements.previewSessionButton.querySelector("span").textContent = "Pause";
  elements.previewSessionButton.disabled = true;
  previewOffsetSeconds = offset;
  previewStartedAt = performance.now();
  elements.workspaceStatus.textContent =
    "Creating five BioDAW voices from the selected biometric mappings…";

  if (!sessionTrackIndexes.length) {
    for (const [index, track] of activeSession.tracks.entries()) {
      const created = await HeadlessAPI.addTrack(`E4 · ${track.name}`, "midi");
      const project = HeadlessAPI.getProjectData();
      const trackIndex = project.tracks.findIndex((item) => item.id === created.id);
      sessionTrackIndexes[index] = trackIndex;
      HeadlessAPI.setTrackVolume(created.id, previewVolume);
    }
  }

  const rows = [...elements.trackList.querySelectorAll(".track-row")];

  activeSession.tracks.forEach((track, trackIndex) => {
    const row = rows[trackIndex];
    const program = Number(row.querySelector(".instrument-select").value);
    const bioTrackIndex = sessionTrackIndexes[trackIndex];
    const bioTrack = HeadlessAPI.getProjectData().tracks[bioTrackIndex];
    if (bioTrack) HeadlessAPI.setTrackVolume(bioTrack.id, previewVolume);
    HeadlessAPI.setTrackInstrument(bioTrackIndex, 0, program);

    const sampleStart = Math.floor((offset / Math.max(1, track.durationSeconds)) * track.samples.length);
    const sampleEnd = Math.min(track.samples.length, Math.floor(((offset + previewDurationSeconds) / Math.max(1, track.durationSeconds)) * track.samples.length));
    const previewSamples = track.samples.slice(sampleStart, sampleEnd).filter((_, index) => index % Math.max(1, Math.floor((sampleEnd - sampleStart) / previewStepCount)) === 0).slice(0, previewStepCount);
    const previewStepLength = (previewDurationSeconds * 1000) / Math.max(1, previewSamples.length);

    previewSamples.forEach((sample, step) => {
      const pitch = sampleToMidi(track, sample, 48 + trackIndex * 2, 18);
      previewTimers.push(
        window.setTimeout(() => {
          HeadlessAPI.playSynthNote(bioTrackIndex, pitch, 68);
          previewTimers.push(
            window.setTimeout(
              () => HeadlessAPI.stopSynthNote(bioTrackIndex, pitch),
              previewStepLength * 0.72,
            ),
          );
        }, step * previewStepLength),
      );
    });
  });

  elements.workspaceStatus.textContent =
    `Previewing ${formatDuration(previewDurationSeconds)} from the five E4 biometric streams.`;
  previewTicker = requestAnimationFrame(tickPlayhead);
  previewTimers.push(
    window.setTimeout(() => {
      stopSessionPreview();
      elements.previewSessionButton.disabled = !engineReady;
      previewStartedAt = 0;
      previewPlaying = false;
      elements.previewSessionButton.querySelector("span").textContent = "Play";
      updatePlayhead(previewDurationSeconds);
      elements.workspaceStatus.textContent =
        "Local mapping preview complete. Full HeartSong generation will use the backend algorithm.";
    }, previewDurationSeconds * 1000 + 300),
  );
}

function clearSession() {
  stopSessionPreview();
  activeSession = null;
  sessionTrackIndexes = [];
  elements.folderInput.value = "";
  elements.sessionPanel.hidden = true;
  elements.previewSessionButton.disabled = true;
  elements.dropTitle.textContent = "Drop an E4 session folder here";
  elements.dropHelp.textContent =
    "Drag a folder or ZIP from your computer. ACC, BVP, EDA, HR and TEMP are required.";
}

elements.startButton.addEventListener("click", startEngine);
elements.playButton.addEventListener("click", playHelloTone);
elements.stopButton.addEventListener("click", stopHelloTone);
elements.chooseFolderButton.addEventListener("click", () =>
  elements.folderInput.click(),
);
elements.folderInput.addEventListener("change", (event) =>
  loadSession([...event.target.files]),
);
elements.zipInput.addEventListener("change", (event) =>
  loadSession([...event.target.files]),
);
elements.chooseZipButton.addEventListener("click", (event) => {
  event.stopPropagation();
  elements.zipInput.click();
});
elements.sampleSession.addEventListener("change", async (event) => {
  const name = event.target.value;
  if (!name) return;
  try {
    const response = await fetch(`./e4-samples/${encodeURIComponent(name)}`);
    if (!response.ok) throw new Error("Sample session could not be loaded.");
    await loadSession([new File([await response.blob()], name, { type: "application/zip" })]);
  } catch (error) {
    elements.dropHelp.textContent = error.message;
  }
});
elements.dropZone.addEventListener("click", (event) => {
  if (event.target !== elements.chooseFolderButton) {
    elements.folderInput.click();
  }
});
elements.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    elements.chooseFolderButton.click();
  }
});
elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("is-dragging");
});
elements.dropZone.addEventListener("dragleave", () =>
  elements.dropZone.classList.remove("is-dragging"),
);
elements.dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("is-dragging");
  await loadSession(await droppedFiles(event.dataTransfer));
});
elements.previewSessionButton.addEventListener("click", () => {
  if (previewPlaying) {
    const elapsed = previewOffsetSeconds + (performance.now() - previewStartedAt) / 1000;
    previewOffsetSeconds = Math.min(previewDurationSeconds, elapsed);
    updatePlayhead(previewOffsetSeconds);
    stopSessionPreview();
    elements.workspaceStatus.textContent = "Preview paused. Move the playhead or press Play to continue.";
  } else {
    previewSession(Number(elements.previewPlayhead.value) || 0);
  }
});
elements.previewLength.addEventListener("input", (event) => {
  previewDurationSeconds = Number(event.target.value);
  elements.previewLengthValue.textContent = `${previewDurationSeconds}s`;
  elements.previewPlayhead.max = String(previewDurationSeconds);
  updatePlayhead(Math.min(Number(elements.previewPlayhead.value), previewDurationSeconds));
});
elements.previewPlayhead.addEventListener("input", (event) => {
  updatePlayhead(event.target.value);
  if (previewStartedAt) previewSession(Number(event.target.value));
});
elements.previewVolume.addEventListener("input", (event) => {
  previewVolume = Number(event.target.value) / 100;
  elements.previewVolumeValue.textContent = `${Math.round(previewVolume * 100)}%`;
  sessionTrackIndexes.forEach((trackIndex) => {
    const track = HeadlessAPI.getProjectData().tracks[trackIndex];
    if (track) HeadlessAPI.setTrackVolume(track.id, previewVolume);
  });
});
elements.clearSessionButton.addEventListener("click", clearSession);
elements.loginButton.addEventListener("click", () =>
  keycloak.login({ redirectUri: window.location.href.split("#")[0] }),
);
elements.logoutButton.addEventListener("click", () =>
  keycloak.logout({ redirectUri: window.location.href.split("#")[0] }),
);
elements.createBackendSessionButton.addEventListener(
  "click",
  createBackendSession,
);

setAuthenticatedUI(false);
initializeAuthentication();

window.addEventListener("beforeunload", () => {
  stopSessionPreview();
  if (helloTrackIndex >= 0) HeadlessAPI.closeAllSynths();
});
