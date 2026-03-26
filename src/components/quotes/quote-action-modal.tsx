"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ModalActionForm, ModalSubmitButton } from "@/components/ui/modal-action-form";
import { ViewportModal, ViewportModalPanel } from "@/components/ui/viewport-modal";

interface QuoteActionModalProps {
  title: string;
  closeHref: string;
  successRedirectHref: string;
  action: (formData: FormData) => Promise<void>;
  closeLabel: string;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel: string;
  successMessage: string;
  genericErrorMessage: string;
  children: ReactNode;
}

export function QuoteActionModal({
  title,
  closeHref,
  successRedirectHref,
  action,
  closeLabel,
  cancelLabel,
  submitLabel,
  submittingLabel,
  successMessage,
  genericErrorMessage,
  children,
}: QuoteActionModalProps) {
  return (
    <ViewportModal>
      <ViewportModalPanel className="max-w-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <Link href={closeHref} className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            {closeLabel}
          </Link>
        </div>

        <ModalActionForm
          action={action}
          className="grid gap-4 p-5"
          successRedirectHref={successRedirectHref}
          successMessage={successMessage}
          closeLabel={closeLabel}
          genericErrorMessage={genericErrorMessage}
        >
          {children}

          <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
            <Link href={closeHref} className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              {cancelLabel}
            </Link>
            <ModalSubmitButton
              idleLabel={submitLabel}
              pendingLabel={submittingLabel}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </ModalActionForm>
      </ViewportModalPanel>
    </ViewportModal>
  );
}
