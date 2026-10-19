import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsPhoneNumber,
  IsString,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+256700000000' })
  @ValidateIf((o) => !o.email)
  @IsPhoneNumber()
  phone?: string;

  @IsString()
  password: string;
}
