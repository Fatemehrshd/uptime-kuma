import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Icon Button Tooltips", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("icon-only action buttons have title and aria-label", async ({ page }, testInfo) => {
        test.setTimeout(120000);

        await page.goto("./add");
        await login(page);
        await expect(page.getByTestId("monitor-type-select")).toBeVisible();

        await page.goto("./add-status-page");
        await page.getByTestId("name-input").fill("Tooltip Test");
        await page.getByTestId("slug-input").fill("tooltip-test");
        await page.getByTestId("submit-button").click();
        await page.waitForURL("/status/tooltip-test?edit");

        await page.getByTestId("create-incident-button").click();
        await page.getByTestId("incident-title").fill("Tooltip Incident");
        await page.getByTestId("incident-content-editable").fill("Testing icon button tooltips");
        await page.getByTestId("post-incident-button").click();

        await page.waitForTimeout(500);

        const activeIncident = page.getByTestId("incident").filter({ hasText: "Tooltip Incident" });
        await expect(activeIncident).toBeVisible({ timeout: 10000 });

        const resolveButton = activeIncident.locator("button", { hasText: "Resolve" });
        await expect(resolveButton).toHaveAttribute("title", "Resolve");
        await expect(resolveButton).toHaveAttribute("aria-label", "Resolve");

        const editButton = activeIncident.locator("button", { hasText: "Edit" });
        await expect(editButton).toHaveAttribute("title", "Edit");
        await expect(editButton).toHaveAttribute("aria-label", "Edit");

        const deleteButton = activeIncident.locator("button", { hasText: "Delete" });
        await expect(deleteButton).toHaveAttribute("title", "Delete");
        await expect(deleteButton).toHaveAttribute("aria-label", "Delete");

        await page.getByTestId("save-button").click();
        await expect(page.getByTestId("edit-sidebar")).toHaveCount(0);

        await screenshot(testInfo, page);
    });
});
