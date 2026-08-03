import Keycloak from 'keycloak-js';
import { HeadlessAPI } from 'biodaw';
import keycloakConfig from './keycloakConfig.js';
import './styles.css';

const keycloak = new Keycloak(keycloakConfig);
const MediMuseAPI = HeadlessAPI.MediMuse;
let tokenRefreshInterval = null;
let selectedTargetStateValues = new Set();
let renderedBiometricChart = null;

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
  renderedBiometricChart = null;
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
  applyTargetStatesBtn.disabled = available.length === 0 || !MediMuseAPI.sessionId;
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

function trackUuid(track) {
  if (typeof track === 'string') return track;
  return track?.trackUuid
    || track?.uuid
    || track?._trackKey
    || null;
}

function globalTrackSeries(payload) {
  const candidates = [
    payload,
    payload?.globalTrackData,
    payload?.data,
    payload?.samples,
    payload?.values,
    payload?.trackData
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    if (candidate.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      return [{ label: 'Value', values: candidate }];
    }
    if (candidate.every((sample) => (
      Array.isArray(sample)
      && sample.length > 0
      && sample.every((value) => typeof value === 'number' && Number.isFinite(value))
    ))) {
      const dimensionCount = candidate[0].length;
      if (candidate.every((sample) => sample.length === dimensionCount)) {
        return Array.from({ length: dimensionCount }, (_, dimension) => ({
          label: `Dimension ${dimension + 1}`,
          values: candidate.map((sample) => sample[dimension])
        }));
      }
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

function validTrackStatistic(statistic) {
  return statistic
    && typeof statistic.minimum === 'number'
    && Number.isFinite(statistic.minimum)
    && typeof statistic.maximum === 'number'
    && Number.isFinite(statistic.maximum);
}

function drawBiometricChart(chart) {
  const { series, label, bounds } = chart;
  const canvas = biometricChartCanvas;
  const context = canvas.getContext('2d');
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const cssWidth = Math.max(280, canvas.clientWidth);
  const cssHeight = 300;
  const width = Math.floor(cssWidth * pixelRatio);
  const height = Math.floor(cssHeight * pixelRatio);
  canvas.width = width;
  canvas.height = height;

  const sampleCount = series[0].values.length;
  const maxPoints = Math.max(2, Math.floor(cssWidth));
  const stride = Math.max(1, Math.ceil(sampleCount / maxPoints));
  const minimum = bounds.minimum;
  const maximum = bounds.maximum;
  const range = maximum - minimum || 1;
  const left = 62 * pixelRatio;
  const right = 18 * pixelRatio;
  const top = 34 * pixelRatio;
  const bottom = 42 * pixelRatio;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const colors = ['#b8ff4f', '#50c8ff', '#ffbd59', '#d58cff'];

  context.clearRect(0, 0, width, height);
  context.font = `${12 * pixelRatio}px system-ui, sans-serif`;
  context.fillStyle = '#aab4c3';
  context.textBaseline = 'middle';
  context.textAlign = 'right';

  for (let tick = 0; tick <= 4; tick += 1) {
    const y = top + (tick / 4) * plotHeight;
    const value = maximum - (tick / 4) * range;
    context.fillText(Number(value.toPrecision(5)).toString(), left - 8 * pixelRatio, y);
    context.strokeStyle = '#202b3d';
    context.lineWidth = pixelRatio;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - right, y);
    context.stroke();
  }

  context.strokeStyle = '#2f3d54';
  context.lineWidth = pixelRatio;
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, height - bottom);
  context.lineTo(width - right, height - bottom);
  context.stroke();

  series.forEach((dimension, dimensionIndex) => {
    const plotted = dimension.values.filter((_, index) => index % stride === 0);
    if ((sampleCount - 1) % stride !== 0) plotted.push(dimension.values[sampleCount - 1]);
    context.strokeStyle = colors[dimensionIndex % colors.length];
    context.lineWidth = 2 * pixelRatio;
    context.beginPath();
    plotted.forEach((value, index) => {
      const sourceIndex = index === plotted.length - 1 ? sampleCount - 1 : index * stride;
      const x = left + (sourceIndex / Math.max(1, sampleCount - 1)) * plotWidth;
      const y = top + ((maximum - value) / range) * plotHeight;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  });

  context.font = `${11 * pixelRatio}px system-ui, sans-serif`;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  let legendX = left;
  series.forEach((dimension, dimensionIndex) => {
    context.fillStyle = colors[dimensionIndex % colors.length];
    context.fillRect(legendX, 12 * pixelRatio, 12 * pixelRatio, 3 * pixelRatio);
    context.fillStyle = '#dbe7ff';
    context.fillText(dimension.label, legendX + 17 * pixelRatio, 14 * pixelRatio);
    legendX += (dimension.label.length * 7 + 34) * pixelRatio;
  });

  context.fillStyle = '#aab4c3';
  context.textAlign = 'left';
  context.fillText('First sample', left, height - 16 * pixelRatio);
  context.textAlign = 'right';
  context.fillText(`Sample ${sampleCount}`, width - right, height - 16 * pixelRatio);

  canvas.setAttribute(
    'aria-label',
    `${label} biometric chart with ${sampleCount} samples across ${series.length} dimension${series.length === 1 ? '' : 's'}, minimum ${minimum}, maximum ${maximum}.`
  );
  biometricChartFrame.hidden = false;
  return { sampleCount, stride };
}

function renderBiometricChart(series, label, statistics) {
  const statisticBounds = statistics.filter(validTrackStatistic);
  const sampleBounds = series.reduce((bounds, dimension) => {
    dimension.values.forEach((value) => {
      bounds.minimum = Math.min(bounds.minimum, value);
      bounds.maximum = Math.max(bounds.maximum, value);
    });
    return bounds;
  }, { minimum: Infinity, maximum: -Infinity });
  const bounds = statisticBounds.length
    ? {
        minimum: Math.min(...statisticBounds.map((statistic) => statistic.minimum)),
        maximum: Math.max(...statisticBounds.map((statistic) => statistic.maximum))
      }
    : sampleBounds;

  renderedBiometricChart = { series, label, bounds };
  return {
    ...drawBiometricChart(renderedBiometricChart),
    minimum: bounds.minimum,
    maximum: bounds.maximum,
    usedServerStatistics: statisticBounds.length > 0
  };
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

    const uuid = trackUuid(track);
    if (uuid) {
      const option = document.createElement('option');
      option.value = uuid;
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
    biometricChartStatus.textContent = 'Track metadata is available, but it contains no trackUuid, uuid, or UUID map key required by GET /session/{sessionId}/trackData/{uuid}.';
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
  if (!MediMuseAPI.sessionId) {
    applyTargetStatesBtn.disabled = true;
    targetStatesStatus.textContent = 'Start an active MediMuse session before applying target states.';
    log('Target-state update skipped: no active MediMuse session ID.');
    return;
  }

  const selectedStates = Array.from(
    targetStatesMatrix.querySelectorAll('input[name="targetState"]:checked'),
    (checkbox) => checkbox.value
  );

  applyTargetStatesBtn.disabled = true;
  targetStatesStatus.textContent = 'Applying active biometric states to this session…';
  try {
    const result = await MediMuseAPI.updateTargetStates(selectedStates);
    selectedTargetStateValues = new Set(selectedStates);
    const sessionState = await refreshTargetStates();
    targetStatesStatus.textContent = `${selectedStates.length} active biometric state${selectedStates.length === 1 ? '' : 's'} applied.`;
    log('Active biometric states updated.', { selectedStates, result, sessionState });
  } catch (error) {
    applyTargetStatesBtn.disabled = false;
    targetStatesStatus.textContent = 'MediMuse could not update the active biometric states.';
    log('Active biometric-state update failed.', error.message);
  }
});

loadBiometricChartBtn.addEventListener('click', async () => {
  const trackUuid = biometricChartTrack.value;
  if (!trackUuid || !MediMuseAPI.sessionId) return;

  loadBiometricChartBtn.disabled = true;
  biometricChartFrame.hidden = true;
  renderedBiometricChart = null;
  biometricChartStatus.textContent = `Loading global track data for ${trackUuid}…`;
  try {
    const payload = await MediMuseAPI.getTrackData(trackUuid);
    const series = globalTrackSeries(payload);
    if (!series) {
      biometricChartStatus.textContent = `MediMuse returned ${responseShape(payload)}. Expected global track data as a non-empty numeric sample array or a non-empty sample-by-dimension numeric array at the response root or in globalTrackData, data, samples, values, or trackData.`;
      log('Global biometric track data has an unsupported shape.', { trackUuid, payload });
      return;
    }

    const statisticResults = await Promise.allSettled(
      series.map((_, dimension) => MediMuseAPI.getTrackStatistics(trackUuid, dimension))
    );
    const statistics = statisticResults.map((result) => result.status === 'fulfilled' ? result.value : null);
    const metrics = renderBiometricChart(
      series,
      biometricChartTrack.selectedOptions[0]?.textContent || trackUuid,
      statistics
    );
    const statisticsMessage = metrics.usedServerStatistics
      ? 'Axis range uses MediMuse per-dimension statistics.'
      : 'MediMuse statistics were unavailable; axis range uses only the returned samples.';
    biometricChartStatus.textContent = `${metrics.sampleCount} real samples loaded across ${series.length} dimension${series.length === 1 ? '' : 's'}. Range: ${metrics.minimum} to ${metrics.maximum}. ${statisticsMessage}`;
    log('Global biometric chart rendered.', { trackUuid, dimensions: series.length, statistics, ...metrics });
  } catch (error) {
    biometricChartStatus.textContent = `Could not load global track data from GET /session/{sessionId}/trackData/${trackUuid}: ${error.message}`;
    log('Global biometric chart data request failed.', { trackUuid, error: error.message });
  } finally {
    loadBiometricChartBtn.disabled = false;
  }
});

window.addEventListener('resize', () => {
  if (renderedBiometricChart && !biometricChartFrame.hidden) {
    drawBiometricChart(renderedBiometricChart);
  }
});

updateAuthenticatedUI(false);
initializeAuth();
