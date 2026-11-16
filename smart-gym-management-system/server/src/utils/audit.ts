import { AuditLog } from '../models/AuditLog';
import { Types } from 'mongoose';

export async function writeAudit(params: {
  actorId?: string | Types.ObjectId | null;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await AuditLog.create({
      actor: params.actorId ?? undefined,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      ip: params.ip,
    });
  } catch {
    // Audit logging must never break the main request flow.
  }
}
