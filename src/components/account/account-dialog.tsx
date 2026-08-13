"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { OTPField } from "@base-ui/react/otp-field";
import { motion } from "framer-motion";
import { Eye, EyeOff, MailCheck, UserPlus, UserRound, X } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useAccount } from "@/hooks/use-account";
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  OTP_LENGTH,
  PASSWORD_RULE,
  emailError,
  nameError,
  newPasswordError,
  otpError,
  passwordError,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Which form the dialog is showing. */
export type AccountMode = "signin" | "signup";

/**
 * Which half of it: the credentials, or the code that confirms the address.
 *
 * A step rather than a third mode, because the code screen is reached from
 * both — after signing up, and after signing in to an account that was never
 * confirmed — and it continues whichever one the user started.
 */
type AccountStep = "credentials" | "verify";

export interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which form to open on. The user can switch once it is open. */
  initialMode?: AccountMode;
}

interface FieldErrors {
  name: string | null;
  email: string | null;
  password: string | null;
  otp: string | null;
}

const NO_FIELD_ERRORS: FieldErrors = {
  name: null,
  email: null,
  password: null,
  otp: null,
};

const COPY = {
  signin: {
    icon: UserRound,
    title: "Sign in",
    description: "Sign in to keep your designs with your account.",
    submit: "Sign in",
    submitting: "Signing in…",
    switchPrompt: "New here?",
    switchAction: "Create an account",
  },
  signup: {
    icon: UserPlus,
    title: "Create your account",
    description: "It takes a moment, and your designs stay with you.",
    submit: "Create account",
    submitting: "Creating account…",
    switchPrompt: "Already have an account?",
    switchAction: "Sign in",
  },
} as const;

/**
 * How long before another code can be asked for.
 *
 * Every request sends a real email, and the second one rarely arrives faster
 * than the first — the wait is there to say so, rather than to let someone
 * queue five copies while the first is still in flight.
 */
const RESEND_COOLDOWN_SECONDS = 30;

/** The dialog's secondary actions, which read as links and behave as buttons. */
const LINK_BUTTON = cn(
  "rounded font-semibold text-primary transition-colors",
  "outline-none hover:text-primary/80",
  "focus-visible:ring-3 focus-visible:ring-ring/40",
  "disabled:pointer-events-none disabled:opacity-60",
);

/**
 * Signing in and signing up, in one dialog.
 *
 * The shell only knows whether it is open. Everything the user types lives in
 * {@link AccountForm} below, which is mounted inside the popup and therefore
 * unmounts with it — so the next open starts from a genuinely empty form
 * rather than from state something had to remember to clear. A half-typed
 * password surviving a dismissal is exactly the kind of thing that should not
 * depend on someone maintaining a reset.
 */
export function AccountDialog({
  open,
  onOpenChange,
  initialMode = "signin",
}: AccountDialogProps) {
  /* Held out here because the popup needs it to place the caret, while the
     field it points at belongs to the form inside. A ref survives the form
     being replaced, which is all this has to do. */
  const firstField = React.useRef<HTMLInputElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]",
            "transition-opacity duration-200 data-starting-style:opacity-0",
          )}
        />

        <Dialog.Popup
          initialFocus={firstField}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2 outline-none",
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="overflow-hidden rounded-card border border-border bg-card shadow-panel"
          >
            <AccountForm
              initialMode={initialMode}
              firstFieldRef={firstField}
              onDone={() => onOpenChange(false)}
            />
          </motion.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The form itself: one set of fields, two things it can be.
 *
 * One form rather than two screens, because the two differ by a single field
 * and a heading — and because someone who mistook one for the other should be
 * able to correct it without losing what they have typed. The email and
 * password carry across the switch; only the errors are dropped, since they
 * were answers to the other question.
 *
 * Validation runs here before anything is sent, using the same rules the
 * service enforces, so an obvious mistake costs a keystroke rather than a round
 * trip. The service still has the last word, and what it says is shown verbatim
 * above the button — it knows things this cannot, like whether an address is
 * already registered.
 *
 * The password stays in state after the account is created, because confirming
 * the code signs the new account in and the service may answer the code with a
 * message rather than a user. It is memory only — the same rule the rest of
 * this flow follows — and it goes when the dialog closes.
 */
function AccountForm({
  initialMode,
  firstFieldRef,
  onDone,
}: {
  initialMode: AccountMode;
  firstFieldRef: React.RefObject<HTMLInputElement | null>;
  onDone: () => void;
}) {
  const { pending, logIn, register, verify, resend } = useAccount();

  const [mode, setMode] = React.useState<AccountMode>(initialMode);
  const [step, setStep] = React.useState<AccountStep>("credentials");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [revealed, setRevealed] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState(NO_FIELD_ERRORS);
  const [resendIn, setResendIn] = React.useState(0);

  const signingUp = mode === "signup";
  const verifying = step === "verify";
  const copy = COPY[mode];

  /* The slots are separate inputs, so the caret goes to the first of them. */
  const otpSlots = React.useRef<HTMLDivElement>(null);
  const focusOtp = React.useCallback(() => {
    otpSlots.current?.querySelector("input")?.focus();
  }, []);

  /* A self-rescheduling tick rather than an interval, so a re-render can't
     leave two of them running against the same counter. */
  React.useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  /* The code field is the only thing on the screen once it appears, and the
     caret is still in the field that was left behind. */
  React.useEffect(() => {
    if (verifying) focusOtp();
  }, [verifying, focusOtp]);

  const goToVerify = (cooldown = 0) => {
    setStep("verify");
    setOtp("");
    setFieldErrors(NO_FIELD_ERRORS);
    setResendIn(cooldown);
  };

  const switchMode = () => {
    setMode(signingUp ? "signin" : "signup");
    setFieldErrors(NO_FIELD_ERRORS);
  };

  /** Back to the credentials, keeping them — usually a mistyped address. */
  const editDetails = () => {
    setStep("credentials");
    setOtp("");
    setFieldErrors(NO_FIELD_ERRORS);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    if (verifying) {
      const invalid = otpError(otp);
      setFieldErrors({ ...NO_FIELD_ERRORS, otp: invalid });
      if (invalid) return;

      const result = await verify({ email, otp, password });
      if (result.ok) {
        toast.success("Email confirmed", "You’re signed in.");
        onDone();
        return;
      }

      // A refused code is cleared so the next attempt starts from an empty
      // first slot; anything else — offline, a timeout — leaves what was typed,
      // because it was never judged and is probably right.
      if (result.code === "INVALID_OTP") {
        setOtp("");
        focusOtp();
      }
      if (result.message) toast.error("That code didn’t work", result.message);
      return;
    }

    const errors: FieldErrors = {
      name: signingUp ? nameError(name) : null,
      email: emailError(email),
      // The rules apply to a password being chosen, not to one being entered —
      // see `passwordError`. The name and address go in so a password built
      // out of either can be caught before it is created.
      password: signingUp
        ? newPasswordError(password, { email, name })
        : passwordError(password),
      otp: null,
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password) return;

    if (signingUp) {
      const created = await register({ name, email, password });
      if (created.ok) {
        goToVerify(RESEND_COOLDOWN_SECONDS);
        toast.success(
          "Check your email",
          `We sent a ${OTP_LENGTH}-digit code to ${email.trim()}.`,
        );
      } else if (created.message) {
        toast.error("Couldn’t create your account", created.message);
      }
      return;
    }

    const result = await logIn({ email, password });
    if (result.ok) {
      toast.success("Signed in", "Your designs are saved to your account.");
      onDone();
      return;
    }

    // An account that was never confirmed. The password was accepted, so this
    // is an unfinished sign-up rather than a failed sign-in, and it carries on
    // to the code screen. No code is sent from here: one went out when the
    // account was created, and mailing another on every attempt would make this
    // form a way to send someone email.
    if (result.code === "EMAIL_NOT_VERIFIED") {
      goToVerify();
      toast.error(
        "Confirm your email first",
        "Use the code from your sign-up email, or ask for a new one.",
      );
      return;
    }

    if (result.message) toast.error("Couldn’t sign in", result.message);
  };

  /** What the one submit button is for, on whichever screen it is showing. */
  const action = verifying
    ? { submit: "Verify email", submitting: "Verifying…" }
    : { submit: copy.submit, submitting: copy.submitting };

  const handleResend = async () => {
    if (pending || resendIn > 0) return;
    setFieldErrors(NO_FIELD_ERRORS);

    const result = await resend(email);
    if (result.ok) {
      setOtp("");
      setResendIn(RESEND_COOLDOWN_SECONDS);
      focusOtp();
      toast.success("New code sent", `Check ${email.trim()} for a fresh code.`);
    } else if (result.message) {
      toast.error("Couldn’t send a new code", result.message);
    }
  };

  return (
    <>
      <div className="relative px-5 pb-4 pt-5">
        <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
          {verifying ? (
            <MailCheck className="size-5" strokeWidth={1.9} aria-hidden />
          ) : (
            <copy.icon className="size-5" strokeWidth={1.9} aria-hidden />
          )}
        </span>

        <Dialog.Title className="text-[16px] font-bold tracking-tight text-foreground">
          {verifying ? "Check your email" : copy.title}
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {verifying ? (
            <>
              Enter the {OTP_LENGTH}-digit code we sent to{" "}
              <span className="font-semibold text-foreground">
                {email.trim()}
              </span>
              .
            </>
          ) : (
            copy.description
          )}
        </Dialog.Description>

        <Dialog.Close
          aria-label="Close"
          className={cn(
            "absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted-foreground",
            "transition-colors outline-none hover:bg-muted hover:text-foreground",
            "focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </Dialog.Close>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="space-y-3 px-5">
          {verifying ? (
            <Field
              label="Verification code"
              error={fieldErrors.otp}
              hint="Codes expire, so use the most recent email."
              /* Field's `className` is for a single control and is dropped
                 here; the rest of its wiring is taken by name. Base UI gives
                 the root's id to the first slot, so the label points at it. */
              input={(props) => (
                /* One box per digit rather than one field for all six: it
                   cannot be mistaken for a pre-filled value, and paste, arrow
                   keys and SMS autofill are handled by the primitive. */
                <OTPField.Root
                  id={props.id}
                  aria-describedby={props["aria-describedby"]}
                  ref={otpSlots}
                  length={OTP_LENGTH}
                  value={otp}
                  disabled={pending}
                  autoSubmit
                  className="flex w-full gap-2"
                  onValueChange={(value) => {
                    setOtp(value);
                    setFieldErrors((current) => ({ ...current, otp: null }));
                  }}
                >
                  {Array.from({ length: OTP_LENGTH }, (_, index) => (
                    <OTPField.Input
                      key={index}
                      aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                      aria-invalid={Boolean(fieldErrors.otp)}
                      className={cn(
                        "h-11 w-full min-w-0 rounded-xl border bg-transparent text-center",
                        "text-[16px] font-semibold text-foreground transition-colors outline-none",
                        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
                        "disabled:pointer-events-none disabled:bg-input/50 disabled:opacity-50",
                        fieldErrors.otp
                          ? "border-destructive ring-3 ring-destructive/20"
                          : "border-input",
                      )}
                    />
                  ))}
                </OTPField.Root>
              )}
            />
          ) : (
            <>
              {signingUp ? (
                <Field
                  label="Name"
                  error={fieldErrors.name}
                  input={(props) => (
                    <Input
                      {...props}
                      ref={firstFieldRef}
                      type="text"
                      autoComplete="name"
                      maxLength={MAX_NAME_LENGTH}
                      value={name}
                      disabled={pending}
                      onChange={(event) => {
                        setName(event.target.value);
                        setFieldErrors((current) => ({ ...current, name: null }));
                      }}
                    />
                  )}
                />
              ) : null}

              <Field
                label="Email"
                error={fieldErrors.email}
                input={(props) => (
                  <Input
                    {...props}
                    ref={signingUp ? undefined : firstFieldRef}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={MAX_EMAIL_LENGTH}
                    value={email}
                    disabled={pending}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setFieldErrors((current) => ({ ...current, email: null }));
                    }}
                  />
                )}
              />

              <Field
                label="Password"
                error={fieldErrors.password}
                hint={signingUp ? PASSWORD_RULE : undefined}
                input={(props) => (
                  <span className="relative block">
                    <Input
                      {...props}
                      type={revealed ? "text" : "password"}
                      autoComplete={
                        signingUp ? "new-password" : "current-password"
                      }
                      maxLength={MAX_PASSWORD_LENGTH}
                      value={password}
                      disabled={pending}
                      className={cn(props.className, "pr-10")}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setFieldErrors((current) => ({
                          ...current,
                          password: null,
                        }));
                      }}
                    />
                    <button
                      type="button"
                      aria-label={revealed ? "Hide password" : "Show password"}
                      title={revealed ? "Hide password" : "Show password"}
                      onClick={() => setRevealed((current) => !current)}
                      className={cn(
                        "absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center",
                        "rounded-lg text-muted-foreground transition-colors outline-none",
                        "hover:bg-muted hover:text-foreground",
                        "focus-visible:ring-3 focus-visible:ring-ring/40",
                      )}
                    >
                      {revealed ? (
                        <EyeOff className="size-4" strokeWidth={2} aria-hidden />
                      ) : (
                        <Eye className="size-4" strokeWidth={2} aria-hidden />
                      )}
                    </button>
                  </span>
                )}
              />
            </>
          )}

          {/* What the service said — the address is taken, the password is
              wrong, the code has expired — is announced in a toast rather than
              here. It outlives the dialog, which closes on success, and it is
              about the attempt rather than about any one field. */}
        </div>

        <div className="mt-4 border-t border-border bg-canvas/50 px-5 py-3">
          <PrimaryButton
            type="submit"
            size="md"
            /* Nothing to send until the code is the length it is issued at. */
            disabled={pending || (verifying && otp.length < OTP_LENGTH)}
          >
            {pending ? action.submitting : action.submit}
          </PrimaryButton>

          {verifying ? (
            <>
              <p className="mt-2.5 text-center text-[12px] text-muted-foreground">
                Didn’t get it?{" "}
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={pending || resendIn > 0}
                  className={LINK_BUTTON}
                >
                  {resendIn > 0
                    ? `Send a new code in ${resendIn}s`
                    : "Send a new code"}
                </button>
              </p>
              <p className="mt-1.5 text-center text-[12px] text-muted-foreground">
                <button
                  type="button"
                  onClick={editDetails}
                  disabled={pending}
                  className={LINK_BUTTON}
                >
                  Use a different email
                </button>
              </p>
            </>
          ) : (
            <p className="mt-2.5 text-center text-[12px] text-muted-foreground">
              {copy.switchPrompt}{" "}
              <button
                type="button"
                onClick={switchMode}
                disabled={pending}
                className={LINK_BUTTON}
              >
                {copy.switchAction}
              </button>
            </p>
          )}
        </div>
      </form>
    </>
  );
}

/** The props a field hands its input, so the label and error stay wired to it. */
interface FieldInputProps {
  id: string;
  className: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

/**
 * Label, control and message as one unit.
 *
 * The input is a render prop rather than a child because every field wires the
 * same four accessibility props onto it, and the password field wraps its input
 * in a button-bearing container — passing them down is what keeps that wrapper
 * from breaking the association with the label and the error.
 */
function Field({
  label,
  error,
  hint,
  input,
}: {
  label: string;
  error: string | null;
  /** The rule, stated before it can be broken. Replaced by an error, not
      stacked with it — the error is the more specific version of the same
      sentence. */
  hint?: string;
  input: (props: FieldInputProps) => React.ReactNode;
}) {
  const id = React.useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[12px] font-semibold text-foreground"
      >
        {label}
      </label>

      {input({
        id,
        className: "h-10 rounded-xl px-3 text-[13px]",
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : hint ? hintId : undefined,
      })}

      {error ? (
        <p id={errorId} className="text-[11.5px] font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[11.5px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
