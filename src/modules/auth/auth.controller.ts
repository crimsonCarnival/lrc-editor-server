import type { FastifyRequest, FastifyReply } from 'fastify';
import * as authService from './auth.service.js';

const VALID_DEVICE_PREFIXES = ['dv_fp_', 'dv_fallback_'];

function extractDeviceId(req: FastifyRequest, reply: FastifyReply): string | null {
  const deviceId = req.headers['x-device-id'];
  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    reply.code(400).send({ error: 'Missing required header: x-device-id' });
    return null;
  }
  const trimmed = deviceId.trim().slice(0, 256);
  if (!VALID_DEVICE_PREFIXES.some(p => trimmed.startsWith(p))) {
    reply.code(400).send({ error: 'Invalid device identifier format.' });
    return null;
  }
  return trimmed;
}

export async function register(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const deviceId = extractDeviceId(req, reply);
  if (!deviceId) return;
  const result = await authService.register(req.body as { username?: string; email?: string; password: string }, (req.server as any).jwt, req.ip, deviceId);
  if (result.error) {
    return reply.code(result.status || 500).send({ error: result.error, code: result.code });
  }
  return reply.code(201).send(result);
}

export async function login(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const deviceId = extractDeviceId(req, reply);
  if (!deviceId) return;
  const result = await authService.login(req.body as { identifier: string; password: string }, (req.server as any).jwt, req.ip, deviceId);
  if (result.error) {
    return reply.code(result.status || 500).send({ error: result.error, code: result.code });
  }
  return reply.send(result);
}

export async function checkIdentifier(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const deviceId = extractDeviceId(req, reply);
  if (!deviceId) return;
  const result = await authService.checkIdentifier((req.body as Record<string, string>).identifier, req.ip, deviceId);
  if (result.error) {
    return reply.code(result.status || 500).send({ error: result.error, code: result.code });
  }
  return reply.send(result);
}

export async function refresh(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const deviceId = extractDeviceId(req, reply);
  if (!deviceId) return;
  const result = await authService.refresh((req.body as Record<string, string>).refreshToken, (req.server as any).jwt, req.ip, deviceId);
  if (result.error) {
    return reply.code(result.status || 500).send({ error: result.error, code: result.code });
  }
  return reply.send(result);
}

export async function me(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const deviceId = req.headers['x-device-id'];
  const result = await authService.getProfile(req.userId!, req.ip, deviceId as string | undefined);
  if (result.error) {
    return reply.code(result.status || 500).send({ error: result.error, code: result.code });
  }
  return reply.send(result);
}

export async function updateProfile(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const result = await authService.updateProfile(req.userId!, req.body, req.log);
  if (result.error) {
    return reply.code(result.status || 500).send({ error: result.error, code: result.code });
  }
  return reply.send(result);
}

export async function submitAppeal(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const result = await authService.submitAppeal(req.userId!, (req.body as Record<string, string>).appealText);
  if (result.error) {
    return reply.code(result.status || 500).send({ error: result.error, code: result.code });
  }
  return reply.send(result);
}

export async function clearUnbanMessage(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const result = await authService.clearUnbanMessage(req.userId!);
  if (result.error) {
    return reply.code(result.status || 500).send({ error: result.error, code: result.code });
  }
  return reply.send(result);
}