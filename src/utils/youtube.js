/**
 * YouTube utilities for fetching video information.
 */
import { LRUCache } from '@crimson-carnival/ds-js';

// Cache for YouTube metadata resolution (Capacity: 100 items)
const ytCache = new LRUCache(100);

/**
 * Extract YouTube video ID from various URL formats.
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null if invalid
 */
export function extractYouTubeVideoId(url) {
  if (!url) return null;

  // Handle different YouTube URL formats
  const patterns = [
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|watch\?.+&v=)|youtu\.be\/)([^&?/\s]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  // Check if it's just the video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  return null;
}

/**
 * Fetch YouTube video title and duration using the YouTube Data API v3.
 * Requires YOUTUBE_API_KEY environment variable.
 * @param {string} url - YouTube URL or video ID
 * @returns {Promise<string|null>} Video title or null if not found/error
 */
export async function fetchYouTubeTitle(url) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not configured, cannot fetch video titles');
    return null;
  }

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    console.warn('Invalid YouTube URL:', url);
    return null;
  }

  // Check cache first
  const cached = ytCache.get(videoId);
  if (cached && cached.title) return cached.title;

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('YouTube API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const title = data.items[0].snippet.title;
      // Pre-warm cache for the title
      ytCache.put(videoId, { title, duration: null });
      return title;
    }

    console.warn('No video found for ID:', videoId);
    return null;
  } catch (error) {
    console.error('Error fetching YouTube title:', error.message);
    return null;
  }
}

/**
 * Fetch YouTube video metadata (title + duration) using the YouTube Data API v3.
 * @param {string} url - YouTube URL or video ID
 * @returns {Promise<{ title: string, duration: number }|null>} Metadata or null
 */
export async function fetchYouTubeMetadata(url) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  // Check cache first
  const cached = ytCache.get(videoId);
  if (cached && cached.duration !== null) return cached;

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items?.length) return null;

    const item = data.items[0];
    const title = item.snippet.title;
    const duration = parseISO8601Duration(item.contentDetails.duration);
    
    const result = { title, duration };
    ytCache.put(videoId, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Parse ISO 8601 duration (e.g. "PT4M13S") to seconds.
 * @param {string} iso - ISO 8601 duration string
 * @returns {number|null}
 */
function parseISO8601Duration(iso) {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}
