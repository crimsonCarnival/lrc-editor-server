import * as spotifyController from '../controllers/spotifyController.js';

const resolveSchema = {
  body: {
    type: 'object',
    properties: {
      url: { type: 'string', minLength: 1, maxLength: 500 },
    },
    required: ['url'],
  },
};

export default async function spotifyRoutes(fastify) {
  fastify.post(
    '/resolve',
    {
      schema: resolveSchema,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    spotifyController.resolve
  );
}
