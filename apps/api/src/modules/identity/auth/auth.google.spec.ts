import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { GoogleProfile } from './google/google-id-token';

const profile: GoogleProfile = {
    sub: 'sub-1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    picture: 'https://example.com/ada.png',
};

function userRecord(overrides: Record<string, unknown> = {}) {
    return {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'ada@example.com',
        fullName: 'Ada Lovelace',
        phone: null,
        avatarUrl: null,
        passwordHash: 'hash',
        googleSub: null,
        isActive: true,
        userRoles: [
            {
                role: {
                    name: { en: 'Owner', ar: 'المالك' },
                    rolePermissions: [{ permission: { key: 'invoices.view' } }],
                },
            },
        ],
        tenant: {
            id: 'tenant-1',
            name: 'Demo Shop',
            slug: 'demo-shop',
            onboardingStep: 0,
            onboardingCompletedAt: null,
        },
        ...overrides,
    };
}

function createService() {
    const prisma = {
        appUser: {
            findFirst: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
        },
    };
    const jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
    const tenantsService = {
        generateUniqueSlug: jest.fn().mockResolvedValue('demo-shop'),
        createGoogleTenant: jest.fn().mockResolvedValue({}),
    };
    const googleAuth = { exchangeCode: jest.fn().mockResolvedValue(profile) };
    const service = new AuthService(
        prisma as never,
        jwtService as never,
        tenantsService as never,
        googleAuth as never,
    );

    return { service, prisma, jwtService, tenantsService, googleAuth };
}

describe('AuthService Google sign-in', () => {
    it('links a password account when the verified Google email matches', async () => {
        const { service, prisma, jwtService } = createService();
        prisma.appUser.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(userRecord());

        const result = await service.loginWithGoogle('auth-code');

        expect(result.accessToken).toBe('signed-token');
        expect(result.user.email).toBe('ada@example.com');
        expect(prisma.appUser.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'user-1' },
                data: { googleSub: 'sub-1', avatarUrl: 'https://example.com/ada.png' },
            }),
        );
        expect(jwtService.sign).toHaveBeenCalledWith({
            sub: 'user-1',
            tenantId: 'tenant-1',
            email: 'ada@example.com',
        });
    });

    it('signs in a user who is already linked to this Google account', async () => {
        const { service, prisma } = createService();
        prisma.appUser.findFirst.mockResolvedValueOnce(userRecord({ googleSub: 'sub-1' }));

        await service.loginWithGoogle('auth-code');

        expect(prisma.appUser.update).toHaveBeenCalledTimes(1);
        expect(prisma.appUser.update.mock.calls[0][0].data).toEqual(
            expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        );
    });

    it('tells the client to register when no account matches', async () => {
        const { service, prisma } = createService();
        prisma.appUser.findFirst.mockResolvedValue(null);

        await expect(service.loginWithGoogle('auth-code')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to link an email that already belongs to a different Google account', async () => {
        const { service, prisma } = createService();
        prisma.appUser.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(userRecord({ googleSub: 'other-sub' }));

        await expect(service.loginWithGoogle('auth-code')).rejects.toBeInstanceOf(UnauthorizedException);
        expect(prisma.appUser.update).not.toHaveBeenCalled();
    });

    it('turns a unique google sub collision into a conflict', async () => {
        const { service, prisma } = createService();
        prisma.appUser.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(userRecord());
        prisma.appUser.update.mockRejectedValueOnce({ code: 'P2002' });

        await expect(service.loginWithGoogle('auth-code')).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a tenant from the Google profile and signs the new admin in', async () => {
        const { service, prisma, tenantsService } = createService();
        prisma.appUser.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(userRecord({ googleSub: 'sub-1', passwordHash: null }));

        const result = await service.registerWithGoogle('auth-code', 'Demo Shop', '+963');

        expect(tenantsService.createGoogleTenant).toHaveBeenCalledWith({
            name: 'Demo Shop',
            slug: 'demo-shop',
            email: 'ada@example.com',
            phone: '+963',
            adminEmail: 'ada@example.com',
            adminFullName: 'Ada Lovelace',
            googleSub: 'sub-1',
            avatarUrl: 'https://example.com/ada.png',
        });
        expect(result.accessToken).toBe('signed-token');
        expect(result.user.permissions).toEqual(['invoices.view']);
    });

    it('does not open a second tenant when the Google email is already registered', async () => {
        const { service, prisma, tenantsService } = createService();
        prisma.appUser.findFirst.mockResolvedValueOnce(userRecord());

        await expect(service.registerWithGoogle('auth-code', 'Demo Shop')).rejects.toBeInstanceOf(ConflictException);
        expect(tenantsService.createGoogleTenant).not.toHaveBeenCalled();
    });

    it('rejects password login for a Google-only account', async () => {
        const { service, prisma, jwtService } = createService();
        prisma.appUser.findFirst.mockResolvedValue(userRecord({ passwordHash: null }));

        await expect(service.login('ada@example.com', 'password1')).rejects.toBeInstanceOf(UnauthorizedException);
        expect(jwtService.sign).not.toHaveBeenCalled();
    });
});
