import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(role?: UserRole): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () =>
        role ? { user: { id: 'u1', email: 'u@example.com', name: null, role } } : {},
    }),
  } as unknown as ExecutionContext;
}

function guardWithRoles(roles?: UserRole[]): RolesGuard {
  return new RolesGuard({
    getAllAndOverride: () => roles,
  } as unknown as Reflector);
}

describe('RolesGuard', () => {
  it('allows routes without role metadata', () => {
    expect(guardWithRoles(undefined).canActivate(contextWithUser())).toBe(true);
  });

  it('allows a user whose role is required', () => {
    expect(
      guardWithRoles([UserRole.ADMIN, UserRole.OPERATOR]).canActivate(
        contextWithUser(UserRole.OPERATOR),
      ),
    ).toBe(true);
  });

  it('forbids a user without a required role', () => {
    expect(() =>
      guardWithRoles([UserRole.ADMIN]).canActivate(contextWithUser(UserRole.VIEWER)),
    ).toThrow(ForbiddenException);
  });

  it('forbids missing authenticated users on protected role routes', () => {
    expect(() => guardWithRoles([UserRole.OPERATOR]).canActivate(contextWithUser())).toThrow(
      ForbiddenException,
    );
  });
});
