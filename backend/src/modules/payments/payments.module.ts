import { Module } from '@nestjs/common';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { stripeProvider } from './stripe.provider';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { WalletService } from './wallet.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

/** Stripe checkout, Connect, listing fee, webhook, and tickets (refunds, check-in, Apple Wallet). */
@Module({
  imports: [WaitlistModule],
  controllers: [PaymentsController, TicketsController, WebhookController],
  providers: [stripeProvider, PaymentsService, TicketsService, WalletService, WebhookService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
