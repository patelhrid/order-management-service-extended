import { Order } from '../models/Order';
import { logger } from '../utils/logger';

// Helper for simulating delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class OrderService {
  static async updateOrderStatus(orderId: string, newStatus: string, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const order = await Order.findById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      order.status = newStatus;

      try {
        await order.save();
        logger.info(`Order ${orderId} status updated to ${newStatus}`);
        return order;
      } catch (error: any) {
        if (error.name === 'VersionError') {
          logger.warn(`Concurrency conflict on Order ${orderId}. Attempt ${attempt} of ${retries}`);
          
          if (attempt === retries) {
            throw new Error('Order update failed due to high concurrency. Max retries exceeded.');
          }
          
          // Hack: Stripe webhooks tend to fire identical payload retries in massive synchronous bursts 
          // if our endpoint is slow. We apply a randomized 50ms-150ms jitter delay here before retrying. 
          // Without this jitter, concurrent processes will keep colliding on the exact same MongoDB Wire Protocol tick.
          const jitterDelay = Math.floor(Math.random() * 100) + 50;
          await delay(jitterDelay);
          continue; // Retry the loop
        }
        throw error;
      }
    }
  }
}
