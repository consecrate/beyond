import { describe, expect, it } from "vitest"
import { parseSignInForm, parseSignUpForm } from "./form-data"

function buildFormData(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

describe("parseSignUpForm", () => {
  it("trims display name and email", () => {
    const result = parseSignUpForm(
      buildFormData({
        displayName: "  Ms. Nguyen  ",
        email: "  teacher@example.com  ",
        password: "secret12",
      }),
    )

    expect(result).toEqual({
      ok: true,
      data: {
        displayName: "Ms. Nguyen",
        email: "teacher@example.com",
        password: "secret12",
      },
    })
  })

  it("rejects a blank display name", () => {
    const result = parseSignUpForm(
      buildFormData({
        displayName: "   ",
        email: "teacher@example.com",
        password: "secret12",
      }),
    )

    expect(result).toEqual({
      ok: false,
      error: "Display name is required.",
    })
  })
})

describe("parseSignInForm", () => {
  it("rejects a blank email", () => {
    const result = parseSignInForm(
      buildFormData({ email: "   ", password: "secret12" }),
    )

    expect(result).toEqual({
      ok: false,
      error: "Email is required.",
    })
  })
})
