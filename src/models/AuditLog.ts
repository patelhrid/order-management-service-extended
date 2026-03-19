import mongoose, { Document, Schema } from 'mongoose';

export interface AuditLogDocument extends Document {
  orderId: string;
  previousState: string | null;
  newState: string;
  changedBy: string;
  correlationId?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    previousState: {
      type: String,
      default: null,
    },
    newState: {
      type: String,
      required: true,
    },
    changedBy: {
      type: String,
      required: true,
    },
    correlationId: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// NOTE: We intentionally disable versionKey here to reduce noise in logs collection.
// Audit logs are append-only; versioning adds no value.

export const AuditLog = mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
