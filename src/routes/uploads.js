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
      fileName: { type: 'string', maxLength: 500 },
      title: { type: 'string', maxLength: 500 },
      duration: { type: ['number', 'null'] },
    },
    required: ['source'],
    additionalProperties: false,
  },
};

export default async function uploadRoutes(fastify) {
  fastify.post('/signature', { schema: signatureSchema, preHandler: [fastify.requireAuth] }, uploadController.audioSignature);
  fastify.post('/avatar-signature', { preHandler: [fastify.requireAuth] }, uploadController.avatarSignature);
  fastify.post('/cover-signature', { preHandler: [fastify.requireAuth] }, uploadController.coverSignature);
  fastify.get('/media', { preHandler: [fastify.requireAuth] }, uploadController.listMedia);
  fastify.post('/media', { schema: createMediaSchema, preHandler: [fastify.requireAuth] }, uploadController.createMedia);
  fastify.delete('/media/:id', { preHandler: [fastify.requireAuth] }, uploadController.deleteMedia);
}
