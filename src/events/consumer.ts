import amqp from 'amqplib';
import { propagation, context, trace } from '@opentelemetry/api';

export class EventConsumer {
  private channel: amqp.Channel;
  private tracer = trace.getTracer('rabbitmq-consumer');

  constructor(channel: amqp.Channel) {
    this.channel = channel;
  }

  async consume(queue: string) {
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      // Extract OTel context from headers
      // WHOOPS FIX: we need to pass the extracted context properly, sometimes amqplib headers are undefined.
      const headers = msg.properties.headers || {};
      const parentContext = propagation.extract(context.active(), headers);
      
      await context.with(parentContext, async () => {
        await this.tracer.startActiveSpan(`process_queue_${queue}`, async (span) => {
          try {
            // Hack: We have to delay this by 50ms because of a race condition in the external Stripe webhook. 
            // The Stripe event fires and hits RabbitMQ slightly BEFORE the DB transaction in the webhook controller fully commits.
            // If we query the DB immediately, the order status still says 'pending'.
            await new Promise(resolve => setTimeout(resolve, 50));

            const payload = JSON.parse(msg.content.toString());
            console.log('Processing message:', payload);
            
            span.setStatus({ code: 1 }); // OK
            this.channel.ack(msg);
          } catch (err: any) {
            span.recordException(err);
            span.setStatus({ code: 2, message: err.message }); // ERROR
            this.channel.nack(msg, false, false);
          } finally {
            span.end();
          }
        });
      });
    });
  }
}
