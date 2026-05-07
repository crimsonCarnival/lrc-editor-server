import { spotifyFetch, normalizeTrack } from './spotify.service.js';
import { stripHtml } from '../../utils/sanitize.js';

export async function getDevices(userId: string): Promise<Record<string, unknown>> {
  const data = await spotifyFetch(userId, '/me/player/devices');
  if ((data as Record<string, unknown>).error) return data;

  const typed = data as { devices?: Record<string, unknown>[] };
  return {
    devices: (typed.devices || []).map((d: Record<string, unknown>) => ({
      id: d.id,
      name: stripHtml((d.name as string) || ''),
      type: d.type,
      isActive: d.is_active,
      volumePercent: d.volume_percent,
    })),
  };
}

export async function transferPlayback(userId: string, deviceId: string, play = false): Promise<Record<string, unknown>> {
  if (!deviceId) return { error: 'Device ID is required', status: 400 };

  return spotifyFetch(userId, '/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

export async function getPlaybackState(userId: string): Promise<Record<string, unknown>> {
  const data = await spotifyFetch(userId, '/me/player');
  if ((data as Record<string, unknown>).error) return data;
  if ((data as Record<string, unknown>).ok) return { playing: false, device: null, track: null };

  const typed = data as {
    is_playing?: boolean;
    progress_ms?: number;
    item?: unknown;
    device?: {
      id?: string;
      name?: string;
      type?: string;
      volume_percent?: number;
    };
  };
  return {
    playing: !typed.is_playing ? false : true,
    device: typed.device ? {
      id: typed.device.id,
      name: stripHtml(typed.device.name || ''),
      type: typed.device.type,
      volumePercent: typed.device.volume_percent,
    } : null,
    track: typed.item ? normalizeTrack(typed.item as Record<string, unknown>) : null,
    progressMs: typed.progress_ms || 0,
  };
}

export async function getCurrentlyPlaying(userId: string): Promise<Record<string, unknown>> {
  const data = await spotifyFetch(userId, '/me/player/currently-playing');
  if ((data as Record<string, unknown>).error) return data;
  if ((data as Record<string, unknown>).ok) return { track: null };

  return {
    track: (data as Record<string, { item?: unknown }>).item ? normalizeTrack((data as Record<string, { item?: unknown }>).item as Record<string, unknown>) : null,
    isPlaying: (data as Record<string, unknown>).is_playing || false,
    progressMs: (data as Record<string, unknown>).progress_ms || 0,
  };
}

export async function addToQueue(userId: string, uri: string, deviceId?: string): Promise<Record<string, unknown>> {
  if (!uri) return { error: 'URI is required', status: 400 };

  const params = new URLSearchParams({ uri });
  if (deviceId) params.set('device_id', deviceId);

  return spotifyFetch(userId, `/me/player/queue?${params}`, { method: 'POST' });
}

export async function getQueue(userId: string): Promise<Record<string, unknown>> {
  const data = await spotifyFetch(userId, '/me/player/queue');
  if ((data as Record<string, unknown>).error) return data;

  const typed = data as { currently_playing?: unknown; queue?: unknown[] };
  return {
    currentlyPlaying: typed.currently_playing ? normalizeTrack(typed.currently_playing as Record<string, unknown>) : null,
    queue: (typed.queue || []).map((t: unknown) => normalizeTrack(t as Record<string, unknown>)),
  };
}
