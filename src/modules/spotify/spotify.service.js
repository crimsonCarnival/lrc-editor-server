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

async function spotifyFetch(userId, path, options = {}) {
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

function normalizeTrack(track) {
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

// ——— Search ———

/**
 * Search Spotify catalog for tracks.
 * @param {string} userId
 * @param {string} query
 * @param {number} [limit=5]
 * @param {number} [offset=0]
 * @returns {object}
 */
export async function search(userId, query, limit = 5, offset = 0) {
  if (!query?.trim()) return { error: 'Search query is required', status: 400 };

  // API change: limit max reduced from 50 to 10, default from 20 to 5
  const clampedLimit = Math.min(Math.max(1, limit), 10);
  const params = new URLSearchParams({
    q: query.trim(),
    type: 'track',
    limit: String(clampedLimit),
    offset: String(Math.max(0, offset)),
  });

  const data = await spotifyFetch(userId, `/search?${params}`);
  if (data.error) return data;

  return {
    tracks: (data.tracks?.items || []).map(normalizeTrack),
    total: data.tracks?.total || 0,
    offset: data.tracks?.offset || 0,
    limit: data.tracks?.limit || clampedLimit,
  };
}

// ——— Saved Tracks (Library) ———

/**
 * Get user's saved tracks from Spotify library.
 * @param {string} userId
 * @param {number} [limit=20]
 * @param {number} [offset=0]
 * @returns {object}
 */
export async function getSavedTracks(userId, limit = 20, offset = 0) {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(1, limit), 50)),
    offset: String(Math.max(0, offset)),
  });

  const data = await spotifyFetch(userId, `/me/tracks?${params}`);
  if (data.error) return data;

  return {
    tracks: (data.items || []).map((item) => ({
      ...normalizeTrack(item.track),
      savedAt: item.added_at,
    })),
    total: data.total || 0,
    offset: data.offset || 0,
    limit: data.limit || limit,
  };
}

// ——— Recently Played ———

/**
 * Get user's recently played tracks.
 * @param {string} userId
 * @param {number} [limit=20]
 * @returns {object}
 */
export async function getRecentlyPlayed(userId, limit = 20) {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(1, limit), 50)),
  });

  const data = await spotifyFetch(userId, `/me/player/recently-played?${params}`);
  if (data.error) return data;

  return {
    tracks: (data.items || []).map((item) => ({
      ...normalizeTrack(item.track),
      playedAt: item.played_at,
    })),
  };
}

// ——— Top Tracks ———

/**
 * Get user's top tracks.
 * @param {string} userId
 * @param {string} [timeRange='medium_term'] - short_term | medium_term | long_term
 * @param {number} [limit=20]
 * @param {number} [offset=0]
 * @returns {object}
 */
export async function getTopTracks(userId, timeRange = 'medium_term', limit = 20, offset = 0) {
  const validRanges = ['short_term', 'medium_term', 'long_term'];
  const range = validRanges.includes(timeRange) ? timeRange : 'medium_term';

  const params = new URLSearchParams({
    time_range: range,
    limit: String(Math.min(Math.max(1, limit), 50)),
    offset: String(Math.max(0, offset)),
  });

  const data = await spotifyFetch(userId, `/me/top/tracks?${params}`);
  if (data.error) return data;

  return {
    tracks: (data.items || []).map(normalizeTrack),
    total: data.total || 0,
    offset: data.offset || 0,
    limit: data.limit || limit,
  };
}

// ——— Playlists ———

/**
 * Get current user's playlists.
 * @param {string} userId
 * @param {number} [limit=20]
 * @param {number} [offset=0]
 * @returns {object}
 */
export async function getMyPlaylists(userId, limit = 20, offset = 0) {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(1, limit), 50)),
    offset: String(Math.max(0, offset)),
  });

  const data = await spotifyFetch(userId, `/me/playlists?${params}`);
  if (data.error) return data;

  return {
    playlists: (data.items || []).map((p) => ({
      id: p.id,
      name: stripHtml(p.name || ''),
      description: stripHtml(p.description || ''),
      imageUrl: p.images?.[0]?.url || null,
      trackCount: p.items?.total ?? p.tracks?.total ?? 0,
      owner: stripHtml(p.owner?.display_name || ''),
      uri: p.uri,
    })),
    total: data.total || 0,
    offset: data.offset || 0,
    limit: data.limit || limit,
  };
}

/**
 * Get tracks from a playlist.
 * Uses /playlists/{id}/items (new endpoint replacing /tracks).
 * @param {string} userId
 * @param {string} playlistId
 * @param {number} [limit=20]
 * @param {number} [offset=0]
 * @returns {object}
 */
export async function getPlaylistTracks(userId, playlistId, limit = 20, offset = 0) {
  if (!playlistId) return { error: 'Playlist ID is required', status: 400 };

  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(1, limit), 50)),
    offset: String(Math.max(0, offset)),
  });

  const data = await spotifyFetch(userId, `/playlists/${encodeURIComponent(playlistId)}/items?${params}`);
  if (data.error) return data;

  return {
    tracks: (data.items || [])
      .filter((item) => item.item?.type === 'track' || item.track?.type === 'track')
      .map((item) => ({
        ...normalizeTrack(item.item || item.track),
        addedAt: item.added_at,
      })),
    total: data.total || 0,
    offset: data.offset || 0,
    limit: data.limit || limit,
  };
}

/**
 * Create a new playlist for the current user.
 * Uses POST /me/playlists (new endpoint replacing /users/{id}/playlists).
 * @param {string} userId
 * @param {string} name
 * @param {string} [description='']
 * @param {boolean} [isPublic=false]
 * @returns {object}
 */
export async function createPlaylist(userId, name, description = '', isPublic = false) {
  if (!name?.trim()) return { error: 'Playlist name is required', status: 400 };

  const data = await spotifyFetch(userId, '/me/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name: name.trim().slice(0, 200),
      description: (description || '').trim().slice(0, 300),
      public: isPublic,
    }),
  });
  if (data.error) return data;

  return {
    id: data.id,
    name: data.name,
    uri: data.uri,
  };
}

/**
 * Add tracks to a playlist.
 * Uses POST /playlists/{id}/items (new endpoint replacing /tracks).
 * @param {string} userId
 * @param {string} playlistId
 * @param {string[]} uris - Spotify track URIs
 * @returns {object}
 */
export async function addToPlaylist(userId, playlistId, uris) {
  if (!playlistId) return { error: 'Playlist ID is required', status: 400 };
  if (!uris?.length) return { error: 'At least one URI is required', status: 400 };

  // Max 100 items per request
  const batch = uris.slice(0, 100);
  const data = await spotifyFetch(userId, `/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: 'POST',
    body: JSON.stringify({ uris: batch }),
  });

  return data;
}

// ——— Library Save / Remove (new consolidated endpoints) ———

/**
 * Save items to user's Spotify library.
 * Uses PUT /me/library (new consolidated endpoint).
 * @param {string} userId
 * @param {string[]} uris - Spotify URIs
 * @returns {object}
 */
export async function saveToLibrary(userId, uris) {
  if (!uris?.length) return { error: 'At least one URI is required', status: 400 };

  const params = new URLSearchParams({ uris: uris.slice(0, 40).join(',') });
  return spotifyFetch(userId, `/me/library?${params}`, { method: 'PUT' });
}

/**
 * Remove items from user's Spotify library.
 * Uses DELETE /me/library (new consolidated endpoint).
 * @param {string} userId
 * @param {string[]} uris - Spotify URIs
 * @returns {object}
 */
export async function removeFromLibrary(userId, uris) {
  if (!uris?.length) return { error: 'At least one URI is required', status: 400 };

  const params = new URLSearchParams({ uris: uris.slice(0, 40).join(',') });
  return spotifyFetch(userId, `/me/library?${params}`, { method: 'DELETE' });
}

/**
 * Check if items are saved in user's library.
 * Uses GET /me/library/contains (new consolidated endpoint).
 * @param {string} userId
 * @param {string[]} uris - Spotify URIs
 * @returns {object}
 */
export async function checkLibrary(userId, uris) {
  if (!uris?.length) return { error: 'At least one URI is required', status: 400 };

  const params = new URLSearchParams({ uris: uris.slice(0, 40).join(',') });
  const data = await spotifyFetch(userId, `/me/library/contains?${params}`);
  if (data.error) return data;

  // API returns an array of booleans
  const results = {};
  uris.slice(0, 40).forEach((uri, i) => {
    results[uri] = Array.isArray(data) ? !!data[i] : false;
  });
  return { results };
}

// ——— Player / Devices ———

/**
 * Get user's available playback devices.
 * @param {string} userId
 * @returns {object}
 */
export async function getDevices(userId) {
  const data = await spotifyFetch(userId, '/me/player/devices');
  if (data.error) return data;

  return {
    devices: (data.devices || []).map((d) => ({
      id: d.id,
      name: stripHtml(d.name || ''),
      type: d.type,
      isActive: d.is_active,
      volumePercent: d.volume_percent,
    })),
  };
}

/**
 * Transfer playback to a specific device.
 * @param {string} userId
 * @param {string} deviceId
 * @param {boolean} [play=false]
 * @returns {object}
 */
export async function transferPlayback(userId, deviceId, play = false) {
  if (!deviceId) return { error: 'Device ID is required', status: 400 };

  return spotifyFetch(userId, '/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

/**
 * Get the current playback state.
 * @param {string} userId
 * @returns {object}
 */
export async function getPlaybackState(userId) {
  const data = await spotifyFetch(userId, '/me/player');
  if (data.error) return data;
  if (data.ok) return { playing: false, device: null, track: null };

  return {
    playing: !data.is_playing ? false : true,
    device: data.device ? {
      id: data.device.id,
      name: stripHtml(data.device.name || ''),
      type: data.device.type,
      volumePercent: data.device.volume_percent,
    } : null,
    track: data.item ? normalizeTrack(data.item) : null,
    progressMs: data.progress_ms || 0,
  };
}

/**
 * Get currently playing track.
 * @param {string} userId
 * @returns {object}
 */
export async function getCurrentlyPlaying(userId) {
  const data = await spotifyFetch(userId, '/me/player/currently-playing');
  if (data.error) return data;
  if (data.ok) return { track: null };

  return {
    track: data.item ? normalizeTrack(data.item) : null,
    isPlaying: data.is_playing || false,
    progressMs: data.progress_ms || 0,
  };
}

/**
 * Add item to playback queue.
 * @param {string} userId
 * @param {string} uri - Spotify URI
 * @param {string} [deviceId]
 * @returns {object}
 */
export async function addToQueue(userId, uri, deviceId) {
  if (!uri) return { error: 'URI is required', status: 400 };

  const params = new URLSearchParams({ uri });
  if (deviceId) params.set('device_id', deviceId);

  return spotifyFetch(userId, `/me/player/queue?${params}`, { method: 'POST' });
}

/**
 * Get the user's current playback queue.
 * @param {string} userId
 * @returns {object}
 */
export async function getQueue(userId) {
  const data = await spotifyFetch(userId, '/me/player/queue');
  if (data.error) return data;

  return {
    currentlyPlaying: data.currently_playing ? normalizeTrack(data.currently_playing) : null,
    queue: (data.queue || []).map(normalizeTrack),
  };
}
