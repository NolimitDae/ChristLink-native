import { Module } from '@nestjs/common';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { RepostsController } from './reposts.controller';
import { RepostsService } from './reposts.service';
import { FlyerReaderService } from './flyer-reader';

@Module({
  imports: [WaitlistModule],
  controllers: [EventsController, RepostsController],
  providers: [EventsService, RepostsService, FlyerReaderService],
})
export class EventsModule {}
