import * as spotifyService from '../services/spotifyService.js';

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
