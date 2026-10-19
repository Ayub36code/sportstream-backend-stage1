import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: 'Africa/Kampala' })
  @IsOptional()
  @IsString()
  preferredTimezone?: string;

  @ApiPropertyOptional({ example: 'UGX' })
  @IsOptional()
  @IsString()
  preferredCurrency?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  fullName?: string;
}
