import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@devloggers/db-prisma';
import { PrismaService } from '@devloggers/db-prisma/nest';
import * as bcrypt from 'bcryptjs';
import { JwtPayload } from './strategies/jwt.strategy';
import { RegisterDto } from './dto';
import { TenantsService } from '../tenants/tenants.service';
import { toLocalizedString } from '@/common/i18n/localized-string';
import { GoogleAuthService } from './google/google-auth.service';
import type { GoogleProfile } from './google/google-id-token';

const userAuthInclude = {
    userRoles: {
        include: {
            role: {
                include: {
                    rolePermissions: { include: { permission: true } },
                },
            },
        },
    },
    tenant: {
        select: {
            id: true,
            name: true,
            slug: true,
            onboardingStep: true,
            onboardingCompletedAt: true,
        },
    },
} satisfies Prisma.AppUserInclude;

type AuthUserRecord = Prisma.AppUserGetPayload<{ include: typeof userAuthInclude }>;

function isUniqueConstraintError(error: unknown): boolean {
    return error != null && typeof error === 'object' && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly tenantsService: TenantsService,
        private readonly googleAuth: GoogleAuthService,
    ) { }

    async validateUser(email: string, password: string) {
        const user = await this.findUserForAuth({ email });

        if (!user?.passwordHash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }

    private resolveRoleName(name: Prisma.JsonValue | null | undefined): string {
        if (typeof name === 'string') {
            return name;
        }

        const localized = toLocalizedString(name);
        return localized?.en ?? localized?.ar ?? '';
    }

    private buildPermissions(user: {
        userRoles: Array<{ role: { rolePermissions: Array<{ permission: { key: string } }> } }>;
    }): string[] {
        const keys = new Set<string>();
        for (const userRole of user.userRoles) {
            for (const rolePermission of userRole.role.rolePermissions) {
                keys.add(rolePermission.permission.key);
            }
        }
        return [...keys].sort();
    }

    private buildAuthUser(user: {
        id: string;
        tenantId: string;
        email: string;
        fullName: string;
        phone: string | null;
        avatarUrl: string | null;
        userRoles: Array<{ role: { name: Prisma.JsonValue; rolePermissions: Array<{ permission: { key: string } }> } }>;
        tenant: {
            id: string;
            name: string;
            slug: string;
            onboardingStep: number;
            onboardingCompletedAt: Date | null;
        };
    }) {
        return {
            id: user.id,
            tenantId: user.tenantId,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            roles: user.userRoles.map((ur) => this.resolveRoleName(ur.role.name)),
            permissions: this.buildPermissions(user),
            tenant: {
                id: user.tenant.id,
                name: user.tenant.name,
                slug: user.tenant.slug,
                onboardingStep: user.tenant.onboardingStep,
                onboardingCompletedAt: user.tenant.onboardingCompletedAt?.toISOString() ?? null,
            },
        };
    }

    async register(dto: RegisterDto) {
        const existingUser = await this.prisma.appUser.findFirst({
            where: { email: dto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        const slug = await this.tenantsService.generateUniqueSlug(dto.companyName);

        await this.tenantsService.create({
            name: dto.companyName,
            slug,
            email: dto.email,
            phone: dto.phone,
            adminEmail: dto.email,
            adminPassword: dto.password,
            adminFullName: dto.fullName,
        });

        return this.login(dto.email, dto.password);
    }

    async loginWithGoogle(code: string) {
        const profile = await this.googleAuth.exchangeCode(code);
        const linked = await this.findUserForAuth({ googleSub: profile.sub });
        const user = linked ?? (await this.findUserForAuth({
            email: { equals: profile.email, mode: 'insensitive' },
        }));

        if (!user) {
            throw new NotFoundException('No account is linked to this Google user');
        }

        if (user.googleSub && user.googleSub !== profile.sub) {
            throw new UnauthorizedException('Google sign-in failed');
        }

        if (!user.googleSub) {
            await this.linkGoogleAccount(user, profile);
        }

        return this.issueSession(user);
    }

    async registerWithGoogle(code: string, companyName: string, phone?: string) {
        const profile = await this.googleAuth.exchangeCode(code);
        const existing = await this.prisma.appUser.findFirst({
            where: {
                OR: [
                    { email: { equals: profile.email, mode: 'insensitive' } },
                    { googleSub: profile.sub },
                ],
            },
        });

        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const slug = await this.tenantsService.generateUniqueSlug(companyName);
        await this.tenantsService.createGoogleTenant({
            name: companyName,
            slug,
            email: profile.email,
            phone,
            adminEmail: profile.email,
            adminFullName: profile.name,
            googleSub: profile.sub,
            avatarUrl: profile.picture,
        });

        const user = await this.findUserForAuth({ googleSub: profile.sub });
        if (!user) {
            throw new UnauthorizedException('Google sign-in failed');
        }

        return this.issueSession(user);
    }

    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);
        return this.issueSession(user);
    }

    private async issueSession(user: AuthUserRecord) {
        const payload: JwtPayload = {
            sub: user.id,
            tenantId: user.tenantId,
            email: user.email,
        };

        const accessToken = this.jwtService.sign(payload);

        await this.prisma.appUser.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        return {
            accessToken,
            user: this.buildAuthUser(user),
        };
    }

    private findUserForAuth(where: Prisma.AppUserWhereInput) {
        return this.prisma.appUser.findFirst({
            where: { AND: [where, { isActive: true }] },
            include: userAuthInclude,
        });
    }

    private async linkGoogleAccount(user: AuthUserRecord, profile: GoogleProfile) {
        try {
            await this.prisma.appUser.update({
                where: { id: user.id },
                data: {
                    googleSub: profile.sub,
                    ...(user.avatarUrl || !profile.picture ? {} : { avatarUrl: profile.picture }),
                },
            });
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                throw new ConflictException('Email already registered');
            }
            throw error;
        }

        user.googleSub = profile.sub;
        if (!user.avatarUrl && profile.picture) {
            user.avatarUrl = profile.picture;
        }
    }

    async getMe(userId: string) {
        const user = await this.prisma.appUser.findUnique({
            where: { id: userId },
            include: userAuthInclude,
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return this.buildAuthUser(user);
    }
}
