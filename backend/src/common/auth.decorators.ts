import { createParamDecorator, ExecutionContext, SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

export const IS_PUBLIC = 'isPublic';
export const OPTIONAL_AUTH = 'optionalAuth';

export interface AuthUser {
  id: string;
  email: string;
}

/** No token needed (the guard skips the route entirely). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Token optional: req.user is set when a valid token is sent, otherwise undefined. */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH, true);
/** Signed-in user whose profiles.role is 'admin'. */
export const Admin = () => applyDecorators(UseGuards(AdminGuard));

/** `@CurrentUser() user: AuthUser` or `@CurrentUser('id') userId: string`. */
export const CurrentUser = createParamDecorator((field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
  return field ? user?.[field] : user;
});
