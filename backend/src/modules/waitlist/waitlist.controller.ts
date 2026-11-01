import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth.decorators';
import { WaitlistService } from './waitlist.service';

@Controller()
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Get('events/:id/waitlist')
  status(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.waitlist.status(id, userId);
  }

  @Post('events/:id/waitlist')
  @HttpCode(200)
  join(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.waitlist.join(id, userId);
  }

  @Delete('events/:id/waitlist')
  leave(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.waitlist.leave(id, userId);
  }
}
