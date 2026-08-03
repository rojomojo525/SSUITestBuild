import Keycloak from 'keycloak-js';
import { HeadlessAPI } from 'biodaw';
import keycloakConfig from './keycloakConfig.js';
import './styles.css';

const keycloak = new Keycloak(keycloakConfig);
const MediMuseAPI = HeadlessAPI.MediMuse;
let tokenRefreshInterval = null;
let selectedTargetStateValues = new Set();

const authStatusEl = document.getElementById('authStatus');
const userDisplayEl = document.getElementById('userDisplay');
const licenseDisplayEl = document.getElementById('licenseDisplay');
const sessionDisplayEl = document.getElementById('sessionDisplay');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const createSessionBtn = document.getElementById('createSessionBtn');
const publicFolderSelect = document.getElementById('publicFolderSelect');
const loadPublicFolderBtn = document.getElementById('loadPublicFolderBtn');
const publicDataStatusEl = document.getElementById('publicDataStatus');
const targetStatesPanel = document.getElementById('targetStatesPanel');
const targetStatesSummary = document.getElementById('targetStatesSummary');
const targetStatesMatrix = document.getElementById('targetStatesMatrix');
const applyTargetStatesBtn = document.getElementById('applyTargetStatesBtn');
const targetStatesStatus = document.getElementById('targetStatesStatus');
const biometricTracksPanel = document.getElementById('biometricTracksPanel');
const biometricTracksSummary = document.getElementById('biometricTracksSummary');
const biometricTracksList = document.getElementById('biometricTracksList');
const biometricChartPanel = document.getElementById('biometricChartPanel');
const biometricChartTrack = document.getElementById('biometricChartTrack');
const loadBiometricChartBtn = document.getElementById('loadBiometricChartBtn');
const biometricChartStatus = document.getElementById('biometricChartStatus');
const biometricChartFrame = document.getElementById('biometricChartFrame');
const biometricChartCanvas = document.getElementById('biometricChartCanvas');

function log(message, data) {
  if (data === undefined) {
    console.info(`[StateSong] ${message}`);
  } else {
    console.info(`[StateSong] ${message}`, data);
  }
}

function folderName(folder) {
  if (typeof folder === 'string') return folder;
  return folder?.name || folder?.folderName || folder?.path || String(folder);
}

function renderFolderOptions(folders) {
  publicFolderSelect.replaceChildren();

  const prompt = document.createElement('option');
  prompt.value = '';
  prompt.textContent = folders.length
    ? 'Choose a server dataset'
    : 'No public datasets returned';
  publicFolderSelect.append(prompt);

  folders.forEach((folder) => {
    const name = folderName(folder);
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    publicFolderSelect.append(option);
  });

  publicFolderSelect.disabled = folders.length === 0;
  loadPublicFolderBtn.disabled = true;
}

function clearBiometricTracks() {
  biometricTracksList.replaceChildren();
  biometricTracksSummary.textContent = '';
  biometricChartTrack.replaceChildren();
  biometricChartStatus.textContent = '';
  biometricChartFrame.hidden = true;
  biometricChartPanel.hidden = true;
  biometricTracksPanel.hidden = true;
}

function stateValue(state) {
  if (typeof state === 'string') return state;
  return state?.name || state?.state || state?.id || String(state);
}

function clearTargetStates() {
  selectedTargetStateValues = new Set();
  targetStatesMatrix.replaceChildren();
  targetStatesPanel.hidden = true;
  applyTargetStatesBtn.disabled = true;
  targetStatesStatus.textContent = '';
}

function renderTargetStates(sessionState) {
  const available = Array.isArray(sessionState?.availableTargetStates)
    ? sessionState.availableTargetStates.map(stateValue)
    : [];
  targetStatesMatrix.replaceChildren();

  available.forEach((targetState, index) => {
    const option = document.createElement('label');
    const checkbox = document.createElement('input');
    const label = document.createElement('span');

    checkbox.type = 'checkbox';
    checkbox.name = 'targetState';
    checkbox.value = targetState;
    checkbox.checked = selectedTargetStateValues.has(targetState);
    checkbox.id = `target-state-${index}`;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedTargetStateValues.add(targetState);
      } else {
        selectedTargetStateValues.delete(targetState);
      }
    });
    label.textContent = targetState;
    option.append(checkbox, label);
    targetStatesMatrix.append(option);
  });

  targetStatesSummary.textContent = available.length
    ? `${available.length} available state${available.length === 1 ? '' : 's'}. Choose any, all, or none as active biometric states.`
    : 'This session did not return any available target states.';
  applyTargetStatesBtn.disabled = available.length === 0;
  targetStatesPanel.hidden = false;
}

async function refreshTargetStates() {
  if (!MediMuseAPI.sessionId) return null;
  const sessionState = await MediMuseAPI.getSessionState();
  renderTargetStates(sessionState);
  return sessionState;
}

function normalizeStagedTracks(stagedTracks) {
  if (Array.isArray(stagedTracks)) return stagedTracks;
  if (!stagedTracks || typeof stagedTracks !== 'object') return [];

  return Object.entries(stagedTracks).map(([key, track]) => (
    track && typeof track === 'object'
      ? { _trackKey: key, ...track }
      : { _trackKey: key, value: track }
  ));
}

function trackName(track, index) {
  if (typeof track === 'string') return track;
  return track?.name
    || track?.trackName
    || track?.biometricType
    || track?.metric
    || track?.channel
    || track?.type
    || track?._trackKey
    || `Biometric track ${index + 1}`;
}

function trackDetails(track) {
  if (!track || typeof track !== 'object') return '';

  const details = [
    ['Format', track.format || track.fileType],
    ['Sample rate', track.sampleRate || track.samplingRate],
    ['Samples', track.sampleCount || track.samplesCount || track.length],
    ['Source', track.fileName || track.path || track.url]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  return details.map(([label, value]) => `${label}: ${value}`).join(' · ');
}

function trackIdentifier(track) {
  if (typeof track === 'string') return track;
  return track?.trackId
    || track?.id
    || track?.name
    || track?.trackName
    || track?._trackKey
    || null;
}

function numericSeries(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.samples,
    payload?.values,
    payload?.trackData
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    if (candidate.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      return candidate;
    }
    if (candidate.every((value) => Array.isArray(value) && typeof value[0] === 'number' && Number.isFinite(value[0]))) {
      return candidate.map((value) => value[0]);
    }
  }
  return null;
}

function responseShape(payload) {
  if (Array.isArray(payload)) return `array (${payload.length} items)`;
  if (payload && typeof payload === 'object') {
    const keys = Object.keys(payload);
    return keys.length ? `object with keys: ${keys.join(', ')}` : 'empty object';
  }
  return typeof payload;
}

function renderBiometricChart(samples, label) {
  const canvas = biometricChartCanvas;
  const context = canvas.getContext('2d');
  const width = Math.max(640, Math.floor(canvas.clientWidth * window.devicePixelRatio));
  const height = Math.floor(300 * window.devicePixelRatio);
  canvas.width = width;
  canvas.height = height;

  const maxPoints = Math.max(2, Math.floor(width / 2));
  const stride = Math.max(1, Math.ceil(samples.length / maxPoints));
  const plotted = samples.filter((_, index) => index % stride === 0);
  if (plotted[plotted.length - 1] !== samples[samples.length - 1]) plotted.push(samples[samples.length - 1]);

  const minimum = Math.min(...plotted);
  const maximum = Math.max(...plotted);
  const range = maximum - minimum || 1;
  const padding = 34 * window.devicePixelRatio;

  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#2f3d54';
  context.lineWidth = window.devicePixelRatio;
  context.beginPath();
  context.moveTo(padding, padding);
  context.lineTo(padding, height - padding);
  context.lineTo(width - padding, height - padding);
  context.stroke();

  context.strokeStyle = '#b8ff4f';
  context.lineWidth = 2 * window.devicePixelRatio;
  context.beginPath();
  plotted.forEach((value, index) => {
    const x = padding + (index / Math.max(1, plotted.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - minimum) / range) * (height - padding * 2);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  canvas.setAttribute(
    'aria-label',
    `${label} biometric chart with ${samples.length} samples, minimum ${minimum}, maximum ${maximum}.`
  );
  biometricChartFrame.hidden = false;
  return { minimum, maximum, plottedPoints: plotted.length };
}

function renderBiometricTracks(sessionState) {
  const tracks = normalizeStagedTracks(sessionState?.stagedTracks);
  biometricTracksList.replaceChildren();
  biometricChartTrack.replaceChildren();

  tracks.forEach((track, index) => {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    const details = document.createElement('span');

    name.textContent = trackName(track, index);
    details.textContent = trackDetails(track);
    item.append(name);
    if (details.textContent) item.append(details);
    biometricTracksList.append(item);

    const identifier = trackIdentifier(track);
    if (identifier) {
      const option = document.createElement('option');
      option.value = identifier;
      option.textContent = trackName(track, index);
      biometricChartTrack.append(option);
    }
  });

  biometricTracksSummary.textContent = tracks.length
    ? `${tracks.length} biometric track${tracks.length === 1 ? '' : 's'} staged and available.`
    : 'MediMuse reports READY_FOR_DOWNLOAD, but no staged biometric tracks were returned.';
  biometricTracksPanel.hidden = false;
  biometricChartPanel.hidden = tracks.length === 0;
  loadBiometricChartBtn.disabled = biometricChartTrack.options.length === 0;
  if (tracks.length > 0 && biometricChartTrack.options.length === 0) {
    biometricChartStatus.textContent = 'Track metadata is available, but it contains no trackId, id, name, or keyed track identifier required by GET /session/{sessionId}/trackData/{trackId}.';
  }
}

async function waitForReadySessionState(maxAttempts = 30) {
  let latestState = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    latestState = await MediMuseAPI.getSessionState();
    const stateLabel = latestState?.sessionState || latestState?.state;
    if (stateLabel === 'READY_FOR_DOWNLOAD') return latestState;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
  }

  return latestState;
}

function updateAuthenticatedUI(isAuthenticated) {
  loginBtn.hidden = isAuthenticated;
  logoutBtn.hidden = !isAuthenticated;
  createSessionBtn.disabled = !isAuthenticated;

  if (!isAuthenticated) {
    authStatusEl.textContent = 'Not authenticated. Use Login / Register to access Medimuse services.';
    userDisplayEl.textContent = 'Public user';
    licenseDisplayEl.textContent = 'Unlicensed';
    sessionDisplayEl.textContent = 'Not created';
    renderFolderOptions([]);
    clearTargetStates();
    clearBiometricTracks();
    publicFolderSelect.firstElementChild.textContent = 'Login and start a session first';
    publicDataStatusEl.textContent = 'Waiting for secure access.';
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  }
}

async function loadPublicFolders() {
  publicDataStatusEl.textContent = 'Checking public datasets on MediMuse…';
  const folders = await MediMuseAPI.getPublicFolders();
  const availableFolders = Array.isArray(folders) ? folders : [];
  renderFolderOptions(availableFolders);
  publicDataStatusEl.textContent = availableFolders.length
    ? `${availableFolders.length} public dataset${availableFolders.length === 1 ? '' : 's'} available. Choose one to continue.`
    : 'MediMuse returned no public datasets.';
  log('Public folders loaded.', folders);
}

async function loadUserProfile() {
  try {
    const profile = await keycloak.loadUserProfile();
    userDisplayEl.textContent = profile.firstName || profile.username || profile.email || 'Authenticated user';
  } catch (error) {
    log('Unable to load Keycloak user profile.', error.message);
    userDisplayEl.textContent = keycloak.tokenParsed?.preferred_username || 'Authenticated user';
  }
}

function updateLicenseDisplay() {
  const claims = keycloak.tokenParsed || {};
  const licenseType = claims.type_lic;
  const expiryHuman = claims.lic_exp_human;

  if (licenseType === 'SUPER') {
    licenseDisplayEl.textContent = 'Pro Access';
    return;
  }

  if (licenseType && expiryHuman) {
    licenseDisplayEl.textContent = `${licenseType} · expires ${expiryHuman}`;
    return;
  }

  licenseDisplayEl.textContent = licenseType || 'Authenticated';
}

function attachTokenProvider() {
  MediMuseAPI.setTokenProvider(async () => {
    if (!keycloak.authenticated) {
      return null;
    }
    return keycloak.token;
  });
}

function startBackgroundRefresh() {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  tokenRefreshInterval = window.setInterval(async () => {
    try {
      const refreshed = await keycloak.updateToken(30);
      if (refreshed) {
        log('Background token refresh succeeded.');
      }
    } catch (error) {
      log('Background token refresh failed. Returning to signed-out state.', error.message);
      updateAuthenticatedUI(false);
    }
  }, 10000);
}

async function initializeAuth() {
  authStatusEl.textContent = 'Initializing Keycloak…';
  log('Initializing Keycloak.', keycloakConfig);

  try {
    const authenticated = await keycloak.init({
      onLoad: 'check-sso',
      checkLoginIframe: false,
      pkceMethod: 'S256',
      silentCheckSsoRedirectUri: `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/silent-check-sso.html`
    });

    if (!authenticated) {
      updateAuthenticatedUI(false);
      log('No existing SSO session found. User remains public until login.');
      return;
    }

    attachTokenProvider();
    startBackgroundRefresh();
    updateAuthenticatedUI(true);
    updateLicenseDisplay();
    await loadUserProfile();
    authStatusEl.textContent = 'Authenticated with Keycloak. Medimuse API is ready.';
    log('Keycloak authenticated successfully.', keycloak.tokenParsed || {});
  } catch (error) {
    updateAuthenticatedUI(false);
    authStatusEl.textContent = 'Keycloak initialization failed.';
    log('Keycloak initialization failed.', error.message);
  }
}

loginBtn.addEventListener('click', async () => {
  log('Redirecting to Keycloak login.');
  await keycloak.login();
});

logoutBtn.addEventListener('click', async () => {
  log('Logging out and returning to the sample shell.');
  await keycloak.logout({ redirectUri: window.location.href });
});

createSessionBtn.addEventListener('click', async () => {
  createSessionBtn.disabled = true;
  clearTargetStates();
  clearBiometricTracks();
  try {
    authStatusEl.textContent = 'Creating a secure MediMuse session…';
    publicDataStatusEl.textContent = 'Preparing the public-data workflow…';
    const session = await MediMuseAPI.createSession();
    sessionDisplayEl.textContent = MediMuseAPI.sessionId || session.name || 'Created';
    authStatusEl.textContent = 'Secure session created.';
    log('Session created.', session);
    await refreshTargetStates();
    await loadPublicFolders();
  } catch (error) {
    authStatusEl.textContent = 'Session creation failed.';
    publicDataStatusEl.textContent = 'Could not begin the public-data workflow.';
    log('Session creation failed.', error.message);
  } finally {
    createSessionBtn.disabled = !keycloak.authenticated;
  }
});

publicFolderSelect.addEventListener('change', () => {
  loadPublicFolderBtn.disabled = !publicFolderSelect.value;
  if (publicFolderSelect.value) {
    publicDataStatusEl.textContent = `${publicFolderSelect.value} is ready to load.`;
  }
});

loadPublicFolderBtn.addEventListener('click', async () => {
  const selectedFolder = publicFolderSelect.value;
  if (!selectedFolder || !MediMuseAPI.sessionId) return;

  loadPublicFolderBtn.disabled = true;
  clearBiometricTracks();
  try {
    publicDataStatusEl.textContent = `Loading ${selectedFolder} into the secure session…`;
    const result = await MediMuseAPI.loadPublicFolder(selectedFolder);
    const sessionState = await waitForReadySessionState().catch(() => null);
    const stateLabel = sessionState?.sessionState || sessionState?.state;
    if (stateLabel === 'READY_FOR_DOWNLOAD') {
      renderBiometricTracks(sessionState);
    }
    if (sessionState) renderTargetStates(sessionState);
    publicDataStatusEl.textContent = stateLabel
      ? `${selectedFolder} is loaded. MediMuse reports: ${stateLabel}.`
      : `${selectedFolder} is loaded and ready in MediMuse.`;
    log('Public folder loaded.', { result, sessionState });
  } catch (error) {
    publicDataStatusEl.textContent = `MediMuse could not load ${selectedFolder}.`;
    loadPublicFolderBtn.disabled = false;
    log('Public folder load failed.', error.message);
  }
});

applyTargetStatesBtn.addEventListener('click', async () => {
  if (!MediMuseAPI.sessionId) return;

  const selected = Array.from(
    targetStatesMatrix.querySelectorAll('input[name="targetState"]:checked'),
    (checkbox) => checkbox.value
  );

  applyTargetStatesBtn.disabled = true;
  targetStatesStatus.textContent = 'Applying active biometric states to this session…';
  try {
    const result = await MediMuseAPI.updateTargetStates(selected);
    selectedTargetStateValues = new Set(selected);
    const sessionState = await refreshTargetStates();
    targetStatesStatus.textContent = `${selected.length} active biometric state${selected.length === 1 ? '' : 's'} applied.`;
    log('Active biometric states updated.', { selected, result, sessionState });
  } catch (error) {
    applyTargetStatesBtn.disabled = false;
    targetStatesStatus.textContent = 'MediMuse could not update the active biometric states.';
    log('Active biometric-state update failed.', error.message);
  }
});

loadBiometricChartBtn.addEventListener('click', async () => {
  const trackId = biometricChartTrack.value;
  if (!trackId || !MediMuseAPI.sessionId) return;

  loadBiometricChartBtn.disabled = true;
  biometricChartFrame.hidden = true;
  biometricChartStatus.textContent = `Loading real biometric samples for ${trackId}…`;
  try {
    const payload = await MediMuseAPI.getTrackData(trackId);
    const samples = numericSeries(payload);
    if (!samples) {
      biometricChartStatus.textContent = `MediMuse returned ${responseShape(payload)}. A numeric array is required at the response root or in data, samples, values, or trackData before this track can be charted.`;
      log('Biometric track data has an unsupported shape.', { trackId, payload });
      return;
    }

    const metrics = renderBiometricChart(samples, biometricChartTrack.selectedOptions[0]?.textContent || trackId);
    biometricChartStatus.textContent = `${samples.length} real samples loaded. Range: ${metrics.minimum} to ${metrics.maximum}. ${metrics.plottedPoints} points drawn for display.`;
    log('Biometric chart rendered.', { trackId, sampleCount: samples.length, ...metrics });
  } catch (error) {
    biometricChartStatus.textContent = `Could not load chart data from GET /session/{sessionId}/trackData/${trackId}: ${error.message}`;
    log('Biometric chart data request failed.', { trackId, error: error.message });
  } finally {
    loadBiometricChartBtn.disabled = false;
  }
});

updateAuthenticatedUI(false);
initializeAuth();
