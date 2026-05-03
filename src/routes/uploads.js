import * as uploadController from '../controllers/uploadController.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const signatureSchema = {
  body: {
    type: 'object',
    properties: {
      fileName: { type: 'string', minLength: 1, maxLength: 255 },
      fileSize: { type: 'integer', minimum: 1, maximum: MAX_FILE_SIZE },
    },
    required: ['fileName', 'fileSize'],
  },
};

const createMediaSchema = {
  body: {
    type: 'object',
    properties: {
      source: { type: 'string', enum: ['cloudinary', 'youtube', 'spotify'] },
      cloudinaryUrl: { type: ['string', 'null'], maxLength: 500 },
      publicId: { type: ['string', 'null'], maxLength: 500 },
      youtubeUrl: { type: ['string', 'null'], maxLength: 500 },
      spotifyTrackId: { type: ['string', 'null'], maxLength: 100 },
      artist: { type: ['string', 'null'], maxLength: 500 },
      fileName: { type: 'string', maxLength: 500 },
      title: { type: 'string', maxLength: 500 },
      duration: { type: ['number', 'null'] },
    },
    required: ['source'],
    additionalProperties: false,
  },
};

const updateMediaSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 500 },
      fileName: { type: 'string', maxLength: 500 },
      duration: { type: 'number' },
    },
    additionalProperties: false,
  },
};

const listMediaSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      offset: { type: 'integer', minimum: 0, default: 0 },
    },
  },
};

export default async function uploadRoutes(fastify) {
  fastify.post('/signature', { schema: signatureSchema, preHandler: [fastify.requireActiveUser] }, uploadController.audioSignature);
  fastify.post('/avatar-signature', { preHandler: [fastify.requireAuth] }, uploadController.avatarSignature);
  fastify.get('/media', { schema: listMediaSchema, preHandler: [fastify.requireActiveUser] }, uploadController.listMedia);
  fastify.get('/media/:id', { preHandler: [fastify.requireActiveUser] }, uploadController.getMedia);
  fastify.post('/media', { schema: createMediaSchema, preHandler: [fastify.requireActiveUser] }, uploadController.createMedia);
  fastify.patch('/media/:id', { schema: updateMediaSchema, preHandler: [fastify.requireActiveUser] }, uploadController.updateMedia);
  fastify.delete('/media/:id', { preHandler: [fastify.requireActiveUser] }, uploadController.deleteMedia);
}
