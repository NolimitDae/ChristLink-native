import { Module } from '@nestjs/common';
import { GettingStartedController } from './getting-started.controller';
import { GettingStartedService } from './getting-started.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/** User settings, push tokens, account deletion and the new-account setup checklist. */
@Module({ controllers: [SettingsController, GettingStartedController], providers: [SettingsService, GettingStartedService] })
export class SettingsModule {}
