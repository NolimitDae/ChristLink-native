import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/** User settings, push tokens and account deletion. */
@Module({ controllers: [SettingsController], providers: [SettingsService] })
export class SettingsModule {}
