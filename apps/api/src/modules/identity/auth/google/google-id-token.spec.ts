import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { verifyGoogleIdToken } from './google-id-token';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
    OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    })),
}));

describe('verifyGoogleIdToken', () => {
    beforeEach(() => {
        mockVerifyIdToken.mockReset();
        jest.mocked(OAuth2Client).mockClear();
    });

    it('returns the verified profile', async () => {
        mockVerifyIdToken.mockResolvedValue({
            getPayload: () => ({
                sub: 'sub-1',
                email: 'ada@example.com',
                email_verified: true,
                name: 'Ada Lovelace',
                picture: 'https://example.com/ada.png',
            }),
        });

        await expect(verifyGoogleIdToken('id-token', 'client-id')).resolves.toEqual({
            sub: 'sub-1',
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            picture: 'https://example.com/ada.png',
        });
        expect(mockVerifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: 'client-id' });
    });

    it('rejects an unverified Google email', async () => {
        mockVerifyIdToken.mockResolvedValue({
            getPayload: () => ({
                sub: 'sub-1',
                email: 'ada@example.com',
                email_verified: false,
                name: 'Ada',
            }),
        });

        await expect(verifyGoogleIdToken('id-token', 'client-id')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an id token Google will not verify', async () => {
        mockVerifyIdToken.mockRejectedValue(new Error('bad token'));

        await expect(verifyGoogleIdToken('id-token', 'client-id')).rejects.toBeInstanceOf(UnauthorizedException);
    });
});
