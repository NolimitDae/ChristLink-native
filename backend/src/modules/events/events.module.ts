import { Module } from '@nestjs/common';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [WaitlistModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
