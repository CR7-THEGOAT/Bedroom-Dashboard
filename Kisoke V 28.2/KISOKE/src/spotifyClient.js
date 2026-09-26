const TOKEN_KEY = 'nexora.spotify-token.v1';
const VERIFIER_KEY = 'nexora.spotify-verifier.v1';
const STATE_KEY = 'nexora.spotify-state.v1';
const CLIENT_ID_KEY = 'nexora.spotify-client-id.v1';

function randomString(length = 64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function base64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function spotifyClientId() {
  return localStorage.getItem(CLIENT_ID_KEY) || '';
}

export function saveSpotifyClientId(value) {
  const clean = String(value || '').trim();
  if (clean) localStorage.setItem(CLIENT_ID_KEY, clean);
  else localStorage.removeItem(CLIENT_ID_KEY);
  return clean;
}

export function spotifyRedirectUri() {
  const url = new URL('/music', window.location.origin);
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url.toString();
}

export async function beginSpotifyLogin(clientId = spotifyClientId()) {
  if (!clientId) throw new Error('Add your Spotify app Client ID first.');
  const verifier = randomString(72);
  const state = randomString(28);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    scope: 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state',
    code_challenge_method: 'S256',
    code_challenge: base64Url(digest),
    state
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

function saveToken(data) {
  const token = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + ((Number(data.expires_in) || 3600) * 1000) - 30000
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

function readToken() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  } catch {
    return null;
  }
}

async function tokenRequest(body) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.error || `Spotify token request failed (${response.status}).`);
  return data;
}

export async function finishSpotifyLogin() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code) return readToken();
  if (!returnedState || returnedState !== sessionStorage.getItem(STATE_KEY)) throw new Error('Spotify login state did not match. Please connect again.');
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('Spotify login verifier expired. Please connect again.');
  const data = await tokenRequest({
    client_id: spotifyClientId(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: spotifyRedirectUri(),
    code_verifier: verifier
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return saveToken(data);
}

export async function spotifyAccessToken() {
  let token = readToken();
  if (!token?.access_token) return '';
  if (Date.now() < Number(token.expires_at || 0)) return token.access_token;
  if (!token.refresh_token) return '';
  const data = await tokenRequest({ client_id: spotifyClientId(), grant_type: 'refresh_token', refresh_token: token.refresh_token });
  token = saveToken({ ...data, refresh_token: data.refresh_token || token.refresh_token });
  return token.access_token;
}

export function disconnectSpotify() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function spotifyApi(path, options = {}) {
  const token = await spotifyAccessToken();
  if (!token) throw new Error('Connect Spotify first.');
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (response.status === 204) return {};
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Spotify request failed (${response.status}).`);
  return data;
}

export function loadSpotifySdk() {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-kisoke-spotify-sdk]');
    const timeout = window.setTimeout(() => reject(new Error('Spotify player SDK did not load.')), 12000);
    window.onSpotifyWebPlaybackSDKReady = () => {
      window.clearTimeout(timeout);
      resolve(window.Spotify);
    };
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.dataset.kisokeSpotifySdk = 'true';
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Spotify player SDK could not be downloaded.'));
    };
    document.body.appendChild(script);
  });
}

