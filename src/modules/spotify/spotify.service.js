import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { stripHtml } from '../../utils/sanitize.js';
import User from '../../db/user.model.js';
import { LRUCache } from '@crimson-carnival/ds-js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const TRACK_URL_RE = /(?:spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]{22})/;

// Cache for Spotify track metadata resolution (Capacity: 100 tracks)
const trackCache = new LRUCache(100);

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-read-currently-playing',
  'user-library-read',
  'user-library-modify',
  'user-top-read',
  'user-follow-read',
  'user-follow-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
];

// In-memory token cache for Client Credentials flow (anonymous resolve)
let cachedToken = null;
let tokenExpiresAt = 0;

// ——— Helpers ———

function getClientId() { return process.env.SPOTIFY_CLIENT_ID; }
function getClientSecret() { return process.env.SPOTIFY_CLIENT_SECRET; }
function getRedirectUri() { return process.env.SPOTIFY_REDIRECT_URI; }
function basicAuth() {
  return `Basic ${Buffer.from(`${getClientId()}:${getClientSecret()}`).toString('base64')}`;
}

/**
 * Check if Spotify integration is configured.
 */
export function isSpotifyConfigured() {
  return !!(getClientId() && getClientSecret());
}

// ——— Client Credentials (anonymous) ———

/**
 * Obtain a Spotify Client Credentials token (cached).
 */
async function getClientToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(),
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// ——— OAuth Authorization Code Flow ———

/**
 * Generate a signed state token containing the userId.
 * Verified server-side on the callback — no client-side state needed.
 * @param {string} userId
 * @returns {string}
 */
export function generateSignedState(userId) {
  return jwt.sign(
    { sub: userId, nonce: crypto.randomBytes(8).toString('hex') },
    JWT_SECRET,
    { expiresIn: '5m' },
  );
}

/**
 * Verify a signed state token and extract the userId.
 * @param {string} state
 * @returns {string|null} userId or null if invalid/expired
 */
export function verifySignedState(state) {
  try {
    const decoded = jwt.verify(state, JWT_SECRET);
    return decoded.sub;
  } catch {
    return null;
  }
}

/**
 * Build the Spotify authorization URL.
 * @param {string} state - Signed state token
 * @returns {string}
 */
export function getAuthUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    scope: SCOPES.join(' '),
    redirect_uri: getRedirectUri(),
    state,
  });
  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens, fetch profile, and persist to user.
 * @param {string} code - Authorization code from Spotify callback
 * @param {string} userId - Internal user ID
 * @returns {object|{ error: string, status: number }}
 */
export async function handleCallback(code, userId) {
  // Exchange code for tokens
  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }).toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => ({}));
    return { error: body.error_description || 'Token exchange failed', status: 400 };
  }

  const tokens = await tokenRes.json();

  // Fetch user profile
  const profileRes = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) {
    return { error: 'Failed to fetch Spotify profile', status: 502 };
  }

  const profile = await profileRes.json();

  // Extract profile picture URL (use the first image if available)
  const profilePictureUrl = profile.images && profile.images.length > 0
    ? profile.images[0].url
    : null;

  // Persist to user document
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  user.spotify = {
    spotifyId: profile.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    // product field removed from Spotify API — assume premium if streaming scope granted
    isPremium: true,
    profilePictureUrl,
  };
  await user.save();

  return {
    connected: true,
    spotifyId: profile.id,
    isPremium: true,
  };
}

/**
 * Get a valid Spotify access token for a user, refreshing if needed.
 * @param {string} userId
 * @returns {string|{ error: string, status: number }}
 */
export async function getValidSpotifyToken(userId) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  if (!user.spotify?.refreshToken) return { error: 'Spotify not connected', status: 400 };

  // If token is still valid (with 60s buffer), return it
  if (user.spotify.accessToken && user.spotify.expiresAt && new Date(user.spotify.expiresAt) > new Date(Date.now() + 60_000)) {
    return user.spotify.accessToken;
  }

  // Refresh the token
  const refreshRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.spotify.refreshToken,
    }).toString(),
  });

  if (!refreshRes.ok) {
    // Refresh failed — clear tokens so user can re-connect
    user.spotify.accessToken = null;
    user.spotify.expiresAt = null;
    await user.save();
    return { error: 'Spotify token refresh failed — please reconnect', status: 401 };
  }

  const data = await refreshRes.json();

  user.spotify.accessToken = data.access_token;
  user.spotify.expiresAt = new Date(Date.now() + data.expires_in * 1000);
  // Spotify may rotate the refresh token
  if (data.refresh_token) {
    user.spotify.refreshToken = data.refresh_token;
  }
  await user.save();

  return data.access_token;
}

/**
 * Disconnect Spotify from a user account.
 * @param {string} userId
 * @returns {object|{ error: string, status: number }}
 */
export async function disconnectSpotify(userId) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  // Delete all Spotify uploads for this user
  const Upload = (await import('../uploads/upload.model.js')).default;
  await Upload.deleteMany({ userId, source: 'spotify' });

  user.spotify = {
    spotifyId: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    isPremium: false,
    profilePictureUrl: null,
  };
  await user.save();

  return { disconnected: true };
}

// ——— Track resolution (uses Client Credentials — no user auth needed) ———

/**
 * Extract a Spotify track ID from a URL or URI.
 * @param {string} url
 * @returns {string|null}
 */
export function extractTrackId(url) {
  const match = url?.match(TRACK_URL_RE);
  return match ? match[1] : null;
}

/**
 * Resolve a Spotify track URL into metadata.
 * @param {string} url - Spotify track URL or URI
 * @returns {object|{ error: string, status: number }}
 */
export async function resolveTrack(url) {
  if (!isSpotifyConfigured()) {
    return { error: 'Spotify integration not configured', status: 503 };
  }

  const trackId = extractTrackId(url);
  if (!trackId) {
    return { error: 'Invalid Spotify track URL', status: 400 };
  }

  // Check cache first
  const cached = trackCache.get(trackId);
  if (cached) return cached;

  const token = await getClientToken();
  const response = await fetch(`${SPOTIFY_API_BASE}/tracks/${encodeURIComponent(trackId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { error: 'Track not found on Spotify', status: 404 };
    }
    return { error: 'Spotify API request failed', status: 502 };
  }

  const track = await response.json();

  const result = {
    trackId: track.id,
    name: stripHtml(track.name || ''),
    artist: stripHtml(track.artists?.map((a) => a.name).join(', ') || ''),
    album: stripHtml(track.album?.name || ''),
    duration: track.duration_ms,
    previewUrl: track.preview_url || null,
    albumArt: track.album?.images?.[0]?.url || null,
  };

  // Store in cache
  trackCache.put(trackId, result);

  return result;
}

// ——— Helper: authenticated Spotify API request ———

export async function spotifyFetch(userId, path, options = {}) {
  const token = await getValidSpotifyToken(userId);
  if (typeof token === 'object' && token.error) return token;

  const url = path.startsWith('http') ? path : `${SPOTIFY_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return { ok: true };
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Detect scope/permission issues and hint at reconnect
    if (res.status === 403 || (res.status === 401 && body.error?.message?.toLowerCase().includes('scope'))) {
      return { error: 'spotify_scope_error', message: body.error?.message || 'Insufficient Spotify permissions. Please disconnect and reconnect Spotify to grant the required scopes.', status: 403 };
    }
    return { error: body.error?.message || `Spotify API error: ${res.status}`, status: res.status };
  }

  return res.json();
}

// ——— Normalize track/item shapes ———

export function normalizeTrack(track) {
  if (!track) return null;
  return {
    trackId: track.id,
    name: stripHtml(track.name || ''),
    artist: stripHtml(track.artists?.map((a) => a.name).join(', ') || ''),
    album: stripHtml(track.album?.name || ''),
    duration: track.duration_ms,
    albumArt: track.album?.images?.[0]?.url || null,
    uri: track.uri,
  };
}
