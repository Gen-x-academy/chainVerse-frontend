/**
 * Validated public contact / social / legal link configuration (#864).
 * Empty or fragment (`#`) values are treated as unavailable and must not be rendered.
 */

export type ContactChannelId = "email" | "phone" | "office" | "hours"

export type ContactChannel = {
  id: ContactChannelId
  title: string
  content: string
  /** Navigable href, or null for display-only channels. Never `#`. */
  href: string | null
}

export type SocialChannelId = "twitter" | "linkedin" | "github"

export type SocialChannel = {
  id: SocialChannelId
  label: string
  href: string
}

export type SiteLinkId = "helpCenter" | "privacy" | "terms" | "support"

export type SiteLink = {
  id: SiteLinkId
  label: string
  href: string
}

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? ""
}

/** True when the value is missing, blank, or an empty-fragment placeholder. */
export function isUnavailableLink(value: string | undefined | null): boolean {
  if (value == null) return true
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed === "#" || trimmed.startsWith("#")
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Accepts absolute http(s) URLs, mailto:/tel:, or in-app paths starting with `/`.
 * Rejects fragments and empty strings.
 */
export function isValidSiteLink(value: string): boolean {
  if (isUnavailableLink(value)) return false
  const trimmed = value.trim()
  if (trimmed.startsWith("/")) return true
  if (trimmed.startsWith("mailto:")) {
    return isValidEmail(trimmed.slice("mailto:".length))
  }
  if (trimmed.startsWith("tel:")) {
    return trimmed.length > "tel:".length
  }
  return isValidHttpUrl(trimmed)
}

export function normalizeOptionalSiteLink(
  value: string | undefined
): string | null {
  const trimmed = trimEnv(value)
  if (!isValidSiteLink(trimmed)) return null
  return trimmed
}

export function phoneToTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "")
  return `tel:${digits}`
}

export type ContactConfig = {
  channels: ContactChannel[]
  socials: SocialChannel[]
  siteLinks: SiteLink[]
}

type ContactEnv = {
  email?: string
  phone?: string
  office?: string
  hours?: string
  twitter?: string
  linkedin?: string
  github?: string
  helpCenter?: string
  privacy?: string
  terms?: string
  support?: string
}

/** Pure builder — pass env values explicitly for tests. */
export function buildContactConfig(env: ContactEnv): ContactConfig {
  const channels: ContactChannel[] = []

  const email = trimEnv(env.email)
  if (email && isValidEmail(email)) {
    channels.push({
      id: "email",
      title: "Email",
      content: email,
      href: `mailto:${email}`,
    })
  }

  const phone = trimEnv(env.phone)
  if (phone) {
    channels.push({
      id: "phone",
      title: "Phone",
      content: phone,
      href: phoneToTelHref(phone),
    })
  }

  const office = trimEnv(env.office)
  if (office) {
    channels.push({
      id: "office",
      title: "Office",
      content: office,
      href: null,
    })
  }

  const hours = trimEnv(env.hours)
  if (hours) {
    channels.push({
      id: "hours",
      title: "Business Hours",
      content: hours,
      href: null,
    })
  }

  const socialDefs: Array<{
    id: SocialChannelId
    label: string
    value?: string
  }> = [
    { id: "twitter", label: "Twitter", value: env.twitter },
    { id: "linkedin", label: "LinkedIn", value: env.linkedin },
    { id: "github", label: "GitHub", value: env.github },
  ]

  const socials: SocialChannel[] = socialDefs.flatMap(({ id, label, value }) => {
    const href = normalizeOptionalSiteLink(value)
    if (!href || !isValidHttpUrl(href)) return []
    return [{ id, label, href }]
  })

  const siteDefs: Array<{ id: SiteLinkId; label: string; value?: string }> = [
    { id: "helpCenter", label: "Visit Help Center", value: env.helpCenter },
    { id: "privacy", label: "Privacy Policy", value: env.privacy },
    { id: "terms", label: "Terms of Service", value: env.terms },
    { id: "support", label: "Support", value: env.support },
  ]

  const siteLinks: SiteLink[] = siteDefs.flatMap(({ id, label, value }) => {
    const href = normalizeOptionalSiteLink(value)
    if (!href) return []
    return [{ id, label, href }]
  })

  return { channels, socials, siteLinks }
}

/** Reads `NEXT_PUBLIC_*` contact/social env vars at call time. */
export function getContactConfig(): ContactConfig {
  return buildContactConfig({
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE,
    office: process.env.NEXT_PUBLIC_CONTACT_OFFICE,
    hours: process.env.NEXT_PUBLIC_CONTACT_HOURS,
    twitter: process.env.NEXT_PUBLIC_SOCIAL_TWITTER_URL,
    linkedin: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL,
    github: process.env.NEXT_PUBLIC_SOCIAL_GITHUB_URL,
    helpCenter: process.env.NEXT_PUBLIC_HELP_CENTER_URL,
    privacy: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL,
    terms: process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL,
    support: process.env.NEXT_PUBLIC_SUPPORT_URL,
  })
}
