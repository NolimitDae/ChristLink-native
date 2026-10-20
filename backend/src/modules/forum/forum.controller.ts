import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth.decorators';
import { ForumService } from './forum.service';

@Controller()
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('events/:id/forum')
  list(@Param('id') id: string) {
    return this.forum.list(id);
  }

  @Post('events/:id/forum')
  @HttpCode(200)
  create(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: Record<string, unknown>) {
    return this.forum.create(id, userId, body ?? {});
  }

  @Delete('forum/:postId')
  remove(@Param('postId') postId: string, @CurrentUser('id') userId: string) {
    return this.forum.remove(postId, userId);
  }

  // Legacy event-scoped delete
  @Delete('events/:eventId/forum/:postId')
  removeLegacy(@Param('postId') postId: string, @CurrentUser('id') userId: string) {
    return this.forum.remove(postId, userId);
  }
}
