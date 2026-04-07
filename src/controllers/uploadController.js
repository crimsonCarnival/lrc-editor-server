import * as uploadService from '../services/uploadService.js';

/**
 * POST /uploads/signature — generate signed Cloudinary upload params.
 */
export async function audioSignature(request, reply) {
  const result = uploadService.generateAudioSignature(request.body);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * POST /uploads/avatar-signature — generate signed avatar upload params.
 */
export async function avatarSignature(request, reply) {
  const result = uploadService.generateAvatarSignature();
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * POST /uploads/cover-signature — generate signed cover upload params.
 */
export async function coverSignature(request, reply) {
  const result = uploadService.generateCoverSignature();
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * GET /uploads/media — list user's uploaded media.
 */
export async function listMedia(request, reply) {
  const uploads = await uploadService.listMedia(request.userId);
  return reply.send({ uploads });
}

/**
 * POST /uploads/media — record a media upload.
 */
export async function createMedia(request, reply) {
  const upload = await uploadService.createMedia(request.userId, request.body);
  return reply.code(201).send({ upload });
}

/**
 * DELETE /uploads/media/:id — delete a media upload.
 */
export async function deleteMedia(request, reply) {
  const result = await uploadService.deleteMedia(request.params.id, request.userId, request.log);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.code(204).send();
}
