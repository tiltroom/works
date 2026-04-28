import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModalActionForm } from "@/components/ui/modal-action-form";

const mockClientRef = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockClientRef,
}));

describe("ModalActionForm", () => {
  beforeEach(() => {
    mockClientRef.replace.mockReset();
    mockClientRef.refresh.mockReset();
  });

  it("shows a success toast via query params and refreshes the route after a successful submit", async () => {
    const action = vi.fn().mockResolvedValue(undefined);

    render(
      <ModalActionForm
        action={action}
        successRedirectHref="/worker/quotes/quote-1"
        successMessage="Subtask saved"
        closeLabel="Close"
        genericErrorMessage="Unable to save subtask"
      >
        <input name="title" defaultValue="My subtask" />
        <button type="submit">Save subtask</button>
      </ModalActionForm>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save subtask" }));

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
      expect(mockClientRef.replace).toHaveBeenCalledWith(
        "/worker/quotes/quote-1?toast=success&toastMessage=Subtask+saved",
        { scroll: false },
      );
      expect(mockClientRef.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
