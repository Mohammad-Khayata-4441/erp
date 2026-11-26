import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

export type GoogleProfile = {
    sub: string;
    email: string;
    name: string;
    picture?: string;
};

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleProfile> {
    const client = new OAuth2Client(clientId);

    let payload: TokenPayload | undefined;
    try {
        const ticket = await client.verifyIdToken({ idToken, audience: clientId });
        payload = ticket.getPayload();
    } catch {
        throw new UnauthorizedException('Google sign-in failed');
    }

    if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Google sign-in failed');
    }

    if (payload.email_verified !== true) {
        throw new UnauthorizedException('Google account email is not verified');
    }

    return {
        sub: payload.sub,
        email: payload.email.trim(),
        name: payload.name?.trim() || payload.email.trim(),
        picture: payload.picture,
    };
}
