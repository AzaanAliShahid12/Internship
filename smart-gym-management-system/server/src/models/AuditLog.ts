import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  createdAt: Date;
  updatedAt: Date;
  actor?: Types.ObjectId;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

const auditSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String },
    details: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true }
);

export const AuditLog = model<IAuditLog>('AuditLog', auditSchema);
