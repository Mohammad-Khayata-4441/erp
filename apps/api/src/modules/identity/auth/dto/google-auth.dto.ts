import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleLoginDto {
    @ApiProperty({
        type: 'string',
        description: 'Authorization code from the Google Identity Services popup',
        example: '4/0AeaYSH...',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(2048)
    code!: string;
}

export class GoogleRegisterDto extends GoogleLoginDto {
    @ApiProperty({ type: 'string', example: 'Demo Shop', description: 'Company / organization name' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(200)
    companyName!: string;

    @ApiPropertyOptional({ type: 'string', example: '+963-11-1234567' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone?: string;
}
