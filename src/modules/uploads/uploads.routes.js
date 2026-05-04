import * as uploadController from './uploads.controller.js';
import { signatureSchema, createMediaSchema, updateMediaSchema, listMediaSchema } from './uploads.schema.js';

export default async function uploadRoutes(fastify) {
  fastify.post('/signature', { schema: signatureSchema, preHandler: [fastify.requireActiveUser] }, uploadController.audioSignature);
  fastify.post('/avatar-signature', { preHandler: [fastify.requireAuth] }, uploadController.avatarSignature);
  fastify.get('/media', { schema: listMediaSchema, preHandler: [fastify.requireActiveUser] }, uploadController.listMedia);
  fastify.get('/media/:id', { preHandler: [fastify.requireActiveUser] }, uploadController.getMedia);
  fastify.post('/media', { schema: createMediaSchema, preHandler: [fastify.requireActiveUser] }, uploadController.createMedia);
  fastify.patch('/media/:id', { schema: updateMediaSchema, preHandler: [fastify.requireActiveUser] }, uploadController.updateMedia);
  fastify.delete('/media/:id', { preHandler: [fastify.requireActiveUser] }, uploadController.deleteMedia);
}
