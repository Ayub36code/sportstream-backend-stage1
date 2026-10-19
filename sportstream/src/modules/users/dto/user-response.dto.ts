import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose() @ApiProperty() id: string;
  @Expose() @ApiProperty({ required: false }) email?: string | null;
  @Expose() @ApiProperty({ required: false }) phone?: string | null;
  @Expose() @ApiProperty({ required: false }) fullName?: string | null;
  @Expose() @ApiProperty() role: string;
  @Expose() @ApiProperty() status: string;
  @Expose() @ApiProperty() preferredTimezone: string;
  @Expose() @ApiProperty() preferredCurrency: string;
  @Expose() @ApiProperty() createdAt: Date;
  // passwordHash is intentionally NOT exposed
}
