import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashRefreshToken(token: string): string {
    // Refresh tokens are opaque + hashed at rest, same pattern as passwords
    // in spirit but cheaper: they're high-entropy random values, not
    // user-chosen secrets, so SHA-256 is appropriate here (not argon2).
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokenPair(
    userId: string,
    role: string,
    email: string | null,
    context: { userAgent?: string; ipAddress?: string; deviceLabel?: string },
    rotatedFromSessionId?: string,
  ): Promise<IssuedTokens> {
    const accessTtl = this.config.get<string>('jwt.accessTtl');
    const refreshTtl = this.config.get<string>('jwt.refreshTtl');

    const accessToken = await this.jwt.signAsync(
      { sub: userId, role, email },
      { secret: this.config.get('jwt.accessSecret'), expiresIn: accessTtl },
    );

    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + this.parseTtlToSeconds(refreshTtl),
    );

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        deviceLabel: context.deviceLabel,
        expiresAt,
        rotatedFromSessionId,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.parseTtlToSeconds(accessTtl),
    };
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * multipliers[unit];
  }

  async register(
    dto: RegisterDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    if (!dto.email && !dto.phone) {
      throw new ConflictException('Either email or phone is required');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });
    if (existing) {
      throw new ConflictException(
        'An account with this email or phone already exists',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
      },
    });

    // NOTE: this stage does not wire up email/SMS delivery of the
    // verification token — that lands with the notifications module.
    // Account remains PENDING_VERIFICATION until verified.

    return this.issueTokenPair(user.id, user.role, user.email, context);
  }

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    if (!dto.email && !dto.phone) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findFirst({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
    });

    // Constant-shape response whether or not the account exists, to avoid
    // user enumeration via timing/response differences.
    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$dGhpc2lzYWZha2VoYXNo';
    const isValid = await argon2.verify(
      user?.passwordHash ?? dummyHash,
      dto.password,
    );

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new UnauthorizedException('Account is not active');
    }

    return this.issueTokenPair(user.id, user.role, user.email, context);
  }

  async refresh(
    rawRefreshToken: string,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: tokenHash, isRevoked: false },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Rotation: revoke the presented token immediately. If it's ever
    // presented again, that's a signal of token theft/replay.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    return this.issueTokenPair(
      session.user.id,
      session.user.role,
      session.user.email,
      context,
      session.id,
    );
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: tokenHash },
      data: { isRevoked: true },
    });
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }
}
