import { spotifyFetch, normalizeTrack } from './spotify.service.js';
import { stripHtml } from '../../utils/sanitize.js';

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
