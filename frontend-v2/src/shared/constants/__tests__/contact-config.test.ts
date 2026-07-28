import { describe, expect, it } from "vitest"
import {
  buildContactConfig,
  isUnavailableLink,
  isValidEmail,
  isValidHttpUrl,
  isValidSiteLink,
  normalizeOptionalSiteLink,
  phoneToTelHref,
} from "../contact-config"

describe("contact-config validation", () => {
  it("treats empty and fragment hrefs as unavailable", () => {
    expect(isUnavailableLink(undefined)).toBe(true)
    expect(isUnavailableLink("")).toBe(true)
    expect(isUnavailableLink("   ")).toBe(true)
    expect(isUnavailableLink("#")).toBe(true)
    expect(isUnavailableLink("#section")).toBe(true)
    expect(isUnavailableLink("https://example.com")).toBe(false)
  })

  it("validates http(s) URLs only", () => {
    expect(isValidHttpUrl("https://twitter.com/chainverse")).toBe(true)
    expect(isValidHttpUrl("http://example.com")).toBe(true)
    expect(isValidHttpUrl("ftp://example.com")).toBe(false)
    expect(isValidHttpUrl("not-a-url")).toBe(false)
    expect(isValidHttpUrl("#")).toBe(false)
  })

  it("accepts in-app paths and mailto/tel for site links", () => {
    expect(isValidSiteLink("/privacy")).toBe(true)
    expect(isValidSiteLink("/")).toBe(true)
    expect(isValidSiteLink("mailto:support@chainverse.app")).toBe(true)
    expect(isValidSiteLink("tel:+2348000000000")).toBe(true)
    expect(isValidSiteLink("#")).toBe(false)
    expect(isValidSiteLink("")).toBe(false)
  })

  it("normalizes optional links to null when invalid", () => {
    expect(normalizeOptionalSiteLink("#")).toBeNull()
    expect(normalizeOptionalSiteLink("")).toBeNull()
    expect(normalizeOptionalSiteLink(" https://github.com/org ")).toBe(
      "https://github.com/org"
    )
  })

  it("builds tel: hrefs from display phone numbers", () => {
    expect(phoneToTelHref("+234 800 000 0000")).toBe("tel:+2348000000000")
  })

  it("validates emails", () => {
    expect(isValidEmail("support@chainverse.app")).toBe(true)
    expect(isValidEmail("bad")).toBe(false)
  })
})

describe("buildContactConfig", () => {
  it("hides unavailable channels and socials", () => {
    const config = buildContactConfig({
      email: "support@chainverse.app",
      phone: "",
      office: "Abuja, FCT, Nigeria",
      hours: undefined,
      twitter: "#",
      linkedin: "https://linkedin.com/company/chainverse",
      github: "",
      helpCenter: "#",
      privacy: "/privacy",
      terms: "",
      support: "mailto:support@chainverse.app",
    })

    expect(config.channels.map((c) => c.id)).toEqual(["email", "office"])
    expect(config.channels.find((c) => c.id === "email")?.href).toBe(
      "mailto:support@chainverse.app"
    )
    expect(config.socials.map((s) => s.id)).toEqual(["linkedin"])
    expect(config.socials.every((s) => s.href !== "#" && !s.href.startsWith("#"))).toBe(
      true
    )
    expect(config.siteLinks.map((l) => l.id)).toEqual(["privacy", "support"])
    expect(config.siteLinks.every((l) => !isUnavailableLink(l.href))).toBe(true)
  })

  it("returns empty collections when nothing is configured", () => {
    const config = buildContactConfig({})
    expect(config.channels).toEqual([])
    expect(config.socials).toEqual([])
    expect(config.siteLinks).toEqual([])
  })

  it("rejects invalid social URLs even if non-empty", () => {
    const config = buildContactConfig({
      twitter: "not-a-url",
      linkedin: "/relative-path",
    })
    expect(config.socials).toEqual([])
  })
})
