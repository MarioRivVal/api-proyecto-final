import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    const passwordOk =
      user !== null && (await bcrypt.compare(password, user.passwordHash));

    // Mismo error si no existe o si la contraseña falla: no se dice qué emails hay
    if (!user || !passwordOk) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    return { token, user };
  }
}
