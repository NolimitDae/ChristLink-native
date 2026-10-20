import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseFilters } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/auth.decorators';
import { JsonErrorFilter } from './json-error';
import { PAYMENT_LIMIT } from './payments.controller';
import { TicketsService } from './tickets.service';
import { WalletService } from './wallet.service';

type Loose = Record<string, any>;

@Controller()
@UseFilters(JsonErrorFilter)
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly wallet: WalletService,
  ) {}

  @Get('my-tickets')
  myTickets(@CurrentUser('id') userId: string) {
    return this.tickets.myTickets(userId);
  }

  // A fast door line scans several tickets a second; skip only the per-second limit
  @Post('tickets/verify')
  @HttpCode(200)
  @SkipThrottle({ short: true })
  verify(@CurrentUser('id') userId: string, @Body() body: Loose) {
    return this.tickets.verify(userId, body);
  }

  @Get('events/:id/attendance')
  attendance(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.tickets.attendance(userId, id);
  }

  @Post('tickets/:ticketId/request-refund')
  @HttpCode(200)
  requestRefund(@CurrentUser('id') userId: string, @Param('ticketId') ticketId: string, @Body() body: Loose) {
    return this.tickets.requestRefund(userId, ticketId, body?.reason);
  }

  @Post('tickets/:ticketId/refund')
  @HttpCode(200)
  @Throttle(PAYMENT_LIMIT)
  refund(@CurrentUser('id') userId: string, @Param('ticketId') ticketId: string) {
    return this.tickets.hostRefund(userId, ticketId);
  }

  @Get('refund-requests')
  refundRequests(@CurrentUser('id') userId: string, @Query('eventId') eventId?: string) {
    return this.tickets.refundRequests(userId, typeof eventId === 'string' ? eventId : undefined);
  }

  @Post('refund-requests/:id/approve')
  @HttpCode(200)
  @Throttle(PAYMENT_LIMIT)
  approve(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.tickets.approve(userId, id);
  }

  @Post('refund-requests/:id/deny')
  @HttpCode(200)
  deny(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.tickets.deny(userId, id);
  }

  @Get('tickets/:ticketId/wallet')
  async walletPass(@CurrentUser('id') userId: string, @Param('ticketId') ticketId: string, @Res() res: Response) {
    sendPass(res, await this.wallet.build(ticketId, userId));
  }

  @Get('tickets/:ticketId/wallet-link')
  walletLink(@CurrentUser('id') userId: string, @Param('ticketId') ticketId: string, @Req() req: Request) {
    // trust proxy = 1, so req.protocol is the client's (https on Railway)
    return this.wallet.link(ticketId, userId, `${req.protocol}://${req.get('host')}`);
  }

  /** Public: the signed link is the authorization (Safari / Wallet can't send a bearer token). */
  @Public()
  @Get('tickets/:ticketId/wallet.pkpass')
  async signedWalletPass(
    @Param('ticketId') ticketId: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    this.wallet.checkLink(ticketId, exp, sig);
    sendPass(res, await this.wallet.build(ticketId, null));
  }
}

function sendPass(res: Response, pass: { buffer: Buffer; shortCode: string }) {
  res.set({
    'Content-Type': 'application/vnd.apple.pkpass',
    'Content-Disposition': `attachment; filename="christlink-${pass.shortCode}.pkpass"`,
    'Content-Length': String(pass.buffer.length),
  });
  res.send(pass.buffer);
}
