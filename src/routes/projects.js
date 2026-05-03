import * as projectController from '../controllers/projectController.js';
import {
  stateSchema,
  lyricsSchema,
  projectIdParam,
} from '../schemas/validation.js';

// --- Validation schemas ---

const metadataSchemaValidation = {
  type: 'object',
  properties: {
    description: { type: 'string', maxLength: 2000 },
    tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
  },
  additionalProperties: false,
};

const projectBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 500 },
    uploadId: { type: 'string', pattern: '^[a-f0-9]{24}$' }, // MongoDB ObjectId hex string
    lyrics: lyricsSchema,
    state: stateSchema,
    metadata: metadataSchemaValidation,
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
      uploadId: { type: 'string', pattern: '^[a-f0-9]{24}$' },
      lyrics: lyricsSchema,
      state: stateSchema,
      metadata: metadataSchemaValidation,
      readOnly: { type: 'boolean' },
      version: { type: 'integer', minimum: 0 },
    },
    additionalProperties: false,
  },
  params: projectIdParam,
};

export default async function projectRoutes(fastify) {
  fastify.post('/', { schema: createProjectSchema, preHandler: [fastify.requireActiveUser] }, projectController.create);
  fastify.get('/', { preHandler: [fastify.requireActiveUser] }, projectController.list);
  fastify.get('/:id', { schema: { params: projectIdParam }, preHandler: [fastify.optionalAuth] }, projectController.get);
  fastify.put('/:id', { schema: updateProjectSchema, preHandler: [fastify.requireActiveUser] }, projectController.update);
  fastify.patch('/:id', { schema: patchProjectSchema, preHandler: [fastify.requireActiveUser] }, projectController.patch);
  fastify.delete('/:id', { schema: { params: projectIdParam }, preHandler: [fastify.requireActiveUser] }, projectController.remove);
  // Public share view - no auth required
  fastify.get('/share/:id', { schema: { params: projectIdParam } }, projectController.getShare);
  // Clone project - requires auth
  fastify.post('/clone/:id', { schema: { params: projectIdParam }, preHandler: [fastify.requireActiveUser] }, projectController.clone);
}
