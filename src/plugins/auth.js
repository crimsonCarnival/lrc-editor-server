import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';

function signAccess(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
}

function signRefresh(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function authPlugin(fastify) {
  // Decorate with helpers
  fastify.decorate('jwt', { signAccess, signRefresh, verifyToken });

  // Decorator: get user from token if present (does not reject)
  fastify.decorateRequest('userId', null);

  fastify.decorate('optionalAuth', async function (request) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    try {
      const decoded = verifyToken(header.slice(7));
      request.userId = decoded.sub;
    } catch {
      // Invalid token — treat as anonymous
    }
  });

  // Hook: requireAuth — rejects 401 if no valid token (allows banned users so they can appeal/logout)
  fastify.decorate('requireAuth', async function (request, reply) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const decoded = verifyToken(header.slice(7));
      request.userId = decoded.sub;
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });

  // Hook: requireActiveUser — rejects 401 if no valid token, 403 if banned
  fastify.decorate('requireActiveUser', async function (request, reply) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const decoded = verifyToken(header.slice(7));
      request.userId = decoded.sub;
      const User = (await import('../db/user.model.js')).default;
      const user = await User.findById(decoded.sub);
      if (!user || user.deletedAt) return reply.code(401).send({ error: 'User not found' });
      await user.checkBanStatus();
      if (user.isBanned) return reply.code(403).send({ error: 'User is banned' });
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });

  // Hook: requireAdmin — rejects 401 if no valid token, 403 if not admin
  fastify.decorate('requireAdmin', async function (request, reply) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const decoded = verifyToken(header.slice(7));
      request.userId = decoded.sub;
      
      const User = (await import('../db/user.model.js')).default;
      const user = await User.findById(decoded.sub);
      if (!user || user.deletedAt) return reply.code(401).send({ error: 'User not found' });
      await user.checkBanStatus();
      if (user.isBanned) return reply.code(403).send({ error: 'User is banned' });
      if (user.role !== 'admin') return reply.code(403).send({ error: 'Admin access required' });
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
