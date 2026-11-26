import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    GOOGLE_CLIENT_ID_PLACEHOLDER,
    GOOGLE_CLIENT_SECRET_PLACEHOLDER,
    GOOGLE_POPUP_REDIRECT_URI,
    GOOGLE_TOKEN_ENDPOINT,
} from './google-auth.constants';
import { verifyGoogleIdToken, type GoogleProfile } from './google-id-token';

@Injectable()
export class GoogleAuthService {
    private readonly logger = new Logger(GoogleAuthService.name);

    constructor(private readonly config: ConfigService) {}

    async exchangeCode(code: string): Promise<GoogleProfile> {
        const clientId = this.configuredValue(this.config.get<string>('google.clientId'), GOOGLE_CLIENT_ID_PLACEHOLDER);
        const clientSecret = this.configuredValue(
            this.config.get<string>('google.clientSecret'),
            GOOGLE_CLIENT_SECRET_PLACEHOLDER,
        );

        if (!clientId || !clientSecret) {
            throw new ServiceUnavailableException('Google sign-in is not configured');
        }

        const body = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: GOOGLE_POPUP_REDIRECT_URI,
            grant_type: 'authorization_code',
        });

        let response: Response;
        try {
            response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
                signal: AbortSignal.timeout(10_000),
            });
        } catch {
            this.logger.warn('Google token endpoint was unreachable');
            throw new UnauthorizedException('Google sign-in failed');
        }

        const raw = await response.text();
        if (!response.ok) {
            this.logger.warn(`Google token exchange was rejected (${response.status})`);
            throw new UnauthorizedException('Google sign-in failed');
        }

        let idToken: string | undefined;
        try {
            idToken = (JSON.parse(raw) as { id_token?: string }).id_token;
        } catch {
            idToken = undefined;
        }

        if (!idToken) {
            throw new UnauthorizedException('Google sign-in failed');
        }

        return verifyGoogleIdToken(idToken, clientId);
    }

    private configuredValue(value: string | undefined, placeholder: string): string | undefined {
        const trimmed = value?.trim();
        if (!trimmed || trimmed === placeholder) return undefined;
        return trimmed;
    }
}
