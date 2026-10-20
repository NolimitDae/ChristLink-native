import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, OptionalAuth } from '../../common/auth.decorators';
import { CommunityService } from './community.service';

// Loose server.js bodies; the service validates.
interface BodyText {
  body?: unknown;
}

@Controller()
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @OptionalAuth()
  @Get('community-posts')
  list(@CurrentUser('id') userId: string | undefined, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.community.listPosts(userId, limit, offset);
  }

  @Post('community-posts')
  @HttpCode(200)
  create(@CurrentUser('id') userId: string, @Body() b: BodyText) {
    return this.community.createPost(userId, b?.body);
  }

  @Patch('community-posts/:id/type')
  setType(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() b: { type?: unknown }) {
    return this.community.setPostType(userId, id, b?.type);
  }

  @Patch('community-posts/:id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() b: BodyText) {
    return this.community.updatePost(userId, id, b?.body);
  }

  @Delete('community-posts/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.community.deletePost(userId, id);
  }

  @Post('community-posts/:id/amen')
  @HttpCode(200)
  amen(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.community.amenPost(userId, id);
  }

  @OptionalAuth()
  @Get('community-posts/:id/replies')
  replies(@CurrentUser('id') userId: string | undefined, @Param('id') id: string) {
    return this.community.listReplies(userId, id);
  }

  @Post('community-posts/:id/replies')
  @HttpCode(200)
  reply(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() b: BodyText) {
    return this.community.createReply(userId, id, b?.body);
  }

  @Delete('community-posts/:postId/replies/:replyId')
  removeReply(@CurrentUser('id') userId: string, @Param('replyId') replyId: string) {
    return this.community.deleteReply(userId, replyId);
  }

  @Post('community-replies/:id/amen')
  @HttpCode(200)
  amenReply(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.community.amenReply(userId, id);
  }
}
