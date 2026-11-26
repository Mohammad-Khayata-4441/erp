/** Public OAuth client id. Safe to ship to the browser. Replace before enabling Google sign-in. */
export const GOOGLE_CLIENT_ID_PLACEHOLDER = 'replace-with-google-oauth-client-id';

/** OAuth client secret. Stays on the API. Replace before enabling Google sign-in. */
export const GOOGLE_CLIENT_SECRET_PLACEHOLDER = 'replace-with-google-oauth-client-secret';

/**
 * Google Identity Services popup mode exchanges the code with this redirect URI.
 * It is not a URL you register in Google Cloud. Register the dashboard origin
 * under Authorized JavaScript origins instead.
 */
export const GOOGLE_POPUP_REDIRECT_URI = 'postmessage';

export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
