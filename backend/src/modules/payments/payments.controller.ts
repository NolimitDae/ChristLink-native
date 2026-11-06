import { Body, Controller, Delete, Get, HttpCode, Post, Query, Req, UseFilters } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Public } from '../../common/auth.decorators';
import { JsonErrorFilter } from './json-error';
import { PaymentsService } from './payments.service';

// server.js pmtLimiter: 20 payment attempts per hour per IP
export const PAYMENT_LIMIT = { long: { limit: 20, ttl: 60 * 60_000 } };

// Loose server.js bodies (plain types): the service validates and picks fields by hand.
type Loose = Record<string, any>;

@Controller()
@UseFilters(JsonErrorFilter)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Get('price-breakdown')
  priceBreakdown(@Query() q: { price?: string; qty?: string; absorb?: string }) {
    return this.payments.priceBreakdown(q);
  }

  @Post('tax-estimate')
  @HttpCode(200)
  taxEstimate(@Body() body: Loose) {
    return this.payments.taxEstimate(body?.amountCents);
  }

  @Post('create-payment-intent')
  @HttpCode(200)
  @Throttle(PAYMENT_LIMIT)
  createPaymentIntent(@CurrentUser() user: AuthUser, @Body() body: Loose) {
    return this.payments.createPaymentIntent(user, body);
  }

  @Post('tickets/confirm-by-intent')
  @HttpCode(200)
  confirmByIntent(@CurrentUser() user: AuthUser, @Body() body: Loose) {
    return this.payments.confirmByIntent(user, body?.paymentIntentId);
  }

  @Post('connect-onboard')
  @HttpCode(200)
  connectOnboard(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.payments.connectOnboard(user, req.headers.host);
  }

  @Post('connect-sync')
  @HttpCode(200)
  connectSync(@CurrentUser() user: AuthUser) {
    return this.payments.connectSync(user);
  }

  @Delete('connect-disconnect')
  connectDisconnect(@CurrentUser() user: AuthUser) {
    return this.payments.connectDisconnect(user);
  }

  @Post('charge-listing-fee')
  @HttpCode(200)
  @Throttle(PAYMENT_LIMIT)
  chargeListingFee(@CurrentUser() user: AuthUser, @Body() body: Loose) {
    return this.payments.chargeListingFee(user, body);
  }

  @Post('validate-listing-promo')
  @HttpCode(200)
  validateListingPromo(@Body() body: Loose) {
    return this.payments.validateListingPromo(body?.code);
  }
}
