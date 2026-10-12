import { Role } from '../users/user.entity';

// Lo que viaja dentro del token y llega a los controllers como request.user
export interface SessionUser {
  id: string;
  role: Role;
}
