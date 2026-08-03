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
const folderListEl = document.getElementById('folderList');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const createSessionBtn = document.getElementById('createSessionBtn');
const loadFoldersBtn = document.getElementById('loadFoldersBtn');

function log(message, data) {
  if (data === undefined) {
    console.info(`[StateSong] ${message}`);
  } else {
    console.info(`[StateSong] ${message}`, data);
  }
}

function renderFolderList(folders) {
  if (!Array.isArray(folders) || folders.length === 0) {
    folderListEl.innerHTML = '<li>No public folders returned.</li>';
    return;
  }

  folderListEl.innerHTML = folders
    .map((folder) => `<li>${String(folder)}</li>`)
    .join('');
}

function updateAuthenticatedUI(isAuthenticated) {
  loginBtn.hidden = isAuthenticated;
  logoutBtn.hidden = !isAuthenticated;
  createSessionBtn.disabled = !isAuthenticated;
  loadFoldersBtn.disabled = !isAuthenticated;

  if (!isAuthenticated) {
    authStatusEl.textContent = 'Not authenticated. Use Login / Register to access Medimuse services.';
    userDisplayEl.textContent = 'Public user';
    licenseDisplayEl.textContent = 'Unlicensed';
    sessionDisplayEl.textContent = 'Not created';
    renderFolderList([]);
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  }
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
  try {
    authStatusEl.textContent = 'Creating MediMuse session…';
    const session = await MediMuseAPI.createSession();
    sessionDisplayEl.textContent = MediMuseAPI.sessionId || session.name || 'Created';
    authStatusEl.textContent = 'Session created.';
    log('Session created.', session);
  } catch (error) {
    authStatusEl.textContent = 'Session creation failed.';
    log('Session creation failed.', error.message);
  }
});

loadFoldersBtn.addEventListener('click', async () => {
  try {
    authStatusEl.textContent = 'Loading public folders…';
    const folders = await MediMuseAPI.getPublicFolders();
    renderFolderList(folders);
    authStatusEl.textContent = 'Public folders loaded.';
    log('Public folders loaded.', folders);
  } catch (error) {
    authStatusEl.textContent = 'Failed to load public folders.';
    log('Public folder request failed.', error.message);
  }
});

updateAuthenticatedUI(false);
initializeAuth();
