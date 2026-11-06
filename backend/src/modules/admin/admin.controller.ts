import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin, CurrentUser } from '../../common/auth.decorators';
import { AdminService } from './admin.service';

@Admin()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('signups')
  signups() {
    return this.admin.signups();
  }

  @Get('revenue')
  revenue() {
    return this.admin.revenue();
  }

  @Get('events-by-type')
  eventsByType() {
    return this.admin.eventsByType();
  }

  @Get('top-events')
  topEvents() {
    return this.admin.topEvents();
  }

  @Get('top-hosts')
  topHosts() {
    return this.admin.topHosts();
  }

  @Get('activity')
  activity() {
    return this.admin.activity();
  }

  @Get('users')
  users(@Query() q: Record<string, string>) {
    return this.admin.users(q.q, q.role, q.limit, q.offset);
  }

  @Patch('users/:id/role')
  setRole(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() b: { role?: unknown }) {
    return this.admin.setRole(adminId, id, b?.role);
  }

  @Patch('events/:id/cancel')
  cancelEvent(@Param('id') id: string) {
    return this.admin.cancelEvent(id);
  }

  @Delete('events/:id')
  deleteEvent(@Param('id') id: string) {
    return this.admin.deleteEvent(id);
  }

  @Get('posts')
  posts(@Query() q: Record<string, string>) {
    return this.admin.posts(q.limit, q.offset);
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.admin.deletePost(id);
  }

  @Get('verifications')
  verifications(@Query('status') status?: string) {
    return this.admin.verifications(status);
  }

  // server.js uses PATCH; the native app sends POST
  @Patch('verifications/:userId/approve')
  approve(@CurrentUser('id') adminId: string, @Param('userId') userId: string) {
    return this.admin.approve(adminId, userId);
  }

  @Post('verifications/:userId/approve')
  @HttpCode(200)
  approvePost(@CurrentUser('id') adminId: string, @Param('userId') userId: string) {
    return this.admin.approve(adminId, userId);
  }

  @Patch('verifications/:userId/reject')
  reject(@CurrentUser('id') adminId: string, @Param('userId') userId: string, @Body() b: { reason?: unknown }) {
    return this.admin.reject(adminId, userId, b?.reason);
  }

  @Post('verifications/:userId/reject')
  @HttpCode(200)
  rejectPost(@CurrentUser('id') adminId: string, @Param('userId') userId: string, @Body() b: { reason?: unknown }) {
    return this.admin.reject(adminId, userId, b?.reason);
  }

  @Get('verifications/:userId/id-doc')
  idDoc(@Param('userId') userId: string) {
    return this.admin.idDocUrl(userId);
  }

  @Get('listing-promo-codes')
  promoCodes() {
    return this.admin.promoCodes();
  }

  @Post('listing-promo-codes')
  @HttpCode(200)
  createPromo(@Body() b: Record<string, unknown>) {
    return this.admin.createPromo(b);
  }

  @Patch('listing-promo-codes/:id')
  setPromoActive(@Param('id') id: string, @Body() b: { active?: unknown }) {
    return this.admin.setPromoActive(id, b?.active);
  }

  @Delete('connect-disconnect/:userId')
  disconnect(@Param('userId') userId: string) {
    return this.admin.disconnectStripe(userId);
  }
}
