"use client";

import Link from "next/link";
import { ViewportModal, ViewportModalPanel } from "@/components/ui/viewport-modal";
import { ModalActionForm, ModalSubmitButton } from "@/components/ui/modal-action-form";
import { DatetimeLocalInput } from "@/components/worker/datetime-local-form";

interface EditProjectOption {
  id: string;
  name: string;
}

interface EditTimeEntryModalProps {
  timeEntryId: string;
  projectId: string;
  startedAtUtc: string;
  endedAtUtc: string;
  maxEndedAtUtc: string;
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

export function EditTimeEntryModal({
  timeEntryId,
  projectId,
  startedAtUtc,
  endedAtUtc,
  maxEndedAtUtc,
  description,
  projectOptions,
  closeHref,
  successRedirectHref,
  updateTimeEntryAction,
  labels,
}: EditTimeEntryModalProps) {
  return (
    <ViewportModal>
      <ViewportModalPanel className="max-w-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold text-foreground">{labels.title}</h3>
          <Link href={closeHref} className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            {labels.close}
          </Link>
        </div>

        <ModalActionForm
          action={updateTimeEntryAction}
          className="grid gap-4 p-5 md:grid-cols-2"
          successRedirectHref={successRedirectHref}
          successMessage={labels.successMessage}
          closeLabel={labels.close}
          genericErrorMessage={labels.genericErrorMessage}
        >
          <input type="hidden" name="timeEntryId" value={timeEntryId} />
          <input type="hidden" name="startedAtUtc" />
          <input type="hidden" name="endedAtUtc" />

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
            <DatetimeLocalInput
              id="modal-time-started"
              name="startedAtLocal"
              required
              defaultUtcValue={startedAtUtc}
              className="w-full rounded-lg border border-input bg-background/70 px-4 py-2.5 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="modal-time-ended" className="text-sm font-medium text-foreground">
              {labels.endTime}
            </label>
            <DatetimeLocalInput
              id="modal-time-ended"
              name="endedAtLocal"
              required
              defaultUtcValue={endedAtUtc}
              maxUtcValue={maxEndedAtUtc}
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
            <ModalSubmitButton
              idleLabel={labels.saveChanges}
              pendingLabel={labels.saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </ModalActionForm>
      </ViewportModalPanel>
    </ViewportModal>
  );
}
