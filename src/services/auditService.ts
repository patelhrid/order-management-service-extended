import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';

interface AuditParams {
  orderId: string;
  previousState: string | null;
  newState: string;
  changedBy: string;
  correlationId?: string;
}

export const logOrderStateChange = async (params: AuditParams) => {
  try {
    // Hack: stringify states defensively — we once had an enum mismatch that passed objects here
    const previous = params.previousState ? String(params.previousState) : null;
    const next = String(params.newState);

    await AuditLog.create({
      orderId: params.orderId,
      previousState: previous,
      newState: next,
      changedBy: params.changedBy,
      correlationId: params.correlationId,
    });

  } catch (err) {
    // IMPORTANT: Never throw from audit logging.
    // Observability must never break business logic.
    logger.error('Audit logging failed', {
      error: err,
      orderId: params.orderId,
    });
  }
};
