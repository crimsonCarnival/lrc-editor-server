import * as spotifyService from '../services/spotifyService.js';
import * as uploadService from '../services/uploadService.js';

function callbackHtml(success, error) {
  const payload = JSON.stringify({ type: 'spotify-callback', success, error: error || null });
  return `<!DOCTYPE html><html><head><title>Spotify</title></head><body>
<script>if(window.opener){window.opener.postMessage(${JSON.stringify(payload).replace(/</g, '\\u003c')},'*')}window.close();</script>
<p>${success ? 'Connected! This window will close.' : `Error: ${error || 'Unknown'}`}</p>
</body></html>`;
}

/**
 * POST /spotify/resolve — resolve a Spotify track URL to metadata.
 */
export async function resolve(request, reply) {
  const result = await spotifyService.resolveTrack(request.body.url);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * GET /spotify/auth/url — generate Spotify OAuth authorization URL.
 * State is a signed JWT containing the userId — no client-side state needed.
 */
export async function authorize(request, reply) {
  if (!spotifyService.isSpotifyConfigured()) {
    return reply.code(503).send({ error: 'Spotify integration not configured' });
  }
  const state = spotifyService.generateSignedState(request.userId);
  return reply.send({ url: spotifyService.getAuthUrl(state) });
}

/**
 * GET /spotify/auth/callback — Spotify redirects here after user authorizes.
 * No auth required — userId is extracted from the signed state.
 * Returns HTML that signals the opener popup and closes itself.
 */
export async function callback(request, reply) {
  const { code, state, error } = request.query;

  if (error) {
    return reply.type('text/html').send(callbackHtml(false, error));
  }

  if (!code || !state) {
    return reply.code(400).type('text/html').send(callbackHtml(false, 'Missing code or state'));
  }

  const userId = spotifyService.verifySignedState(state);
  if (!userId) {
    return reply.code(400).type('text/html').send(callbackHtml(false, 'Invalid or expired state'));
  }

  const result = await spotifyService.handleCallback(code, userId);
  if (result.error) {
    return reply.code(result.status).type('text/html').send(callbackHtml(false, result.error));
  }

  return reply.type('text/html').send(callbackHtml(true));
}

/**
 * GET /spotify/token — get a fresh Spotify access token for the Web Playback SDK.
 */
export async function getToken(request, reply) {
  const result = await spotifyService.getValidSpotifyToken(request.userId);
  if (typeof result === 'object' && result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send({ accessToken: result });
}

/**
 * POST /spotify/disconnect — disconnect Spotify from user account.
 */
export async function disconnect(request, reply) {
  const result = await spotifyService.disconnectSpotify(request.userId);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * POST /spotify/upload — resolve a Spotify track and create an upload record.
 */
export async function createUpload(request, reply) {
  const resolved = await spotifyService.resolveTrack(request.body.url);
  if (resolved.error) {
    return reply.code(resolved.status).send({ error: resolved.error });
  }

  const upload = await uploadService.createMedia(request.userId, {
    source: 'spotify',
    spotifyTrackId: resolved.trackId,
    title: resolved.name,
    artist: resolved.artist,
    thumbnailUrl: resolved.albumArt,
    duration: resolved.duration ? resolved.duration / 1000 : null,
    fileName: '',
  });

  return reply.send({ ...upload, trackMeta: resolved });
}

/**
 * GET /spotify/search — search Spotify catalog for tracks.
 */
export async function searchTracks(request, reply) {
  const { q, limit, offset } = request.query;
  const result = await spotifyService.search(request.userId, q, limit, offset);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/saved-tracks — get user's saved tracks.
 */
export async function savedTracks(request, reply) {
  const { limit, offset } = request.query;
  const result = await spotifyService.getSavedTracks(request.userId, limit, offset);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/recently-played — get recently played tracks.
 */
export async function recentlyPlayed(request, reply) {
  const { limit } = request.query;
  const result = await spotifyService.getRecentlyPlayed(request.userId, limit);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/top-tracks — get user's top tracks.
 */
export async function topTracks(request, reply) {
  const { time_range, limit, offset } = request.query;
  const result = await spotifyService.getTopTracks(request.userId, time_range, limit, offset);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/playlists — get user's playlists.
 */
export async function playlists(request, reply) {
  const { limit, offset } = request.query;
  const result = await spotifyService.getMyPlaylists(request.userId, limit, offset);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/playlists/:playlistId/tracks — get tracks from a playlist.
 */
export async function playlistTracks(request, reply) {
  const { playlistId } = request.params;
  const { limit, offset } = request.query;
  const result = await spotifyService.getPlaylistTracks(request.userId, playlistId, limit, offset);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * POST /spotify/playlists — create a new playlist.
 */
export async function createPlaylist(request, reply) {
  const { name, description, public: isPublic } = request.body;
  const result = await spotifyService.createPlaylist(request.userId, name, description, isPublic);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * POST /spotify/playlists/:playlistId/tracks — add tracks to a playlist.
 */
export async function addToPlaylist(request, reply) {
  const { playlistId } = request.params;
  const { uris } = request.body;
  const result = await spotifyService.addToPlaylist(request.userId, playlistId, uris);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * PUT /spotify/library — save items to Spotify library.
 */
export async function saveToLibrary(request, reply) {
  const { uris } = request.body;
  const result = await spotifyService.saveToLibrary(request.userId, uris);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * DELETE /spotify/library — remove items from Spotify library.
 */
export async function removeFromLibrary(request, reply) {
  const { uris } = request.body;
  const result = await spotifyService.removeFromLibrary(request.userId, uris);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/library/contains — check if items are saved in library.
 */
export async function checkLibrary(request, reply) {
  const { uris } = request.query;
  const uriList = uris ? uris.split(',') : [];
  const result = await spotifyService.checkLibrary(request.userId, uriList);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/devices — get available playback devices.
 */
export async function devices(request, reply) {
  const result = await spotifyService.getDevices(request.userId);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * PUT /spotify/player/transfer — transfer playback to a device.
 */
export async function transferPlayback(request, reply) {
  const { deviceId, play } = request.body;
  const result = await spotifyService.transferPlayback(request.userId, deviceId, play);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/player — get current playback state.
 */
export async function playbackState(request, reply) {
  const result = await spotifyService.getPlaybackState(request.userId);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/player/currently-playing — get currently playing track.
 */
export async function currentlyPlaying(request, reply) {
  const result = await spotifyService.getCurrentlyPlaying(request.userId);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * POST /spotify/player/queue — add item to queue.
 */
export async function addToQueue(request, reply) {
  const { uri, deviceId } = request.body;
  const result = await spotifyService.addToQueue(request.userId, uri, deviceId);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}

/**
 * GET /spotify/player/queue — get current queue.
 */
export async function getQueue(request, reply) {
  const result = await spotifyService.getQueue(request.userId);
  if (result.error) return reply.code(result.status).send({ error: result.error });
  return reply.send(result);
}
