export async function searchYoutube(request, reply) {
  try {
    const query = request.query.q;
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

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      request.log.error(errData, 'YouTube API error');
      return reply.code(502).send({ error: 'YouTube API request failed' });
    }

    const data = await response.json();

    const items = (data.items || []).map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));

    return { results: items };
  } catch (error) {
    request.log.error(error.message);
    return reply.code(500).send({ error: 'Failed to search YouTube' });
  }
}
