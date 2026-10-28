import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { CurrentUser, OptionalAuth } from '../../common/auth.decorators';
import { ServeService } from './serve.service';

class ShiftDto {
  @IsDateString() starts_at: string;
  @IsDateString() ends_at: string;
  @IsInt() @Min(1) @Max(500) spots: number;
}
export class RoleDto {
  @IsOptional() @IsUUID() event_id?: string | null;
  @IsOptional() @IsUUID() church_id?: string | null;
  @IsString() @Length(2, 80) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) requirements?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ShiftDto) shifts?: ShiftDto[];
}
class CodeDto {
  @IsString() @MaxLength(64) code: string;
}
class MessageDto {
  @IsOptional() @IsString() message?: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('serve')
export class ServeController {
  constructor(private readonly serve: ServeService) {}

  @Get('shifts')
  @OptionalAuth()
  open(@CurrentUser('id') uid: string | undefined, @Query('church_id') churchId?: string, @Query('event_id') eventId?: string) {
    for (const v of [churchId, eventId]) if (v && !uuid.test(v)) throw new BadRequestException('Invalid id.');
    return this.serve.openShifts(uid ?? null, churchId || null, eventId || null);
  }

  @Post('shifts/:id/signup')
  @HttpCode(200)
  signup(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.serve.signup(uid, id);
  }

  @Post('signups/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.serve.cancel(uid, id);
  }

  @Post('roles')
  @HttpCode(200)
  createRole(@CurrentUser('id') uid: string, @Body() b: RoleDto) {
    return this.serve.createRole(uid, b);
  }

  @Get('my-shifts')
  myShifts(@CurrentUser('id') uid: string) {
    return this.serve.myShifts(uid);
  }

  @Get('shifts/:id/roster')
  roster(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.serve.roster(uid, id);
  }

  @Post('check-in')
  @HttpCode(200)
  checkIn(@CurrentUser('id') uid: string, @Body() b: CodeDto) {
    return this.serve.checkIn(uid, b.code);
  }

  @Post('shifts/:id/complete')
  @HttpCode(200)
  async complete(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return { count: await this.serve.complete(uid, id) };
  }

  @Post('shifts/:id/message')
  @HttpCode(200)
  async message(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: MessageDto) {
    return { count: await this.serve.message(uid, id, b.message) };
  }

  @Get('hours')
  async hours(@CurrentUser('id') uid: string) {
    return { hours: await this.serve.hours(uid) };
  }
}
