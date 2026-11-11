import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"

test("registers a company and signs in its administrator", async ({ page }) => {
  const id = randomUUID()
  const companyName = `Playwright ${id}`

  await page.goto("/en/register")
  await page.getByLabel("Company name").fill(companyName)
  await page.getByLabel("Full name").fill("Playwright Admin")
  await page.getByLabel("Email").fill(`playwright-${id}@example.com`)
  await page.getByLabel("Password").fill("Playwright-1234!")
  await page.getByRole("button", { name: "Create account" }).click()

  await expect(page).toHaveURL(/\/en\/onboarding\/?$/)
  await expect(page.getByRole("heading", { name: "Company Profile" })).toBeVisible()
  await expect(page.getByPlaceholder("My Company")).toHaveValue(companyName)
})
