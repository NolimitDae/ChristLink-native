import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { Admin, Public } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

class VerseDto {
  @IsOptional() @IsString() @Length(1, 100) reference?: string;
  @IsOptional() @IsString() @Length(1, 2000) text?: string;
  @IsOptional() @IsString() @MaxLength(20) translation?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) themes?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

// Small enough that the controller talks to Prisma directly.
@Controller()
export class VersesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** verse_of_the_day(theme), kept in the database. Sends JSON null when there are no active verses. */
  @Get('verses/today')
  @Public()
  async today(@Query('theme') theme: string | undefined, @Res() res: Response) {
    const t = typeof theme === 'string' && theme.trim() ? theme.trim().toLowerCase() : null;
    // Same verse for everyone all day: cache per theme and UTC date for 10 minutes (admin edits show within that)
    const day = new Date().toISOString().slice(0, 10);
    const verse = await this.cache.getOrSet('verse', `${day}:${t ?? '-'}`, 600, async () => {
      const rows = await this.prisma.$queryRaw<{ reference: string; text: string; translation: string }[]>`
        select reference, text, translation from public.verse_of_the_day(${t}::text)`;
      return rows[0] ?? null;
    });
    res.json(verse);
  }

  @Get('admin/verses')
  @Admin()
  list() {
    return this.prisma.verses.findMany({ orderBy: { id: 'asc' } });
  }

  @Post('admin/verses')
  @Admin()
  @HttpCode(200)
  async create(@Body() b: VerseDto) {
    if (!b.reference?.trim() || !b.text?.trim()) throw new BadRequestException('Reference and text are required.');
    const row = await this.prisma.verses.create({
      data: { reference: b.reference.trim(), text: b.text.trim(), translation: b.translation ?? 'WEB', themes: b.themes ?? [], active: b.active ?? true },
    });
    await this.cache.bump('verse');
    return row;
  }

  @Patch('admin/verses/:id')
  @Admin()
  async update(@Param('id', ParseIntPipe) id: number, @Body() b: VerseDto) {
    if (!(await this.prisma.verses.findUnique({ where: { id } }))) throw new NotFoundException('Verse not found.');
    const row = await this.prisma.verses.update({ where: { id }, data: b });
    await this.cache.bump('verse');
    return row;
  }
}
