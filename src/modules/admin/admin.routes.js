import * as adminController from './admin.controller.js';
import {
  userIdParam,
  banUserSchema,
  changeRoleSchema,
  blockIpSchema,
  blockDeviceSchema,
  listUsersSchema,
  listLogsSchema,
  idParam,
} from './admin.schema.js';

export default async function adminRoutes(fastify) {
  // All admin routes require admin privileges
  fastify.addHook('onRequest', fastify.requireAdmin);

  // ─── Users ────────────────────────────────────────────────────────
  fastify.get('/users', { schema: { querystring: listUsersSchema.querystring } }, adminController.getUsers);
  fastify.post('/users/:id/ban', { schema: banUserSchema }, adminController.banUser);
  fastify.post('/users/:id/unban', { schema: { params: userIdParam } }, adminController.unbanUser);
  fastify.post('/users/:id/reject-appeal', { schema: { params: userIdParam } }, adminController.rejectAppeal);
  fastify.post('/users/:id/role', { schema: changeRoleSchema }, adminController.changeRole);
  fastify.delete('/users/:id', { schema: { params: userIdParam } }, adminController.deleteUser);
  fastify.post('/users/:id/reactivate', { schema: { params: userIdParam } }, adminController.reactivateUser);

  // ─── Stats & Logs ────────────────────────────────────────────────
  fastify.get('/stats', adminController.getStats);
  fastify.get('/audit-logs', { schema: { querystring: listLogsSchema.querystring } }, adminController.getAuditLogs);

  // ─── IP Bans ─────────────────────────────────────────────────────
  fastify.get('/banned-ips', adminController.getBannedIps);
  fastify.post('/banned-ips', { schema: blockIpSchema }, adminController.blockIp);
  fastify.delete('/banned-ips/:id', { schema: { params: idParam } }, adminController.unblockIp);

  // ─── Device Bans ─────────────────────────────────────────────────
  fastify.get('/banned-devices', adminController.getBannedDevices);
  fastify.post('/banned-devices', { schema: blockDeviceSchema }, adminController.blockDevice);
  fastify.delete('/banned-devices/:id', { schema: { params: idParam } }, adminController.unblockDevice);
}
