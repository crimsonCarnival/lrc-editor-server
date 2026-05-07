import 'fastify';
import type { JwtPayload } from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyInstance {
    jwt: {
      signAccess(payload: Record<string, unknown>): string;
      signRefresh(payload: Record<string, unknown>): string;
      verifyToken(token: string): JwtPayload;
    };
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireActiveUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAuthForAppeal: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAuthLax: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    userId?: string | null;
  }
}