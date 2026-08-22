import { Role } from '@prisma/client';

export const DEMO_EMAILS: Record<Role, string> = {
  [Role.manager]:   'shilpi.mittal@globallogic.com',
  [Role.hr]:        'malleswari.arun2@globallogic.com',
  [Role.candidate]: 'satya.mishra@globallogic.com',
};

export const JWT_EXPIRY    = '7d';
export const BCRYPT_ROUNDS = 12;
