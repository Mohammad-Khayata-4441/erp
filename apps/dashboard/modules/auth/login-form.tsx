"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/shared/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/components/ui/card"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/shared/components/ui/field"
import { Input } from "@/shared/components/ui/input"
import { useAppStore } from "@/shared/stores/app-store"
import { useAuthStore } from "@/shared/stores/auth-store"
import { cn } from "@/shared/lib/utils"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

import { loginFormSchema, type LoginFormValues } from "./login-form.schema"
import { useMutation } from "@tanstack/react-query"
import { Alert, AlertTitle } from "@/shared/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { api } from "@devloggers/api-client"
import { useState } from "react"
import { describeGoogleAuthError, type GoogleAuthMessages } from "./google-auth"
import { GoogleAuthButton } from "./google-auth-button"

export function LoginForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const t = useTranslations()
    const locale = useLocale()
    const router = useRouter()

    const lastLoginEmail = useAppStore((state) => state.lastLoginEmail)
    const setLastLoginEmail = useAppStore((state) => state.setLastLoginEmail)
    const login = useAuthStore((state) => state.login)

    const localizedHref = (href: string) => (href === "/" ? `/${locale}` : `/${locale}${href}`)

    const {
        handleSubmit,
        register,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginFormSchema),
        defaultValues:
            process.env.NODE_ENV === "development"
                ? {
                      email: "admin@demo-shop.com",
                      password: "admin123",
                  }
                : {
                      email: lastLoginEmail,
                      password: "",
                  },
    })

    const [googleClientError, setGoogleClientError] = useState<unknown>(null)
    const googleMessages: GoogleAuthMessages = {
        notConfigured: t("system.auth.google.notConfigured"),
        notRegistered: t("system.auth.google.notRegistered"),
        failed: t("system.auth.google.failed"),
        scriptFailed: t("system.auth.google.scriptFailed"),
    }

    const { mutate, error, isPending: isSubmitting, reset } = useMutation({
        mutationFn: (values: LoginFormValues) => api.auth.login(values),
        onSuccess: async ({ data }) => {
            if (data?.accessToken && data.user) {
                await login(data.accessToken, data.user)
                router.push(localizedHref("/"))
            }
        },
    })

    const googleLogin = useMutation({
        mutationFn: (code: string) => api.auth.googleLogin({ code }),
        onSuccess: async ({ data }) => {
            if (data?.accessToken && data.user) {
                await login(data.accessToken, data.user)
                setLastLoginEmail(data.user.email)
                router.push(localizedHref("/"))
            }
        },
    })

    const alertMessage = googleLogin.error
        ? describeGoogleAuthError(googleLogin.error, googleMessages)
        : googleClientError
          ? describeGoogleAuthError(googleClientError, googleMessages)
          : error?.message

    async function onSubmit(values: LoginFormValues) {
        setGoogleClientError(null)
        googleLogin.reset()
        setLastLoginEmail(values.email)
        mutate(values)
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <Image
                        className="mx-auto mb-8 object-contain"
                        alt={t("system.common.logoAlt")}
                        src="/assets/logo.png"
                        height={400}
                        width={200}
                    />
                    <CardTitle>{t("system.auth.login.title")}</CardTitle>
                    <CardDescription>{t("system.auth.login.description")}</CardDescription>
                </CardHeader>
                <CardContent>
                    {alertMessage ? (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="me-2 h-4 w-4" />
                            <AlertTitle>{t("system.auth.login.errorTitle")}</AlertTitle>
                            {alertMessage}
                        </Alert>
                    ) : null}

                    <GoogleAuthButton
                        pending={googleLogin.isPending}
                        disabled={isSubmitting}
                        onCode={(code) => {
                            setGoogleClientError(null)
                            reset()
                            googleLogin.mutate(code)
                        }}
                        onError={setGoogleClientError}
                    />

                    <form onSubmit={handleSubmit(onSubmit)} noValidate>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="email">{t("system.auth.login.email")}</FieldLabel>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder={t("system.auth.login.emailPlaceholder")}
                                    aria-invalid={!!errors.email}
                                    {...register("email")}
                                />
                                <FieldError errors={[errors.email]} />
                            </Field>
                            <Field>
                                <div className="flex items-center">
                                    <FieldLabel htmlFor="password">
                                        {t("system.auth.login.password")}
                                    </FieldLabel>
                                    <a
                                        href="#"
                                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                                    >
                                        {t("system.auth.login.forgotPassword")}
                                    </a>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    aria-invalid={!!errors.password}
                                    {...register("password")}
                                />
                                <FieldError errors={[errors.password]} />
                            </Field>
                            <Field>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting
                                        ? t("system.auth.login.submitting")
                                        : t("system.auth.login.submit")}
                                </Button>

                                {lastLoginEmail ? (
                                    <FieldDescription className="text-center">
                                        {t("system.auth.login.lastEmailUsed", {
                                            email: lastLoginEmail,
                                        })}
                                    </FieldDescription>
                                ) : null}
                                <FieldDescription className="text-center">
                                    {t("system.auth.login.noAccount")}{" "}
                                    <Link href="/register" className="underline underline-offset-4">
                                        {t("system.auth.login.registerLink")}
                                    </Link>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
