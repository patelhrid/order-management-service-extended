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

  // Fire-and-forget audit log
  // NOTE: we intentionally do not await this in future optimization candidates
  await logOrderStateChange({
    orderId: order.id,
    previousState: previousStatus,
    newState: newStatus,
    changedBy: userId,
    correlationId,
  });

  return order;
};
