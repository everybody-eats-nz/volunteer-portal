"use client";

import { useActionState, useId, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MotionSpinner } from "@/components/motion-spinner";
import { MotionFormError, MotionFormSuccess } from "@/components/motion-form";
import { PasswordRequirements } from "@/components/password-requirements";
import {
  changePasswordAction,
  type ChangePasswordField,
  type ChangePasswordResult,
} from "@/lib/actions/change-password";
import { cn } from "@/lib/utils";

const inputStyles =
  "h-11 rounded-xl border-forest-500/20 pr-11 focus-visible:border-forest-500 focus-visible:ring-forest-500/20 dark:border-cream-50/15";
const labelStyles =
  "text-sm font-medium text-forest-700/80 dark:text-cream-50/80";

/** A password input with a show/hide toggle that keeps its 44px hit area. */
function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
  invalid,
  testId,
  children,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  disabled: boolean;
  invalid: boolean;
  testId: string;
  children?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2" data-testid={`${testId}-field`}>
      <Label htmlFor={id} className={labelStyles}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          required
          aria-invalid={invalid || undefined}
          className={cn(
            inputStyles,
            invalid &&
              "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/20"
          )}
          data-testid={`${testId}-input`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-xl text-forest-700/50 transition-colors hover:text-forest-700 dark:text-cream-50/50 dark:hover:text-cream-50"
          data-testid={`${testId}-toggle`}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      {children}
    </div>
  );
}

/**
 * Change-password form for the profile page. For accounts created through
 * Google/Apple sign-in that have never had a password (`hasPassword` false),
 * the current-password field is omitted and the copy talks about *setting*
 * one instead.
 */
export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // The field the server most recently rejected; cleared as soon as the user
  // edits anything so the red outline doesn't linger over fresh input.
  const [liveField, setLiveField] = useState<ChangePasswordField | undefined>();
  const formRef = useRef<HTMLFormElement>(null);
  const idPrefix = useId();

  const [state, formAction, isPending] = useActionState<
    ChangePasswordResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await changePasswordAction(prev, formData);
    if (result.success) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLiveField(undefined);
    } else {
      setLiveField(result.field);
      if (result.field) {
        const field = result.field;
        // Focus once React has re-enabled the inputs after the transition.
        requestAnimationFrame(() => {
          formRef.current
            ?.querySelector<HTMLInputElement>(`[name="${field}"]`)
            ?.focus();
        });
      }
    }
    return result;
  }, null);

  const markDirty = () => setLiveField(undefined);

  const passwordsMatch = newPassword === confirmPassword;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-5"
      data-testid="change-password-form"
      aria-describedby={`${idPrefix}-status`}
    >
      {hasPassword ? (
        <PasswordField
          id={`${idPrefix}-current`}
          name="currentPassword"
          label="Current password"
          value={currentPassword}
          onChange={(v) => {
            setCurrentPassword(v);
            markDirty();
          }}
          autoComplete="current-password"
          placeholder="Enter your current password"
          disabled={isPending}
          invalid={liveField === "currentPassword"}
          testId="current-password"
        />
      ) : (
        <p
          className="rounded-2xl bg-sun-100 px-4 py-3 text-sm leading-relaxed text-forest-700/80 dark:bg-sun-200/10 dark:text-cream-50/80"
          data-testid="no-password-notice"
        >
          You signed up with Google or Apple, so your account doesn&apos;t have
          a password yet. Set one here if you&apos;d also like to sign in with
          your email address.
        </p>
      )}

      <PasswordField
        id={`${idPrefix}-new`}
        name="newPassword"
        label="New password"
        value={newPassword}
        onChange={(v) => {
          setNewPassword(v);
          markDirty();
        }}
        autoComplete="new-password"
        placeholder="Choose a new password"
        disabled={isPending}
        invalid={liveField === "newPassword"}
        testId="new-password"
      >
        <PasswordRequirements password={newPassword} />
      </PasswordField>

      <PasswordField
        id={`${idPrefix}-confirm`}
        name="confirmPassword"
        label="Confirm new password"
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          markDirty();
        }}
        autoComplete="new-password"
        placeholder="Type it once more"
        disabled={isPending}
        invalid={liveField === "confirmPassword"}
        testId="confirm-password"
      >
        {confirmPassword && (
          <div
            data-testid="password-match-check"
            className={cn(
              "flex items-center gap-2 text-xs",
              passwordsMatch
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {passwordsMatch ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <XCircle className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</span>
          </div>
        )}
      </PasswordField>

      <div id={`${idPrefix}-status`} aria-live="polite">
        <MotionFormSuccess
          show={!!state?.success}
          data-testid="change-password-success"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400"
              aria-hidden
            />
            <p className="text-sm font-medium leading-relaxed text-green-800 dark:text-green-200">
              {state?.message}
            </p>
          </div>
        </MotionFormSuccess>

        <MotionFormError
          show={state?.success === false}
          data-testid="change-password-error"
        >
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{state?.message}</p>
          </div>
        </MotionFormError>
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full sm:w-auto"
        disabled={isPending}
        data-testid="change-password-submit-button"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <MotionSpinner size="sm" color="white" />
            Saving...
          </span>
        ) : hasPassword ? (
          "Update password"
        ) : (
          "Set password"
        )}
      </Button>
    </form>
  );
}
