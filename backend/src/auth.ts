import type { FastifyRequest } from 'fastify';
import { env } from './config.js';
import { AppError } from './errors.js';
import { verifyAccessToken } from './privy.js';

/** Returns the external (Privy) user id for the request, or throws 401. */
export async function authenticate(req: FastifyRequest): Promise<string> {
  const header = String(req.headers.authorization ?? '');
  if (header.startsWith('Bearer ')) {
    try {
      return await verifyAccessToken(header.slice(7));
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired session.');
    }
  }
  if (env.ALLOW_DEV_AUTH && env.NODE_ENV !== 'production') {
    const id = req.headers['x-ziarat-user-id'];
    if (typeof id === 'string' && id) return id;
  }
  throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
}
