"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { DismissibleToast } from "@/components/ui/dismissible-toast";
import { withQueryToast } from "@/lib/query-toast";
import { datetimeLocalValueToUtcIso } from "@/lib/date-time";

interface ModalActionFormProps extends Omit<ComponentPropsWithoutRef<"form">, "action" | "children"> {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  successRedirectHref: string;
  successMessage: string;
  closeLabel: string;
  genericErrorMessage: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function ModalActionForm({
  action,
  children,
  className,
  successRedirectHref,
  successMessage,
  closeLabel,
  genericErrorMessage,
  ...props
}: ModalActionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      setErrorMessage(null);

      try {
        if (formData.has("startedAtLocal") || formData.has("endedAtLocal")) {
          const startedAtLocal = formData.get("startedAtLocal");
          const endedAtLocal = formData.get("endedAtLocal");

          if (typeof startedAtLocal === "string" && startedAtLocal.trim()) {
            formData.set("startedAtUtc", datetimeLocalValueToUtcIso(startedAtLocal, "Start time"));
          }

          if (typeof endedAtLocal === "string" && endedAtLocal.trim()) {
            formData.set("endedAtUtc", datetimeLocalValueToUtcIso(endedAtLocal, "End time"));
          }
        }

        await action(formData);
        router.replace(withQueryToast(successRedirectHref, "success", successMessage), { scroll: false });
        router.refresh();
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error, genericErrorMessage));
      }
    });
  };

  return (
    <>
      {errorMessage && (
        <DismissibleToast
          variant="error"
          message={errorMessage}
          closeLabel={closeLabel}
          onClose={() => setErrorMessage(null)}
        />
      )}

      <form {...props} action={handleSubmit} className={className}>
        <fieldset disabled={isPending} className="contents">
          {children}
        </fieldset>
      </form>
    </>
  );
}

interface ModalSubmitButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> {
  idleLabel: string;
  pendingLabel?: string;
}

export function ModalSubmitButton({ idleLabel, pendingLabel, disabled, ...props }: ModalSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
    >
      {pending && pendingLabel ? pendingLabel : idleLabel}
    </button>
  );
}
