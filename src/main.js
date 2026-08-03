import Keycloak from 'keycloak-js';
import { HeadlessAPI } from 'biodaw';
import keycloakConfig from './keycloakConfig.js';
import './styles.css';

const keycloak = new Keycloak(keycloakConfig);
const MediMuseAPI = HeadlessAPI.MediMuse;
let tokenRefreshInterval = null;

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
const biometricTracksPanel = document.getElementById('biometricTracksPanel');
const biometricTracksSummary = document.getElementById('biometricTracksSummary');
const biometricTracksList = document.getElementById('biometricTracksList');

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
  biometricTracksPanel.hidden = true;
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

function renderBiometricTracks(sessionState) {
  const tracks = normalizeStagedTracks(sessionState?.stagedTracks);
  biometricTracksList.replaceChildren();

  tracks.forEach((track, index) => {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    const details = document.createElement('span');

    name.textContent = trackName(track, index);
    details.textContent = trackDetails(track);
    item.append(name);
    if (details.textContent) item.append(details);
    biometricTracksList.append(item);
  });

  biometricTracksSummary.textContent = tracks.length
    ? `${tracks.length} biometric track${tracks.length === 1 ? '' : 's'} staged and available.`
    : 'MediMuse reports READY_FOR_DOWNLOAD, but no staged biometric tracks were returned.';
  biometricTracksPanel.hidden = false;
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
  clearBiometricTracks();
  try {
    authStatusEl.textContent = 'Creating a secure MediMuse session…';
    publicDataStatusEl.textContent = 'Preparing the public-data workflow…';
    const session = await MediMuseAPI.createSession();
    sessionDisplayEl.textContent = MediMuseAPI.sessionId || session.name || 'Created';
    authStatusEl.textContent = 'Secure session created.';
    log('Session created.', session);
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

updateAuthenticatedUI(false);
initializeAuth();
