import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Admin, CurrentUser } from '../../common/auth.decorators';
import { REPORT_REASONS, REPORT_TARGETS, ReportsService } from './reports.service';

class ReportDto {
  @IsIn(REPORT_TARGETS) target_type: string;
  @IsUUID() target_id: string;
  @IsIn(REPORT_REASONS) reason: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string | null;
}
class BlockDto {
  @IsUUID() user_id: string;
}
class ResolveDto {
  @IsIn(['dismiss', 'remove']) action: 'dismiss' | 'remove';
}

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('reports')
  @HttpCode(200)
  report(@CurrentUser('id') uid: string, @Body() body: ReportDto) {
    return this.reports.report(uid, body);
  }

  @Get('blocks')
  blocked(@CurrentUser('id') uid: string) {
    return this.reports.blockedIds(uid);
  }

  @Post('blocks')
  @HttpCode(200)
  block(@CurrentUser('id') uid: string, @Body() body: BlockDto) {
    return this.reports.block(uid, body.user_id);
  }

  @Delete('blocks/:userId')
  unblock(@CurrentUser('id') uid: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.reports.unblock(uid, userId);
  }

  @Get('admin/reports')
  @Admin()
  queue() {
    return this.reports.queue();
  }

  @Post('admin/reports/:id/resolve')
  @Admin()
  @HttpCode(200)
  resolve(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: ResolveDto) {
    return this.reports.resolve(uid, id, body.action);
  }
}
