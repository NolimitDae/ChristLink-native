import { Module } from '@nestjs/common';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { RsvpController } from './rsvp.controller';
import { RsvpService } from './rsvp.service';

@Module({
  imports: [WaitlistModule],
  controllers: [RsvpController],
  providers: [RsvpService],
})
export class RsvpModule {}
