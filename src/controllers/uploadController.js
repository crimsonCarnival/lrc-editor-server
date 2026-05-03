import * as uploadService from '../services/uploadService.js';

/**
 * POST /uploads/signature — generate signed Cloudinary upload params.
 */
export async function audioSignature(req, res) {
  const result = uploadService.generateAudioSignature(req.body);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

/**
 * POST /uploads/avatar-signature — generate signed avatar upload params.
 */
export async function avatarSignature(_, res) {
  const result = uploadService.generateAvatarSignature();
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}



/**
 * GET /uploads/media — list user's uploaded media with pagination.
 * Query params: limit (default 50, max 100), offset (default 0)
 */
export async function listMedia(req, res) {
  const { limit, offset } = req.query;
  const result = await uploadService.listMedia(req.userId, { limit, offset });
  return res.send(result);
}

/**
 * POST /uploads/media — record a media upload.
 */
export async function createMedia(req, res) {
  const upload = await uploadService.createMedia(req.userId, req.body);
  return res.code(201).send({ upload });
}

/**
 * DELETE /uploads/media/:id — delete a media upload.
 */
export async function deleteMedia(req, res) {
  const result = await uploadService.deleteMedia(req.params.id, req.userId, req.log);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.code(204).send();
}

/**
 * PATCH /uploads/media/:id — update a media upload.
 */
export async function updateMedia(req, res) {
  const result = await uploadService.updateMedia(req.params.id, req.userId, req.body);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send({ upload: result });
}

/**
 * GET /uploads/media/:id — fetch a specific media upload.
 */
export async function getMedia(req, res) {
  const result = await uploadService.getMedia(req.params.id, req.userId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

