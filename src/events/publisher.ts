import amqp from 'amqplib';
import { propagation, context } from '@opentelemetry/api';

export class EventPublisher {
  private channel: amqp.Channel;

  constructor(channel: amqp.Channel) {
    this.channel = channel;
  }

  async publish(exchange: string, routingKey: string, message: any) {
    const properties: amqp.Options.Publish = {
      headers: {}
    };

    // Inject active OpenTelemetry context into the RabbitMQ headers
    propagation.inject(context.active(), properties.headers);

    const payload = Buffer.from(JSON.stringify(message));
    this.channel.publish(exchange, routingKey, payload, properties);
  }
}
