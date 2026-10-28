import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, OptionalAuth, Public } from '../../common/auth.decorators';
import { EventsService } from './events.service';

// Loose server.js-shaped bodies: the service picks and validates fields by hand.
type LooseBody = Record<string, unknown>;

@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get('events')
  list(@Query() q: Record<string, string | undefined>) {
    return this.events.list(q);
  }

  @OptionalAuth()
  @Get('events/:id')
  get(@Param('id') id: string, @CurrentUser('id') viewerId?: string) {
    return this.events.get(id, viewerId);
  }

  @Post('events')
  @HttpCode(200)
  create(@CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.create(userId, body ?? {});
  }

  @Patch('events/:id')
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.update(id, userId, body ?? {});
  }

  @Delete('events/:id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.events.remove(id, userId);
  }

  @Patch('events/:id/publish')
  publish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.events.publish(id, userId);
  }

  @Patch('events/:id/schedule')
  schedule(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.schedule(id, userId, body?.publish_at);
  }

  @Patch('events/:id/toggle-visibility')
  toggleVisibility(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.events.toggleVisibility(id, userId);
  }

  @Post('events/:id/duplicate')
  @HttpCode(200)
  duplicate(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.events.duplicate(id, userId);
  }

  /** Public, but a signed-in viewer may see attendees who hide their RSVPs from non-friends. */
  @OptionalAuth()
  @Get('events/:id/attendees')
  attendees(@Param('id') id: string, @CurrentUser('id') viewerId?: string) {
    return this.events.attendees(id, viewerId);
  }

  @Get('my-events')
  myEvents(@CurrentUser('id') userId: string) {
    return this.events.myEvents(userId);
  }

  @Get('events/:id/sales')
  sales(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.events.sales(id, userId);
  }

  @Post('events/:eventId/invite')
  @HttpCode(200)
  invite(@Param('eventId') eventId: string, @CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.invite(eventId, userId, body?.followerIds);
  }

  @Get('events/:id/coupons')
  listCoupons(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.events.listCoupons(id, userId);
  }

  @Post('events/:id/coupons')
  @HttpCode(200)
  createCoupon(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.createCoupon(id, userId, body ?? {});
  }

  @Delete('events/:eventId/coupons/:couponId')
  deactivateCoupon(@Param('couponId') couponId: string, @CurrentUser('id') userId: string) {
    return this.events.deactivateCoupon(couponId, userId);
  }

  @Public()
  @Post('events/:id/validate-coupon')
  @HttpCode(200)
  validateCoupon(@Param('id') id: string, @Body() body: LooseBody) {
    return this.events.validateCoupon(id, body ?? {});
  }

  @Post('ticket-types')
  @HttpCode(200)
  createTicketType(@CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.createTicketType(userId, body ?? {});
  }

  @Patch('ticket-types/:id')
  updateTicketType(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.updateTicketType(id, userId, body ?? {});
  }

  @Post('upload-event-image')
  @HttpCode(200)
  uploadEventImage(@CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.upload('events', userId, body?.dataUrl);
  }

  @Post('upload-forum-image')
  @HttpCode(200)
  uploadForumImage(@CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.events.upload('forum', userId, body?.dataUrl);
  }
}
