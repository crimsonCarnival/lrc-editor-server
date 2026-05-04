import { searchYoutube } from './youtube.controller.js';

export default async function youtubeRoutes(fastify) {
    fastify.get('/search', { preHandler: [fastify.requireActiveUser] }, searchYoutube);
}
