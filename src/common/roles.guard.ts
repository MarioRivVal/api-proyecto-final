import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SessionUser } from '../auth/session-user';
import { Role } from '../users/user.entity';
import { ROLES_KEY } from './roles.decorator';

// Va siempre después de JwtAuthGuard, que es quien rellena request.user
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles) return true;

    const user = context.switchToHttp().getRequest<Request>().user as
      SessionUser | undefined;
    return user !== undefined && roles.includes(user.role);
  }
}
