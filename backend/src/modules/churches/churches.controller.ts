import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import {
  IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUrl, IsUUID, Length, MaxLength,
} from 'class-validator';
import type { Response } from 'express';
import { Admin, CurrentUser, OptionalAuth, Public } from '../../common/auth.decorators';
import { ChurchesService } from './churches.service';
import type { RecurringInput } from './recurring';

export class ChurchDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) denomination?: string | null;
  @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @IsString() @MaxLength(60) state?: string | null;
  @IsOptional() @IsString() @MaxLength(20) zip?: string | null;
  @IsOptional() @IsNumber() lat?: number | null;
  @IsOptional() @IsNumber() lng?: number | null;
  @IsOptional() @IsArray() service_times?: object[];
  @IsOptional() @IsUrl() livestream_url?: string | null;
  @IsOptional() @IsUrl() website_url?: string | null;
  @IsOptional() @IsArray() leaders?: object[];
  @IsOptional() @IsArray() @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsString() @MaxLength(1000) logo_url?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) about?: string | null;
  // Admin only (churches_guard): ignored for everyone else
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsBoolean() hidden?: boolean;
}
class ClaimDto {
  @IsOptional() @IsString() @MaxLength(200) role_at_church?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
class DecideDto {
  @IsBoolean() approve: boolean;
}
class LinkEventDto {
  @IsUUID() event_id: string;
}

@Controller()
export class ChurchesController {
  constructor(private readonly churches: ChurchesService) {}

  @Get('churches')
  @OptionalAuth()
  search(@CurrentUser('id') uid: string | undefined, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.churches.search(uid, typeof q === 'string' ? q : '', Math.min(Math.max(parseInt(limit ?? '20', 10) || 20, 1), 100));
  }

  @Get('my-churches')
  mine(@CurrentUser('id') uid: string) {
    return this.churches.mine(uid);
  }

  /** The church, or JSON null when it does not exist or is hidden from the caller (like Supabase maybeSingle). */
  @Get('churches/:id')
  @OptionalAuth()
  async get(@CurrentUser('id') uid: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    res.json(await this.churches.get(uid, id));
  }

  @Post('churches')
  @HttpCode(200)
  create(@CurrentUser('id') uid: string, @Body() b: ChurchDto) {
    return this.churches.create(uid, b);
  }

  @Patch('churches/:id')
  update(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: ChurchDto) {
    return this.churches.update(uid, id, b);
  }

  @Post('churches/:id/claim')
  @HttpCode(200)
  claim(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: ClaimDto) {
    return this.churches.claim(uid, id, b.role_at_church ?? null, b.note ?? null);
  }

  @Get('admin/church-claims')
  @Admin()
  pendingClaims() {
    return this.churches.pendingClaims();
  }

  @Post('admin/church-claims/:id/decide')
  @Admin()
  @HttpCode(200)
  decide(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: DecideDto) {
    return this.churches.decide(uid, id, b.approve);
  }

  @Get('churches/:id/recurring')
  @Public()
  recurring(@Param('id', ParseUUIDPipe) id: string) {
    return this.churches.recurring(id);
  }

  @Post('churches/:id/recurring')
  @HttpCode(200)
  addRecurring(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: RecurringInput) {
    return this.churches.addRecurring(uid, id, b ?? {});
  }

  @Patch('church-recurring/:id')
  updateRecurring(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: RecurringInput) {
    return this.churches.updateRecurring(uid, id, b ?? {});
  }

  @Delete('church-recurring/:id')
  deleteRecurring(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.churches.deleteRecurring(uid, id);
  }

  @Get('churches/:id/events')
  @Public()
  eventIds(@Param('id', ParseUUIDPipe) id: string) {
    return this.churches.eventIds(id);
  }

  @Post('churches/:id/events')
  @HttpCode(200)
  linkEvent(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: LinkEventDto) {
    return this.churches.linkEvent(uid, id, b.event_id);
  }

  @Get('churches/:id/follow')
  following(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.churches.isFollowing(uid, id);
  }

  @Post('churches/:id/follow')
  @HttpCode(200)
  follow(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.churches.setFollow(uid, id, true);
  }

  @Delete('churches/:id/follow')
  unfollow(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.churches.setFollow(uid, id, false);
  }
}
