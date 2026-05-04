import * as spotifyService from './spotify.service.js';
import * as uploadService from '../uploads/uploads.service.js';

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
export async function resolve(req, res) {
  const result = await spotifyService.resolveTrack(req.body.url);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

/**
 * GET /spotify/auth/url — generate Spotify OAuth authorization URL.
 * State is a signed JWT containing the userId — no client-side state needed.
 */
export async function authorize(req, res) {
  if (!spotifyService.isSpotifyConfigured()) {
    return res.code(503).send({ error: 'Spotify integration not configured' });
  }
  const state = spotifyService.generateSignedState(req.userId);
  return res.send({ url: spotifyService.getAuthUrl(state) });
}

/**
 * GET /spotify/auth/callback — Spotify redirects here after user authorizes.
 * No auth required — userId is extracted from the signed state.
 * Returns HTML that signals the opener popup and closes itself.
 */
export async function callback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.type('text/html').send(callbackHtml(false, error));
  }

  if (!code || !state) {
    return res.code(400).type('text/html').send(callbackHtml(false, 'Missing code or state'));
  }

  const userId = spotifyService.verifySignedState(state);
  if (!userId) {
    return res.code(400).type('text/html').send(callbackHtml(false, 'Invalid or expired state'));
  }

  const result = await spotifyService.handleCallback(code, userId);
  if (result.error) {
    return res.code(result.status).type('text/html').send(callbackHtml(false, result.error));
  }

  return res.type('text/html').send(callbackHtml(true));
}

/**
 * GET /spotify/token — get a fresh Spotify access token for the Web Playback SDK.
 */
export async function getToken(req, res) {
  const result = await spotifyService.getValidSpotifyToken(req.userId);
  if (typeof result === 'object' && result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send({ accessToken: result });
}

/**
 * POST /spotify/disconnect — disconnect Spotify from user account.
 */
export async function disconnect(req, res) {
  const result = await spotifyService.disconnectSpotify(req.userId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

/**
 * POST /spotify/upload — resolve a Spotify track and create an upload record.
 */
export async function createUpload(req, res) {
  const resolved = await spotifyService.resolveTrack(req.body.url);
  if (resolved.error) {
    return res.code(resolved.status).send({ error: resolved.error });
  }

  const upload = await uploadService.createMedia(req.userId, {
    source: 'spotify',
    spotifyTrackId: resolved.trackId,
    title: resolved.name,
    artist: resolved.artist,
    duration: resolved.duration ? resolved.duration / 1000 : null,
    fileName: '',
  });

  return res.send({ ...upload, trackMeta: resolved });
}

/**
 * GET /spotify/search — search Spotify catalog for tracks.
 */
export async function searchTracks(req, res) {
  const { q, limit, offset } = req.query;
  const result = await spotifyService.search(req.userId, q, limit, offset);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/saved-tracks — get user's saved tracks.
 */
export async function savedTracks(req, res) {
  const { limit, offset } = req.query;
  const result = await spotifyService.getSavedTracks(req.userId, limit, offset);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/recently-played — get recently played tracks.
 */
export async function recentlyPlayed(req, res) {
  const { limit } = req.query;
  const result = await spotifyService.getRecentlyPlayed(req.userId, limit);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/top-tracks — get user's top tracks.
 */
export async function topTracks(req, res) {
  const { time_range, limit, offset } = req.query;
  const result = await spotifyService.getTopTracks(req.userId, time_range, limit, offset);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/playlists — get user's playlists.
 */
export async function playlists(req, res) {
  const { limit, offset } = req.query;
  const result = await spotifyService.getMyPlaylists(req.userId, limit, offset);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/playlists/:playlistId/tracks — get tracks from a playlist.
 */
export async function playlistTracks(req, res) {
  const { playlistId } = req.params;
  const { limit, offset } = req.query;
  const result = await spotifyService.getPlaylistTracks(req.userId, playlistId, limit, offset);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * POST /spotify/playlists — create a new playlist.
 */
export async function createPlaylist(req, res) {
  const { name, description, public: isPublic } = req.body;
  const result = await spotifyService.createPlaylist(req.userId, name, description, isPublic);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * POST /spotify/playlists/:playlistId/tracks — add tracks to a playlist.
 */
export async function addToPlaylist(req, res) {
  const { playlistId } = req.params;
  const { uris } = req.body;
  const result = await spotifyService.addToPlaylist(req.userId, playlistId, uris);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * PUT /spotify/library — save items to Spotify library.
 */
export async function saveToLibrary(req, res) {
  const { uris } = req.body;
  const result = await spotifyService.saveToLibrary(req.userId, uris);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * DELETE /spotify/library — remove items from Spotify library.
 */
export async function removeFromLibrary(req, res) {
  const { uris } = req.body;
  const result = await spotifyService.removeFromLibrary(req.userId, uris);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/library/contains — check if items are saved in library.
 */
export async function checkLibrary(req, res) {
  const { uris } = req.query;
  const uriList = uris ? uris.split(',') : [];
  const result = await spotifyService.checkLibrary(req.userId, uriList);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/devices — get available playback devices.
 */
export async function devices(req, res) {
  const result = await spotifyService.getDevices(req.userId);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * PUT /spotify/player/transfer — transfer playback to a device.
 */
export async function transferPlayback(req, res) {
  const { deviceId, play } = req.body;
  const result = await spotifyService.transferPlayback(req.userId, deviceId, play);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/player — get current playback state.
 */
export async function playbackState(req, res) {
  const result = await spotifyService.getPlaybackState(req.userId);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/player/currently-playing — get currently playing track.
 */
export async function currentlyPlaying(req, res) {
  const result = await spotifyService.getCurrentlyPlaying(req.userId);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * POST /spotify/player/queue — add item to queue.
 */
export async function addToQueue(req, res) {
  const { uri, deviceId } = req.body;
  const result = await spotifyService.addToQueue(req.userId, uri, deviceId);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

/**
 * GET /spotify/player/queue — get current queue.
 */
export async function getQueue(req, res) {
  const result = await spotifyService.getQueue(req.userId);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}
