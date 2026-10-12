import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { Role } from '../users/user.entity';
import { SessionUser } from './session-user';

interface JwtPayload {
  sub: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // El token va en una cookie httpOnly: el navegador nunca lo ve
      jwtFromRequest: (req: Request) =>
        (req.cookies?.session as string | undefined) ?? null,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): SessionUser {
    return { id: payload.sub, role: payload.role };
  }
}
