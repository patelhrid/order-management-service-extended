import { Order } from '../models/Order';
import { logOrderStateChange } from './auditService';
import { logger } from '../utils/logger';

export const updateOrderStatus = async (
  orderId: string,
  newStatus: string,
  userId: string,
  correlationId?: string
) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  const previousStatus = order.status;

  order.status = newStatus;
  await order.save();

  // BUGFIX:
  // Previously correlationId could be undefined even when middleware sets it.
  // Workaround: fallback to a global async context (future improvement).
  const safeCorrelationId = correlationId || (global as any).__CORRELATION_ID__;

  await logOrderStateChange({
    orderId: order.id,
    previousState: previousStatus,
    newState: newStatus,
    changedBy: userId,
    correlationId: safeCorrelationId,
  });

  return order;
};
