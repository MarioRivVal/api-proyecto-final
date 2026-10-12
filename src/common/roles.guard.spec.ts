import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionUser } from '../auth/session-user';
import { RolesGuard } from './roles.guard';

function contextWith(user: SessionUser | undefined) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('deja pasar si la ruta no pide ningún rol', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextWith(undefined))).toBe(true);
  });

  it('deja pasar al admin en una ruta de admin', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const admin: SessionUser = { id: '1', role: 'ADMIN' };
    expect(guard.canActivate(contextWith(admin))).toBe(true);
  });

  it('no deja pasar a un atleta en una ruta de admin', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const athlete: SessionUser = { id: '2', role: 'ATHLETE' };
    expect(guard.canActivate(contextWith(athlete))).toBe(false);
  });

  it('no deja pasar si no hay sesión', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(guard.canActivate(contextWith(undefined))).toBe(false);
  });
});
