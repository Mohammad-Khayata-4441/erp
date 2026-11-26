import {
    Controller,
    Post,
    Body,
    Get,
    UseGuards,
    Res,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import type * as express from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, GoogleLoginDto, GoogleRegisterDto, LoginDataDto, AuthUserDto, LogoutResponseDto } from './dto';
import { JwtAuthGuard } from './guards';
import { CurrentUser, RequestUser } from './decorators';
import { ApiOkResponseStandard, ApiCreatedResponseStandard, ApiStandardErrors } from '../../../common/decorators/api-swagger.decorators';
import { ApiResponseBuilder } from '../../../common/api/api-response-builder';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Authenticate user', description: 'Validates email + password, returns a JWT access token and sets it as an HTTP-only cookie for subsequent requests.' })
    @ApiOkResponseStandard(LoginDataDto, { description: 'Login successful – JWT token returned and set as cookie' })
    @ApiStandardErrors()
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) res: express.Response,
    ) {
        const result = await this.authService.login(dto.email, dto.password);
        return this.sessionResponse(res, result, 'Login successful');
    }

    @Post('google/login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Sign in with Google',
        description:
            'Exchanges a Google authorization code, links the verified Google account when the email already belongs to a user, and returns a JWT access token.',
    })
    @ApiOkResponseStandard(LoginDataDto, { description: 'Google login successful – JWT token returned and set as cookie' })
    @ApiStandardErrors()
    async loginWithGoogle(
        @Body() dto: GoogleLoginDto,
        @Res({ passthrough: true }) res: express.Response,
    ) {
        const result = await this.authService.loginWithGoogle(dto.code);
        return this.sessionResponse(res, result, 'Login successful');
    }

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Register a new account',
        description: 'Creates a new tenant with an admin user, then returns a JWT access token (auto-login).',
    })
    @ApiCreatedResponseStandard(LoginDataDto, { description: 'Registration successful – tenant created and JWT returned' })
    @ApiStandardErrors()
    async register(
        @Body() dto: RegisterDto,
        @Res({ passthrough: true }) res: express.Response,
    ) {
        const result = await this.authService.register(dto);
        return this.sessionResponse(res, result, 'Registration successful');
    }

    @Post('google/register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Register with Google',
        description:
            'Verifies a Google authorization code, creates a tenant and admin user without a password, and returns a JWT access token.',
    })
    @ApiCreatedResponseStandard(LoginDataDto, { description: 'Google registration successful – tenant created and JWT returned' })
    @ApiStandardErrors()
    async registerWithGoogle(
        @Body() dto: GoogleRegisterDto,
        @Res({ passthrough: true }) res: express.Response,
    ) {
        const result = await this.authService.registerWithGoogle(dto.code, dto.companyName, dto.phone);
        return this.sessionResponse(res, result, 'Registration successful');
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Logout user', description: 'Clears the access_token HTTP-only cookie, effectively invalidating the session on the client side.' })
    @ApiOkResponse({ type: LogoutResponseDto, description: 'Logged out – cookie cleared' })
    @ApiStandardErrors()
    logout(@Res({ passthrough: true }) res: express.Response) {
        res.clearCookie('access_token');
        return ApiResponseBuilder.success(null, 'Logged out');
    }

    // Authenticated-only: every signed-in user must be able to read their own
    // profile (which also returns their effective permissions).
    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Get current user profile',
        description: 'Returns the full profile of the currently authenticated user based on the JWT token.'
    })
    @ApiOkResponseStandard(AuthUserDto, { description: 'Current user profile returned' })
    @ApiStandardErrors()
    async me(@CurrentUser() user: RequestUser) {
        const data = await this.authService.getMe(user.id);
        return ApiResponseBuilder.success(data, 'Current user');
    }

    private sessionResponse(
        res: express.Response,
        result: { accessToken: string; user: AuthUserDto },
        message: string,
    ) {
        res.cookie('access_token', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        });

        return ApiResponseBuilder.success(
            { user: result.user, accessToken: result.accessToken },
            message,
        );
    }
}
