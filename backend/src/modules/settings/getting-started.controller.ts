import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth.decorators';
import { GettingStartedService } from './getting-started.service';

/** The welcome tour and setup checklist for new accounts (getting-started.service.ts). */
@Controller('getting-started')
export class GettingStartedController {
  constructor(private readonly gettingStarted: GettingStartedService) {}

  @Get()
  status(@CurrentUser('id') uid: string) {
    return this.gettingStarted.status(uid);
  }

  /** Called when the app sees `celebrate: true`; only the first call answers `celebrate: true`. */
  @Post('celebrate')
  @HttpCode(200)
  celebrate(@CurrentUser('id') uid: string) {
    return this.gettingStarted.celebrate(uid);
  }

  @Post('welcomed')
  @HttpCode(200)
  welcomed(@CurrentUser('id') uid: string) {
    return this.gettingStarted.welcomed(uid);
  }

  @Post('hide')
  @HttpCode(200)
  hide(@CurrentUser('id') uid: string) {
    return this.gettingStarted.hide(uid);
  }
}
