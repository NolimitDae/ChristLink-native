import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/auth.decorators';
import { PRAYER_FILTERS, PrayersService } from './prayers.service';

class PrayerDto {
  @IsString() body: string;
  @IsOptional() @IsBoolean() is_anonymous?: boolean;
  @IsOptional() @IsUUID() church_id?: string | null;
}
class AnswerDto {
  @IsOptional() @IsString() testimony?: string;
}

@Controller()
export class PrayersController {
  constructor(private readonly prayers: PrayersService) {}

  @Get('prayers')
  wall(
    @CurrentUser('id') uid: string,
    @Query('filter') filter = 'all',
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    if (!PRAYER_FILTERS.includes(filter)) throw new BadRequestException('Unknown filter.');
    const beforeDate = before ? new Date(before) : null;
    if (beforeDate && isNaN(beforeDate.getTime())) throw new BadRequestException('Invalid before date.');
    const n = Math.min(Math.max(parseInt(limit ?? '30', 10) || 30, 1), 100);
    return this.prayers.wall(uid, filter, n, beforeDate);
  }

  @Post('prayers')
  @HttpCode(200)
  create(@CurrentUser('id') uid: string, @Body() b: PrayerDto) {
    return this.prayers.create(uid, b.body, b.is_anonymous ?? false, b.church_id ?? null);
  }

  @Delete('prayers/:id')
  remove(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.prayers.remove(uid, id);
  }

  @Post('prayers/:id/pray')
  @HttpCode(200)
  async pray(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return { count: await this.prayers.prayFor(uid, id) };
  }

  @Post('prayers/:id/answer')
  @HttpCode(200)
  async answer(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: AnswerDto) {
    return { post_id: await this.prayers.markAnswered(uid, id, b.testimony) };
  }
}
