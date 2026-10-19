import { Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../database/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return plainToInstance(UserResponseDto, user);
  }

  async updatePreferences(
    id: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return plainToInstance(UserResponseDto, user);
  }

  /**
   * Soft-deletes the account: anonymizes PII, revokes sessions, and marks the
   * record DELETED rather than hard-deleting, to preserve financial /
   * audit-trail integrity (payments, entitlements history).
   */
  async deleteAccount(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId: id },
        data: { isRevoked: true },
      }),
      this.prisma.user.update({
        where: { id },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          email: null,
          phone: null,
          fullName: null,
        },
      }),
    ]);
  }
}
