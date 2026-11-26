"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/shared/components/ui/button"
import { googleClientId, requestGoogleAuthCode } from "./google-auth"

function GoogleMark() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
            <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.64Z"
            />
            <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.86-3c-1.07.72-2.45 1.16-4.09 1.16-3.14 0-5.8-2.12-6.75-4.97H1.26v3.09A12 12 0 0 0 12 24Z"
            />
            <path
                fill="#FBBC05"
                d="M5.25 14.28A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.56.38-2.28V6.63H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.37l3.99-3.09Z"
            />
            <path
                fill="#EA4335"
                d="M12 4.75c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.95 1.14 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.63l3.99 3.09C6.2 6.87 8.86 4.75 12 4.75Z"
            />
        </svg>
    )
}

type GoogleAuthButtonProps = {
    disabled?: boolean
    pending?: boolean
    onBeforeRequest?: () => boolean | Promise<boolean>
    onCode: (code: string) => void
    onError: (error: unknown) => void
}

export function GoogleAuthButton({
    disabled = false,
    pending = false,
    onBeforeRequest,
    onCode,
    onError,
}: GoogleAuthButtonProps) {
    const t = useTranslations()
    const [opening, setOpening] = useState(false)
    const busy = disabled || pending || opening

    async function onClick() {
        if (onBeforeRequest) {
            const ready = await onBeforeRequest()
            if (!ready) return
        }

        setOpening(true)
        try {
            const code = await requestGoogleAuthCode(googleClientId())
            onCode(code)
        } catch (error) {
            if (!(error instanceof Error) || error.message !== "google_popup_closed") {
                onError(error)
            }
        } finally {
            setOpening(false)
        }
    }

    return (
        <div className="mb-2 flex flex-col gap-4">
            <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={onClick}>
                <GoogleMark />
                {busy ? t("system.auth.google.waiting") : t("system.auth.google.continue")}
            </Button>
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("system.auth.google.or")}</span>
                </div>
            </div>
        </div>
    )
}
