import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { GOOGLE_CLIENT_ID_PLACEHOLDER, GOOGLE_CLIENT_SECRET_PLACEHOLDER } from './google-auth.constants';
import { verifyGoogleIdToken } from './google-id-token';

jest.mock('./google-id-token', () => ({
    verifyGoogleIdToken: jest.fn(),
}));

const verifyGoogleIdTokenMock = verifyGoogleIdToken as jest.MockedFunction<typeof verifyGoogleIdToken>;

function configWith(values: Record<string, string | undefined>) {
    return { get: (key: string) => values[key] } as never;
}

describe('GoogleAuthService', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        verifyGoogleIdTokenMock.mockReset();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    function service(clientId = 'client-id', clientSecret = 'client-secret') {
        return new GoogleAuthService(
            configWith({
                'google.clientId': clientId,
                'google.clientSecret': clientSecret,
            }),
        );
    }

    it('refuses to call Google while the credentials are still placeholders', async () => {
        await expect(
            service(GOOGLE_CLIENT_ID_PLACEHOLDER, GOOGLE_CLIENT_SECRET_PLACEHOLDER).exchangeCode('code'),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('exchanges the popup code with the client secret and verifies the id token', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ id_token: 'id-token' }),
        });
        verifyGoogleIdTokenMock.mockResolvedValue({
            sub: 'sub-1',
            email: 'ada@example.com',
            name: 'Ada',
        });

        const profile = await service().exchangeCode('auth-code');

        expect(profile.email).toBe('ada@example.com');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://oauth2.googleapis.com/token',
            expect.objectContaining({ method: 'POST' }),
        );
        const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
        expect(body.get('code')).toBe('auth-code');
        expect(body.get('client_id')).toBe('client-id');
        expect(body.get('client_secret')).toBe('client-secret');
        expect(body.get('redirect_uri')).toBe('postmessage');
        expect(body.get('grant_type')).toBe('authorization_code');
        expect(verifyGoogleIdTokenMock).toHaveBeenCalledWith('id-token', 'client-id');
    });

    it('hides Google rejection details from the caller', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ error: 'invalid_grant' }),
        });

        await expect(service().exchangeCode('bad-code')).rejects.toBeInstanceOf(UnauthorizedException);
        expect(verifyGoogleIdTokenMock).not.toHaveBeenCalled();
    });

    it('maps a network failure to a sign-in failure', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));

        await expect(service().exchangeCode('auth-code')).rejects.toBeInstanceOf(UnauthorizedException);
    });
});
