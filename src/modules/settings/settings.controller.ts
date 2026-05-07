import type { FastifyRequest, FastifyReply } from 'fastify';
import * as settingsService from './settings.service.js';

export async function get(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const settings = await settingsService.getSettings(req.userId!);
  return reply.send(settings);
}

export async function replace(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const settings = await settingsService.replaceSettings(req.userId!, req.body as Record<string, unknown>);
  return reply.send(settings);
}

export async function patch(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const settings = await settingsService.patchSettings(req.userId!, req.body as Record<string, unknown>);
  return reply.send(settings);
}

export async function reset(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await settingsService.resetSettings(req.userId!);
  return reply.code(204).send();
}