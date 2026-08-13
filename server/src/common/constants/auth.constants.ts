import { Role } from '@prisma/client';

// R22 — demo convenience logins; keyed by Role enum
export const DEMO_EMAILS: Record<Role, string> = {
  [Role.manager]:   'prince.verma@fortis.demo',
  [Role.hr]:        'soumyadeep@fortis.demo',
  [Role.candidate]: 'satya.mishra@fortis.demo',
};

export const JWT_EXPIRY    = '7d';
export const BCRYPT_ROUNDS = 12;
