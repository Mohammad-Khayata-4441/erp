import { ApiError } from "@devloggers/api-client"

export const GOOGLE_CLIENT_ID_PLACEHOLDER = "replace-with-google-oauth-client-id"

export type GoogleAuthMessages = {
    notConfigured: string
    notRegistered: string
    failed: string
    scriptFailed: string
}

type GoogleCodeClient = {
    requestCode: () => void
}

type GoogleIdentity = {
    accounts: {
        oauth2: {
            initCodeClient: (config: {
                client_id: string
                scope: string
                ux_mode: "popup"
                callback: (response: { code?: string }) => void
                error_callback?: (error: { type?: string }) => void
            }) => GoogleCodeClient
        }
    }
}

let googleScript: Promise<void> | null = null

export function googleClientId(): string {
    return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || GOOGLE_CLIENT_ID_PLACEHOLDER
}

export function isGoogleAuthConfigured(clientId = googleClientId()): boolean {
    return clientId.length > 0 && clientId !== GOOGLE_CLIENT_ID_PLACEHOLDER
}

export function describeGoogleAuthError(error: unknown, messages: GoogleAuthMessages): string {
    if (error instanceof ApiError) {
        if (error.status === 503) return messages.notConfigured
        if (error.status === 404) return messages.notRegistered
        return error.message || messages.failed
    }

    if (error instanceof Error) {
        if (error.message === "google_not_configured") return messages.notConfigured
        if (error.message === "google_script_failed") return messages.scriptFailed
        if (error.message === "google_failed") return messages.failed
        return error.message || messages.failed
    }

    return messages.failed
}

function googleIdentity(): GoogleIdentity | undefined {
    if (typeof window === "undefined") return undefined
    return (window as Window & { google?: GoogleIdentity }).google
}

export function loadGoogleIdentityScript(): Promise<void> {
    const ready = googleIdentity()
    if (ready) return Promise.resolve()

    if (!googleScript) {
        googleScript = new Promise((resolve, reject) => {
            const script = document.createElement("script")
            script.src = "https://accounts.google.com/gsi/client"
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => {
                googleScript = null
                reject(new Error("google_script_failed"))
            }
            document.head.appendChild(script)
        })
    }

    return googleScript
}

export async function requestGoogleAuthCode(clientId: string): Promise<string> {
    if (!isGoogleAuthConfigured(clientId)) {
        throw new Error("google_not_configured")
    }

    await loadGoogleIdentityScript()
    const google = googleIdentity()
    if (!google) {
        throw new Error("google_script_failed")
    }

    return new Promise((resolve, reject) => {
        let settled = false
        const client = google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: "openid email profile",
            ux_mode: "popup",
            callback: (response) => {
                if (settled) return
                settled = true
                if (!response.code) {
                    reject(new Error("google_failed"))
                    return
                }
                resolve(response.code)
            },
            error_callback: (error) => {
                if (settled) return
                settled = true
                if (error.type === "popup_closed") {
                    reject(new Error("google_popup_closed"))
                    return
                }
                reject(new Error("google_failed"))
            },
        })
        client.requestCode()
    })
}
