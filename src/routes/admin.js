import * as adminController from '../controllers/adminController.js';

export default async function adminRoutes(fastify) {
  // All admin routes require admin privileges
  fastify.addHook('onRequest', fastify.requireAdmin);

  fastify.get('/users', adminController.getUsers);
  fastify.post('/users/:id/ban', adminController.banUser);
  fastify.post('/users/:id/unban', adminController.unbanUser);
  fastify.post('/users/:id/role', adminController.changeRole);
  fastify.delete('/users/:id', adminController.deleteUser);
  
  fastify.get('/logs', adminController.getLogs);
}
