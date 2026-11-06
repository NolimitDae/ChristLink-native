import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';

class GoingDto {
  @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) event_ids: string[];
}

/** Friends = mutual follows. Ports of friends_going(), friends_this_week() and my_friends(). */
@Controller('friends')
export class FriendsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  mine(@CurrentUser('id') uid: string) {
    return this.prisma.$queryRaw`
      select p.id, p.full_name, p.avatar_url, p.avatar_color
        from public.user_follows f1
        join public.user_follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
        join public.profiles p on p.id = f1.following_id
       where f1.follower_id = ${uid}::uuid
       order by p.full_name`;
  }

  @Post('going')
  @HttpCode(200)
  async going(@CurrentUser('id') uid: string, @Body() body: GoingDto) {
    if (body.event_ids.length === 0) return [];
    return this.prisma.$queryRaw`
      with friends as (
        select f1.following_id as fid from public.user_follows f1
        join public.user_follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
        where f1.follower_id = ${uid}::uuid
      ),
      going as (
        select r.event_id, r.user_id from public.rsvps r
         where r.event_id = any (${body.event_ids}::uuid[]) and r.status = 'confirmed' and r.user_id in (select fid from friends)
        union
        select t.event_id, t.user_id from public.tickets t
         where t.event_id = any (${body.event_ids}::uuid[]) and t.status = 'confirmed' and t.user_id in (select fid from friends)
      )
      select g.event_id, count(*)::int as friend_count,
             coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name,
                                                   'avatar_url', p.avatar_url, 'avatar_color', p.avatar_color)
                      order by p.full_name) filter (where p.id is not null), '[]'::jsonb) as friends
        from going g join public.profiles p on p.id = g.user_id
       group by g.event_id`;
  }

  @Get('this-week')
  thisWeek(@CurrentUser('id') uid: string) {
    return this.prisma.$queryRaw`
      with friends as (
        select f1.following_id as fid from public.user_follows f1
        join public.user_follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
        where f1.follower_id = ${uid}::uuid
      ),
      going as (
        select r.event_id, r.user_id from public.rsvps r where r.status = 'confirmed' and r.user_id in (select fid from friends)
        union
        select t.event_id, t.user_id from public.tickets t where t.status = 'confirmed' and t.user_id in (select fid from friends)
      )
      select e.id as event_id, e.name as event_name, e.start_date, e.cover_url,
             jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name,
                                          'avatar_url', p.avatar_url, 'avatar_color', p.avatar_color)) as friends
        from going g
        join public.events e on e.id = g.event_id
        join public.profiles p on p.id = g.user_id
       where e.status = 'published' and e.start_date between now() and now() + interval '7 days'
       group by e.id, e.name, e.start_date, e.cover_url
       order by e.start_date
       limit 10`;
  }
}
