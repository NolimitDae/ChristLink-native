import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth.decorators';
import { RsvpService } from './rsvp.service';

@Controller()
export class RsvpController {
  constructor(private readonly rsvp: RsvpService) {}

  @Get('rsvp/:eventId')
  get(@Param('eventId') eventId: string, @CurrentUser('id') userId: string) {
    return this.rsvp.get(eventId, userId);
  }

  @Get('my-rsvps')
  mine(@CurrentUser('id') userId: string) {
    return this.rsvp.mine(userId);
  }

  @Post('rsvp')
  @HttpCode(200)
  create(@CurrentUser('id') userId: string, @Body() body: { eventId?: unknown }) {
    return this.rsvp.create(userId, body?.eventId);
  }

  @Delete('rsvp/:eventId')
  cancel(@Param('eventId') eventId: string, @CurrentUser('id') userId: string) {
    return this.rsvp.cancel(eventId, userId);
  }
}
