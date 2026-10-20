import { Module } from '@nestjs/common';
import { VersesController } from './verses.controller';

@Module({ controllers: [VersesController] })
export class VersesModule {}
