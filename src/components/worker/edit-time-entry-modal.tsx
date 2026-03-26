"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ViewportModal, ViewportModalPanel } from "@/components/ui/viewport-modal";
import { DismissibleToast } from "@/components/worker/dismissible-toast";

interface EditProjectOption {
  id: string;
  name: string;
}

interface EditTimeEntryModalProps {
  timeEntryId: string;
  projectId: string;
  startedAt: string;
  endedAt: string;
  maxEndedAt: string;
  description: string;
  projectOptions: EditProjectOption[];
  closeHref: string;
  successRedirectHref: string;
  updateTimeEntryAction: (formData: FormData) => Promise<void>;
  labels: {
    title: string;
    close: string;
    cancel: string;
    saveChanges: string;
    saving: string;
    project: string;
    startTime: string;
    endTime: string;
    description: string;
    successMessage: string;
    genericErrorMessage: string;
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function withToast(target: string, message: string) {
  const [pathname, query = ""] = target.split("?");
  const searchParams = new URLSearchParams(query);

  searchParams.set("toast", "success");
  searchParams.set("toastMessage", message);

  const nextQuery = searchParams.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function EditTimeEntryModal({
  timeEntryId,
  projectId,
  startedAt,
  endedAt,
  maxEndedAt,
  description,
  projectOptions,
  closeHref,
  successRedirectHref,
  updateTimeEntryAction,
  labels,
}: EditTimeEntryModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    formData.set("timeEntryId", timeEntryId);

    startTransition(async () => {
      setErrorMessage(null);

      try {
        await updateTimeEntryAction(formData);
        router.replace(withToast(successRedirectHref, labels.successMessage), { scroll: false });
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error, labels.genericErrorMessage));
      }
    });
  };

  return (
    <>
      {errorMessage && (
        <DismissibleToast
          variant="error"
          message={errorMessage}
          closeLabel={labels.close}
          onClose={() => setErrorMessage(null)}
        />
      )}

      <ViewportModal>
        <ViewportModalPanel className="max-w-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-lg font-semibold text-foreground">{labels.title}</h3>
            <Link href={closeHref} className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              {labels.close}
            </Link>
          </div>

          <form action={handleSubmit} className="grid gap-4 p-5 md:grid-cols-2">
            <input type="hidden" name="timeEntryId" value={timeEntryId} />

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="modal-time-project" className="text-sm font-medium text-foreground">
                {labels.project}
              </label>
              <select
                id="modal-time-project"
                name="projectId"
                required
                defaultValue={projectId}
                className="w-full rounded-lg border border-input bg-background/70 px-4 py-2.5 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              >
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id} className="bg-background text-foreground">
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-time-started" className="text-sm font-medium text-foreground">
                {labels.startTime}
              </label>
              <input
                id="modal-time-started"
                name="startedAt"
                type="datetime-local"
                required
                defaultValue={startedAt}
                className="w-full rounded-lg border border-input bg-background/70 px-4 py-2.5 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-time-ended" className="text-sm font-medium text-foreground">
                {labels.endTime}
              </label>
              <input
                id="modal-time-ended"
                name="endedAt"
                type="datetime-local"
                required
                defaultValue={endedAt}
                min={startedAt || undefined}
                max={maxEndedAt}
                className="w-full rounded-lg border border-input bg-background/70 px-4 py-2.5 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="modal-time-description" className="text-sm font-medium text-foreground">
                {labels.description}
              </label>
              <textarea
                id="modal-time-description"
                name="description"
                defaultValue={description}
                rows={4}
                className="w-full resize-none rounded-lg border border-input bg-background/70 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <Link href={closeHref} className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                {labels.cancel}
              </Link>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? labels.saving : labels.saveChanges}
              </button>
            </div>
          </form>
        </ViewportModalPanel>
      </ViewportModal>
    </>
  );
}
