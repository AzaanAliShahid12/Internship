import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/tokens';
import { env } from '../config/env';

let io: SocketServer | null = null;

const STAFF_ROLES = ['super_admin', 'gym_admin', 'receptionist'];

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as Record<string, unknown>).userId = payload.sub;
      (socket.data as Record<string, unknown>).role = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const role = (socket.data as Record<string, unknown>).role as string;
    const userId = (socket.data as Record<string, unknown>).userId as string;
    // Role-scoped rooms: staff see gym-wide events; a member only sees their own.
    if (STAFF_ROLES.includes(role)) socket.join('staff');
    if (role === 'trainer') socket.join('trainers');
    socket.join(`user:${userId}`);
  });

  return io;
}

export function getIO(): SocketServer | null {
  return io;
}

/** Emit an event to staff dashboards (front desk / admins). */
export function emitToStaff(event: string, payload: unknown): void {
  io?.to('staff').emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
