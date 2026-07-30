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

const sdkUrl = new URL("./biodaw/biodaw-sdk.es.js", document.baseURI).href;
const { HeadlessAPI } = await import(sdkUrl);

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
};

const runtimeBase = new URL("./biodaw/app", document.baseURI).href.replace(
  /\/$/,
  "",
);

let helloTrackIndex = -1;
let noteTimer = null;

function setStatus(state, message) {
  elements.engineState.textContent = state;
  elements.statusMessage.textContent = message;
}

function markReady() {
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

elements.startButton.addEventListener("click", startEngine);
elements.playButton.addEventListener("click", playHelloTone);
elements.stopButton.addEventListener("click", stopHelloTone);

window.addEventListener("beforeunload", () => {
  if (helloTrackIndex >= 0) HeadlessAPI.closeAllSynths();
});
