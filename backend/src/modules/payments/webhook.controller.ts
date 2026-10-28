import { Controller, Headers, Post, RawBodyRequest, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { Public } from '../../common/auth.decorators';
import { WebhookService } from './webhook.service';

/** POST /webhook at the root (bootstrap excludes it from the /api prefix). Needs the raw body (rawBody: true). */
@Controller()
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  async handle(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') sig: string, @Res() res: Response) {
    let event: Stripe.Event;
    try {
      event = this.webhooks.verify(req.rawBody, sig);
    } catch (e) {
      // Same plain-text reply as server.js
      return res.status(400).send(`Webhook Error: ${(e as Error).message}`);
    }
    res.status(200).json(await this.webhooks.handle(event));
  }
}
