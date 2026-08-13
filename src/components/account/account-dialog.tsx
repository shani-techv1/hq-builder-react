"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import { Eye, EyeOff, UserPlus, UserRound, X } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/hooks/use-account";
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  PASSWORD_RULE,
  emailError,
  nameError,
  newPasswordError,
  passwordError,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Which form the dialog is showing. */
export type AccountMode = "signin" | "signup";

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
}

const NO_FIELD_ERRORS: FieldErrors = { name: null, email: null, password: null };

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
  const { pending, error, logIn, register, clearError } = useAccount();

  const [mode, setMode] = React.useState<AccountMode>(initialMode);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [revealed, setRevealed] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState(NO_FIELD_ERRORS);

  const signingUp = mode === "signup";
  const copy = COPY[mode];

  const switchMode = () => {
    setMode(signingUp ? "signin" : "signup");
    setFieldErrors(NO_FIELD_ERRORS);
    clearError();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const errors: FieldErrors = {
      name: signingUp ? nameError(name) : null,
      email: emailError(email),
      // The rules apply to a password being chosen, not to one being entered —
      // see `passwordError`. The name and address go in so a password built
      // out of either can be caught before it is created.
      password: signingUp
        ? newPasswordError(password, { email, name })
        : passwordError(password),
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password) return;

    const ok = signingUp
      ? await register({ name, email, password })
      : await logIn({ email, password });

    if (ok) onDone();
  };

  return (
    <>
      <div className="relative px-5 pb-4 pt-5">
        <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
          <copy.icon className="size-5" strokeWidth={1.9} aria-hidden />
        </span>

        <Dialog.Title className="text-[16px] font-bold tracking-tight text-foreground">
          {copy.title}
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {copy.description}
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
                  placeholder="Alex Mercer"
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
                placeholder="you@example.com"
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
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  maxLength={MAX_PASSWORD_LENGTH}
                  placeholder="••••••••"
                  value={password}
                  disabled={pending}
                  className={cn(props.className, "pr-10")}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, password: null }));
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

          {/* The service's own reason, which is the specific one: the address
              is taken, the password is wrong, it could not be reached. */}
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] font-medium leading-relaxed text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-4 border-t border-border bg-canvas/50 px-5 py-3">
          <PrimaryButton type="submit" size="md" disabled={pending}>
            {pending ? copy.submitting : copy.submit}
          </PrimaryButton>

          <p className="mt-2.5 text-center text-[12px] text-muted-foreground">
            {copy.switchPrompt}{" "}
            <button
              type="button"
              onClick={switchMode}
              disabled={pending}
              className={cn(
                "rounded font-semibold text-primary transition-colors",
                "outline-none hover:text-primary/80",
                "focus-visible:ring-3 focus-visible:ring-ring/40",
                "disabled:pointer-events-none disabled:opacity-60",
              )}
            >
              {copy.switchAction}
            </button>
          </p>
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
