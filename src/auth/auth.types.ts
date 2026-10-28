import { UserRole } from '@prisma/client';

/**
 * The authenticated principal attached to `request.user` by the JWT guard.
 * Never contains the password hash.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}
