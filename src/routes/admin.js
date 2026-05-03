import * as adminController from '../controllers/adminController.js';

export default async function adminRoutes(fastify) {
  // All admin routes require admin privileges
  fastify.addHook('onRequest', fastify.requireAdmin);

  fastify.get('/users', adminController.getUsers);
  fastify.post('/users/:id/ban', adminController.banUser);
  fastify.post('/users/:id/unban', adminController.unbanUser);
  fastify.post('/users/:id/reject-appeal', adminController.rejectAppeal);
  fastify.post('/users/:id/role', adminController.changeRole);
  fastify.delete('/users/:id', adminController.deleteUser);
  fastify.post('/users/:id/reactivate', adminController.reactivateUser);
  
  fastify.get('/stats', adminController.getStats);
  fastify.get('/banned-ips', adminController.getBannedIps);
  fastify.post('/banned-ips', adminController.blockIp);
  fastify.delete('/banned-ips/:id', adminController.unblockIp);
  fastify.get('/audit-logs', adminController.getAuditLogs);
  fastify.get('/logs', adminController.getLogs);
}
