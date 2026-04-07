import { stripHtml } from '../utils/sanitize.js';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const TRACK_URL_RE = /(?:spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]{22})/;

// In-memory token cache (single instance)
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Check if Spotify integration is configured.
 */
export function isSpotifyConfigured() {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

/**
 * Obtain a Spotify Client Credentials token (cached).
 */
async function getClientToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
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

/**
 * Resolve a Spotify track URL into metadata.
 * @param {string} url - Spotify track URL or URI
 * @returns {object|{ error: string, status: number }}
 */
export async function resolveTrack(url) {
  if (!isSpotifyConfigured()) {
    return { error: 'Spotify integration not configured', status: 503 };
  }

  const match = url.match(TRACK_URL_RE);
  if (!match) {
    return { error: 'Invalid Spotify track URL', status: 400 };
  }
  const trackId = match[1];

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

  return {
    trackId: track.id,
    name: stripHtml(track.name || ''),
    artist: stripHtml(track.artists?.map((a) => a.name).join(', ') || ''),
    album: stripHtml(track.album?.name || ''),
    duration: track.duration_ms,
    previewUrl: track.preview_url || null,
    albumArt: track.album?.images?.[0]?.url || null,
  };
}
