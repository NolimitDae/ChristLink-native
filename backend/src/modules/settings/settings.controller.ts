import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateIf,
} from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth.decorators';
import { SettingsService } from './settings.service';

const present = (_: unknown, v: unknown) => v !== undefined;

export class SettingsDto {
  @IsOptional() @IsUUID() home_church_id?: string | null;
  // NOT NULL columns: may be omitted, never null
  @ValidateIf(present) @IsBoolean() hide_rsvps_from_non_friends?: boolean;
  @ValidateIf(present) @IsObject() notification_prefs?: Record<string, boolean>;
  @IsOptional() @IsInt() @Min(0) @Max(23) quiet_hours_start?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(23) quiet_hours_end?: number | null;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string | null;
  @IsOptional() @IsString() @MaxLength(32) terms_version?: string | null;
  @IsOptional() @IsDateString() terms_accepted_at?: string | null;
  @IsOptional() @IsDateString() host_adult_confirmed_at?: string | null;
  @IsOptional() @IsDateString() onboarding_completed_at?: string | null;
}

class PushTokenDto {
  @IsString() @Length(1, 255) token: string;
  @IsOptional() @IsIn(['ios', 'android', 'web']) platform?: string | null;
}

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** The caller's user_settings row, or JSON null before the first save. */
  @Get('settings')
  async get(@CurrentUser('id') uid: string, @Res() res: Response) {
    res.json(await this.settings.get(uid));
  }

  @Patch('settings')
  update(@CurrentUser('id') uid: string, @Body() body: SettingsDto) {
    return this.settings.update(uid, body);
  }

  @Post('push-tokens')
  @HttpCode(200)
  savePushToken(@CurrentUser('id') uid: string, @Body() body: PushTokenDto) {
    return this.settings.savePushToken(uid, body.token, body.platform ?? null);
  }

  @Delete('push-tokens/:token')
  deletePushToken(@CurrentUser('id') uid: string, @Param('token') token: string) {
    return this.settings.deletePushToken(uid, token);
  }

  @Delete('account')
  deleteAccount(@CurrentUser('id') uid: string) {
    return this.settings.deleteAccount(uid);
  }
}
