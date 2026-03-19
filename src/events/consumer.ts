import amqp from 'amqplib';
import { propagation, context, trace } from '@opentelemetry/api';

export class EventConsumer {
  private channel: amqp.Channel;
  private tracer = trace.getTracer('rabbitmq-consumer');

  constructor(channel: amqp.Channel) {
    this.channel = channel;
  }

  async consume(queue: string) {
    await this.channel.consume(queue, (msg) => {
      if (!msg) return;

      // Extract OTel context from headers
      const parentContext = propagation.extract(context.active(), msg.properties.headers);
      
      this.channel.ack(msg);
    });
  }
}
