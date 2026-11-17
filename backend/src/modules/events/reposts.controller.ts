import { Body, Controller, HttpCode, Param, Patch, Post, UseFilters } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/auth.decorators';
import { JsonErrorFilter } from '../payments/json-error';
import { RepostsService } from './reposts.service';

type LooseBody = Record<string, unknown>;

// Each preview fetches another site and stores a picture, so it is limited per IP as well as needing sign-in
const PREVIEW_LIMIT = { long: { limit: 30, ttl: 60 * 60_000 } };

/** Sharing an event that's listed on another platform (docs/REPOSTS.md). */
@Controller('reposts')
@UseFilters(JsonErrorFilter)
export class RepostsController {
  constructor(private readonly reposts: RepostsService) {}

  @Post()
  @HttpCode(200)
  create(@CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.reposts.create(userId, body ?? {});
  }

  @Post('preview')
  @HttpCode(200)
  @Throttle(PREVIEW_LIMIT)
  preview(@CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.reposts.preview(userId, body?.url);
  }

  @Post('flyer')
  @HttpCode(200)
  @Throttle(PREVIEW_LIMIT)
  flyer(@CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.reposts.flyer(userId, body?.dataUrl);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: LooseBody) {
    return this.reposts.update(id, userId, body ?? {});
  }
}
