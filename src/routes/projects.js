import * as projectController from '../controllers/projectController.js';
import {
  audioSchema,
  stateSchema,
  lyricsSchema,
  projectIdParam,
} from '../schemas/validation.js';

// --- Validation schemas ---

const projectBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 500 },
    audio: audioSchema,
    lyrics: lyricsSchema,
    state: stateSchema,
    readOnly: { type: 'boolean' },
  },
  additionalProperties: false,
};

const createProjectSchema = {
  body: projectBodySchema,
};

const updateProjectSchema = {
  body: projectBodySchema,
  params: projectIdParam,
};

const patchProjectSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 500 },
      audio: audioSchema,
      lyrics: lyricsSchema,
      state: stateSchema,
      readOnly: { type: 'boolean' },
      version: { type: 'integer', minimum: 0 },
    },
    additionalProperties: false,
  },
  params: projectIdParam,
};

export default async function projectRoutes(fastify) {
  fastify.post('/', { schema: createProjectSchema, preHandler: [fastify.optionalAuth] }, projectController.create);
  fastify.get('/', { preHandler: [fastify.requireAuth] }, projectController.list);
  fastify.get('/:id', { schema: { params: projectIdParam }, preHandler: [fastify.optionalAuth] }, projectController.get);
  fastify.put('/:id', { schema: updateProjectSchema, preHandler: [fastify.optionalAuth] }, projectController.update);
  fastify.patch('/:id', { schema: patchProjectSchema, preHandler: [fastify.optionalAuth] }, projectController.patch);
  fastify.delete('/:id', { schema: { params: projectIdParam }, preHandler: [fastify.requireAuth] }, projectController.remove);
}
