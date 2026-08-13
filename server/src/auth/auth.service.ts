import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  BCRYPT_ROUNDS,
  DEMO_EMAILS,
  JWT_EXPIRY,
} from '../common/constants/auth.constants';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

type SafeUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt:    JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role ?? Role.manager },
    });

    return this.buildResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Constant-time comparison even on not-found to prevent user enumeration
    const hash = user?.passwordHash ?? '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXX';
    const match = await bcrypt.compare(dto.password, hash);
    if (!user || !match) throw new UnauthorizedException('Invalid credentials');

    return this.buildResponse(user);
  }

  async demoLogin(role: Role) {
    const email = DEMO_EMAILS[role];
    if (!email) throw new NotFoundException(`No demo user for role: ${role}`);

    // R22 — demo convenience; seed must be present
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException(`Demo seed user not found. Run db:seed first.`);

    return this.buildResponse(user);
  }

  private buildResponse(user: SafeUser) {
    const { id, name, email, role } = user;
    const token = this.jwt.sign({ sub: id, email, role, name }, { expiresIn: JWT_EXPIRY });
    return { token, user: { id, name, email, role } };
  }
}
