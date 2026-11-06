import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AuthUser, CurrentUser, OptionalAuth, Public } from '../../common/auth.decorators';
import { ProfilesService } from './profiles.service';

// Loose server.js bodies (plain types): the service validates.
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('profile')
  me(@CurrentUser() user: AuthUser) {
    return this.profiles.me(user);
  }

  @Patch('profile')
  update(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.profiles.update(user, body);
  }

  // The native app sends { userId }; the website sends { target_user_id }
  @Post('profile/prayer-support')
  @HttpCode(200)
  prayerSupport(@CurrentUser('id') userId: string, @Body() b: { target_user_id?: unknown; userId?: unknown }) {
    return this.profiles.togglePrayerSupport(userId, b?.target_user_id ?? b?.userId);
  }

  @OptionalAuth()
  @Get('profile/public/:userId')
  publicProfile(@Param('userId') targetId: string, @CurrentUser('id') viewerId?: string) {
    return this.profiles.publicProfile(targetId, viewerId);
  }

  @Public()
  @Get('profiles/:id')
  card(@Param('id') id: string) {
    return this.profiles.profileCard(id);
  }

  @Public()
  @Get('profiles/:id/stats')
  stats(@Param('id') id: string) {
    return this.profiles.hostStats(id);
  }

  @Post('follow/:userId')
  @HttpCode(200)
  follow(@CurrentUser('id') userId: string, @Param('userId') target: string) {
    return this.profiles.follow(userId, target);
  }

  @Delete('follow/:userId')
  unfollow(@CurrentUser('id') userId: string, @Param('userId') target: string) {
    return this.profiles.unfollow(userId, target);
  }

  @Get('followers')
  myFollowers(@CurrentUser('id') userId: string) {
    return this.profiles.myFollowers(userId);
  }

  @Public()
  @Get('followers/:userId')
  followers(@Param('userId') userId: string) {
    return this.profiles.followersOf(userId);
  }

  @Public()
  @Get('following/:userId')
  following(@Param('userId') userId: string) {
    return this.profiles.followingOf(userId);
  }

  @Post('upload-avatar')
  @HttpCode(200)
  avatar(@CurrentUser('id') userId: string, @Body() b: { dataUrl?: unknown }) {
    return this.profiles.upload('avatars', userId, b?.dataUrl);
  }

  @Post('upload-banner')
  @HttpCode(200)
  banner(@CurrentUser('id') userId: string, @Body() b: { dataUrl?: unknown }) {
    return this.profiles.upload('banners', userId, b?.dataUrl);
  }

  @Post('identity/submit')
  @HttpCode(200)
  submitIdentity(@CurrentUser('id') userId: string, @Body() b: { legal_name?: unknown; id_doc_base64?: unknown }) {
    return this.profiles.submitIdentity(userId, b?.legal_name, b?.id_doc_base64);
  }

  @Get('identity/status')
  identityStatus(@CurrentUser('id') userId: string) {
    return this.profiles.identityStatus(userId);
  }

  @Get('notifications')
  notifications(@CurrentUser('id') userId: string) {
    return this.profiles.notifications(userId);
  }

  // server.js uses PATCH; the native app sends POST
  @Patch('notifications/read-all')
  readAll(@CurrentUser('id') userId: string) {
    return this.profiles.readAll(userId);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  readAllPost(@CurrentUser('id') userId: string) {
    return this.profiles.readAll(userId);
  }
}
