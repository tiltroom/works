import { expect, test } from "@playwright/test";

test("home page renders the platform heading", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Hours Platform" })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign in|accedi/i })).toBeVisible();
});
