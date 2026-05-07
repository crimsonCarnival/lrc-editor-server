import type { FastifyRequest, FastifyReply } from 'fastify';

export async function searchYoutube(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const query = (request.query as Record<string, string>).q;
    if (!query) {
      return reply.code(400).send({ error: 'Missing search query' });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return reply.code(500).send({ error: 'YouTube API key is not configured' });
    }

    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: '10',
      q: query,
      type: 'video',
      key: apiKey,
    });

    const response = await fetch('https://www.googleapis.com/youtube/v3/search?' + params.toString());

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      request.log.error(errData, 'YouTube API error');
      return reply.code(502).send({ error: 'YouTube API request failed' });
    }

    const data = await response.json().catch(() => ({})) as {
      items?: Array<{
        id: { videoId?: string };
        snippet: {
          title?: string;
          description?: string;
          channelTitle?: string;
          publishedAt?: string;
          thumbnails?: {
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
          };
        };
      }>;
    };
    if (!data.items) {
      request.log.warn({ data }, 'YouTube API returned unexpected format');
    }

    const items = (data.items || [])
      .filter(item => !!item.id?.videoId)
      .map(item => ({
        videoId: item.id.videoId!,
        title: item.snippet?.title || 'Unknown Title',
        description: item.snippet?.description || '',
        thumbnail: item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url || '',
        channelTitle: item.snippet?.channelTitle || 'Unknown Channel',
        publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
      }));

    return reply.send({ results: items });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to search YouTube', details: (error as Error).message });
  }
}