import { spotifyFetch, normalizeTrack } from './spotify.service.js';
import { stripHtml } from '../../utils/sanitize.js';

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
