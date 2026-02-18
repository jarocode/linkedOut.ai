// Small helpers used across the UI and content scripts

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

export function formatPct(n: number) {
  const v = Math.round(clamp01(n) * 100)
  return `${v}%`
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function now() {
  return Date.now()
}

// Basic masking to reduce accidental data leakage to your backend/model.
// This is not perfect; it’s a pragmatic privacy improvement.
export function maskSensitive(text: string) {
  // emails
  let t = text.replace(
    /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
    "[email_redacted]"
  )
  // phone-ish
  t = t.replace(/(\+?\d[\d\s().-]{7,}\d)/g, "[phone_redacted]")
  return t
}

export function stableHash(input: string) {
  // Simple non-crypto hash for deriving stable IDs when LinkedIn thread ID is not accessible.
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return `h_${Math.abs(h)}`
}
