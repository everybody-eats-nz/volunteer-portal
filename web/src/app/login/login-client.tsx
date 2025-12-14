"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { motion, Variants } from "motion/react";
import { MotionSpinner } from "@/components/motion-spinner";
import { MotionFormError, MotionFormSuccess } from "@/components/motion-form";
import { MotionPageContainer } from "@/components/motion-page-container";
import { MotionCard } from "@/components/motion-card";
import type { Provider } from "@/lib/auth-providers";
import {
  isPasskeySupported,
  authenticateWithPasskey,
  getPasskeyMessage,
  getPasskeyErrorMessage,
} from "@/lib/passkey-client";
import { Fingerprint } from "lucide-react";

interface LoginClientProps {
  providers: Provider[];
}

// Animation variants for staggered button animations
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

const formFieldVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export default function LoginClient({ providers }: LoginClientProps) {
  const [email, setEmail] = useState(
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
      ? "volunteer@example.com"
      : ""
  );
  const [password, setPassword] = useState(
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? "volunteer123" : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  // Check passkey support on mount (client-side only)
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isPasskeySupported();
      setPasskeySupported(supported);
    };
    checkSupport();
  }, []);

  // Redirect to appropriate page if already logged in
  useEffect(() => {
    if (status === "authenticated" && session) {
      const callbackUrl = searchParams.get("callbackUrl");
      if (callbackUrl) {
        // Use the callback URL if provided
        router.push(callbackUrl);
      } else {
        // Redirect admins to admin dashboard, volunteers to regular dashboard
        const redirectPath =
          session.user?.role === "ADMIN" ? "/admin" : "/dashboard";
        router.push(redirectPath);
      }
    }
  }, [session, status, router, searchParams]);

  // Derive initial messages from URL parameters
  const initialMessages = useMemo(() => {
    const message = searchParams.get("message");
    const urlEmail = searchParams.get("email");
    const verified = searchParams.get("verified");
    const authError = searchParams.get("error");

    let errorMsg: string | null = null;
    let successMsg: string | null = null;
    let emailValue: string | null = null;
    let clearPassword = false;

    // Check for authentication errors first
    if (authError === "CredentialsSignin") {
      errorMsg =
        "Invalid credentials. Please check your email and password and try again.";
    }

    if (message === "registration-success") {
      successMsg =
        "Registration successful! You can now sign in with your new account.";
      clearPassword = true;
    } else if (message === "verify-email") {
      successMsg =
        "Registration successful! Please check your email and click the verification link to complete your registration.";
      if (urlEmail) {
        emailValue = urlEmail; // Pre-fill with registered email
      }
      clearPassword = true;
    } else if (verified === "true") {
      successMsg =
        "Email verified successfully! You can now sign in to your account.";
    } else if (message === "password-reset-success") {
      successMsg =
        "Password reset successful! You can now sign in with your new password.";
    } else if (message === "migration-complete") {
      successMsg =
        "Migration completed successfully! You can now sign in with your OAuth account to access your migrated profile.";
    }

    return { errorMsg, successMsg, emailValue, clearPassword };
  }, [searchParams]);

  // Apply initial messages using layout effect
  const hasAppliedInitialMessages = useRef(false);
  useIsomorphicLayoutEffect(() => {
    if (
      !hasAppliedInitialMessages.current &&
      (initialMessages.errorMsg ||
        initialMessages.successMsg ||
        initialMessages.emailValue ||
        initialMessages.clearPassword)
    ) {
      hasAppliedInitialMessages.current = true;
      if (initialMessages.errorMsg && !error) {
        setError(initialMessages.errorMsg);
      }
      if (initialMessages.successMsg && !successMessage) {
        setSuccessMessage(initialMessages.successMsg);
      }
      if (initialMessages.emailValue && !email) {
        setEmail(initialMessages.emailValue);
      }
      if (initialMessages.clearPassword && password) {
        setPassword("");
      }
    }
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    const res = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl,
    });

    setIsLoading(false);

    if (res?.error) {
      // Check for specific error types that indicate email verification issues
      if (res.error === "EmailNotVerified") {
        // Redirect to verify-email page with email pre-filled for resending
        window.location.href = `/verify-email?email=${encodeURIComponent(
          email || ""
        )}&from=login`;
        return;
      }

      setError("Invalid credentials");
    } else if (res?.ok) {
      // Add a small delay to ensure session is established
      await new Promise((resolve) => setTimeout(resolve, 1000));
      window.location.href = "/";
    }
  }

  async function handleOAuthSignIn(providerId: string) {
    setError(null);
    setSuccessMessage(null);
    setOauthLoading(providerId);

    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    try {
      await signIn(providerId, {
        callbackUrl,
      });
    } catch (error) {
      console.error("OAuth sign in error:", error);
      setError("Authentication failed. Please try again.");
      setOauthLoading(null);
    }
  }

  async function handlePasskeyLogin() {
    setError(null);
    setSuccessMessage(null);
    setPasskeyLoading(true);

    try {
      const authResponse = await authenticateWithPasskey(email || undefined);

      const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

      const result = await signIn("passkey", {
        authenticationResponse: JSON.stringify(authResponse),
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        // Check if it's a passkey not found error
        if (result.error.includes("not found")) {
          setError(
            "This passkey is no longer registered. Please use another sign-in method or re-register your passkey."
          );
        } else {
          setError("Passkey authentication failed. Please try again.");
        }
        setPasskeyLoading(false);
      } else if (result?.ok) {
        // Success! Update session and refresh router
        // Then navigate to callback URL
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError("Passkey authentication failed. Please try again.");
        setPasskeyLoading(false);
      }
    } catch (error) {
      console.error("Passkey login error:", error);
      const errorMessage = getPasskeyErrorMessage(error);
      // Only show error if it's not a user cancellation
      if (
        !errorMessage.includes("canceled") &&
        !errorMessage.includes("abort")
      ) {
        setError(errorMessage);
      }
      setPasskeyLoading(false);
    }
  }

  async function handleQuickLogin(
    userType: "volunteer" | "admin" | "minor16" | "minor13"
  ) {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    // Use the callbackUrl from query params, or redirect based on user type
    const defaultCallbackUrl = userType === "admin" ? "/admin" : "/dashboard";
    const callbackUrl = searchParams.get("callbackUrl") || defaultCallbackUrl;

    const credentials = {
      volunteer: {
        email:
          process.env.NEXT_PUBLIC_DEMO_VOLUNTEER_EMAIL ||
          "volunteer@example.com",
        password:
          process.env.NEXT_PUBLIC_DEMO_VOLUNTEER_PASSWORD || "volunteer123",
      },
      admin: {
        email:
          process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || "admin@everybodyeats.nz",
        password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || "admin123",
      },
      minor16: {
        email: "emma.parker@student.ac.nz",
        password: "volunteer123", // Same password as demo volunteers
      },
      minor13: {
        email: "logan.johnson@school.nz",
        password: "volunteer123", // Same password as demo volunteers
      },
    };

    const { email: loginEmail, password: loginPassword } =
      credentials[userType];

    const res = await signIn("credentials", {
      email: loginEmail,
      password: loginPassword,
      redirect: false,
      callbackUrl,
    });

    setIsLoading(false);

    if (res?.error) {
      setError("Login failed");
    } else if (res?.ok) {
      // Add a small delay to ensure session is established
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.location.href = callbackUrl;
    }
  }

  // OAuth providers are already filtered server-side
  const oauthProviders = providers;

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case "google":
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        );
      case "facebook":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        );
      case "apple":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getProviderButtonStyle = (providerId: string) => {
    switch (providerId) {
      case "google":
        return "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600";
      case "facebook":
        return "bg-[#1877F2] hover:bg-[#166FE5] text-white";
      case "apple":
        return "bg-black dark:bg-white hover:bg-gray-900 dark:hover:bg-gray-100 text-white dark:text-black";
      default:
        return "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100";
    }
  };

  // Don't render login form if already authenticated (will redirect)
  if (status === "authenticated") {
    return null;
  }

  return (
    <MotionPageContainer
      className="min-h-[80vh] flex items-center justify-center"
      testid="login-page"
    >
      <div className="w-full max-w-md">
        <div className="text-center">
          <PageHeader
            title="Welcome back"
            description="Sign in to your volunteer account"
            className="mb-6"
          />
        </div>

        <MotionCard className="" testid="login-form-card">
          <CardContent className="md:p-8">
            {/* OAuth Providers */}
            {oauthProviders.length > 0 && (
              <motion.div
                className="mb-4"
                data-testid="oauth-providers"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div className="text-center" variants={itemVariants}>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sign in with your preferred method
                  </p>
                </motion.div>
                <div className="space-y-3">
                  {oauthProviders.map((provider) => (
                    <motion.div key={provider.id} variants={itemVariants}>
                      <Button
                        onClick={() => handleOAuthSignIn(provider.id)}
                        disabled={oauthLoading !== null || isLoading}
                        className={`w-full h-11 ${getProviderButtonStyle(
                          provider.id
                        )}`}
                        variant="outline"
                        data-testid={`oauth-${provider.id}-button`}
                      >
                        {oauthLoading === provider.id ? (
                          <MotionSpinner size="sm" />
                        ) : (
                          <>
                            {getProviderIcon(provider.id)}
                            <span className="ml-3">
                              Continue with {provider.name}
                            </span>
                          </>
                        )}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Passkey Button - Client-side only */}
            <div suppressHydrationWarning>
              {passkeySupported && (
                <motion.div
                  className="mb-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div variants={itemVariants}>
                    <Button
                      onClick={handlePasskeyLogin}
                      disabled={
                        isLoading || oauthLoading !== null || passkeyLoading
                      }
                      className="w-full h-11 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
                      data-testid="passkey-login-button"
                    >
                      {passkeyLoading ? (
                        <MotionSpinner size="sm" color="white" />
                      ) : (
                        <>
                          <Fingerprint className="w-5 h-5 mr-3" />
                          <span>{getPasskeyMessage()}</span>
                        </>
                      )}
                    </Button>
                  </motion.div>

                  <motion.div
                    className="relative my-6"
                    data-testid="passkey-divider"
                    variants={itemVariants}
                  >
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or use email and password
                      </span>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </div>

            <motion.form
              onSubmit={onSubmit}
              className="space-y-6"
              data-testid="login-form"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                className="space-y-2"
                data-testid="email-field"
                variants={formFieldVariants}
              >
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address
                </Label>
                <Input
                  id="email"
                  placeholder="Enter your email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="focus-ring"
                  disabled={isLoading || oauthLoading !== null}
                  data-testid="email-input"
                />
              </motion.div>

              <motion.div
                className="space-y-2"
                data-testid="password-field"
                variants={formFieldVariants}
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                    data-testid="forgot-password-link"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="focus-ring"
                  disabled={isLoading || oauthLoading !== null}
                  data-testid="password-input"
                />
              </motion.div>

              <MotionFormSuccess
                show={!!successMessage}
                data-testid="success-message"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 pt-0.5">
                    <svg
                      className="w-5 h-5 text-green-600 dark:text-green-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="text-green-800 dark:text-green-200 font-medium text-sm leading-relaxed">
                    {successMessage}
                  </div>
                </div>
              </MotionFormSuccess>

              <MotionFormError show={!!error} data-testid="error-message">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {error}
                  </div>
                </div>
              </MotionFormError>

              <motion.div variants={formFieldVariants}>
                <Button
                  type="submit"
                  className="w-full btn-primary"
                  size="lg"
                  disabled={isLoading || oauthLoading !== null}
                  data-testid="login-submit-button"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <MotionSpinner size="sm" color="white" />
                      Signing in...
                    </div>
                  ) : (
                    "Sign in with Email"
                  )}
                </Button>
              </motion.div>
            </motion.form>

            <motion.div
              className="mt-6 pt-6 border-t border-border"
              data-testid="login-footer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Don&apos;t have an account yet?
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-2"
                  data-testid="register-link"
                >
                  <Link href="/register">Create Volunteer Account</Link>
                </Button>
              </div>

              {/* Only show demo credentials when not in production */}
              {process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" && (
                <div
                  className="bg-accent/10 rounded-lg p-4 text-center"
                  data-testid="demo-credentials"
                >
                  <p className="text-sm font-medium text-primary mb-3">
                    Demo Credentials
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => handleQuickLogin("volunteer")}
                      className="w-full btn-secondary"
                      size="sm"
                      disabled={isLoading || oauthLoading !== null}
                      data-testid="quick-login-volunteer-button"
                    >
                      Login as Volunteer
                    </Button>
                    <Button
                      onClick={() => handleQuickLogin("admin")}
                      className="w-full btn-secondary"
                      size="sm"
                      disabled={isLoading || oauthLoading !== null}
                      data-testid="quick-login-admin-button"
                    >
                      Login as Admin
                    </Button>
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs font-medium text-primary mb-2">
                        Underage Users (for testing):
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <Button
                          onClick={() => handleQuickLogin("minor16")}
                          className="w-full btn-secondary text-xs"
                          size="sm"
                          disabled={isLoading || oauthLoading !== null}
                          data-testid="quick-login-minor16-button"
                        >
                          16 year old (not approved)
                        </Button>
                        <Button
                          onClick={() => handleQuickLogin("minor13")}
                          className="w-full btn-secondary text-xs"
                          size="sm"
                          disabled={isLoading || oauthLoading !== null}
                          data-testid="quick-login-minor13-button"
                        >
                          13 year old
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Volunteer: volunteer@example.com | Admin:
                    admin@everybodyeats.nz
                  </p>
                </div>
              )}
            </motion.div>
          </CardContent>
        </MotionCard>
      </div>
    </MotionPageContainer>
  );
}
