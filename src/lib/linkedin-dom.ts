import type { ThreadMessage, ThreadSnapshot } from "./types"
import { maskSensitive, stableHash } from "./utils"

/**
 * LinkedIn is a SPA and changes DOM frequently.
 * The goal is to be resilient:
 * - Use multiple selector fallbacks
 * - Degrade gracefully if we can't parse everything
 */

// Route check
export function isLinkedInMessagesPage() {
  return (
    location.hostname.includes("linkedin.com") &&
    location.pathname.includes("/messaging")
  )
}

// Try to infer if a thread has sponsored/inmail signals
function detectSponsoredSignals(root: Document | HTMLElement) {
  const el = root instanceof Document ? root.body : root
  const text = el?.innerText ?? ""
  // Heuristic keywords; adjust as you observe reality
  return /sponsored|inmail/i.test(text)
}

// Extract the active thread "id".
// LinkedIn may expose IDs in URL params or DOM.
// If not accessible, fall back to a stable hash of participants + last message.
export function getActiveThreadId(): string | null {
  // Heuristic: message thread often includes a "conversation" id in URL
  const url = new URL(location.href)
  const maybe =
    url.searchParams.get("conversationId") || url.searchParams.get("threadId")
  if (maybe) return `li_${maybe}`

  // Fallback: derive from visible participant + last message
  const name = getActiveParticipantName() ?? "unknown"
  const last = getLastVisibleMessageText() ?? "none"
  return stableHash(`${name}::${last}`)
}

export function getActiveParticipantName(): string | null {
  // Fallback selectors; LinkedIn frequently changes these
  const selectors = [
    'h2[aria-label*="conversation"]',
    'h2 span[dir="ltr"]',
    "header h2",
    "header h2 span"
  ]
  for (const s of selectors) {
    const el = document.querySelector(s)
    const t = el?.textContent?.trim()
    if (t) return t
  }
  return null
}

export function getLastVisibleMessageText(): string | null {
  const candidates = Array.from(
    document.querySelectorAll(
      "[data-event-urn] span, .msg-s-event-listitem__body span"
    )
  )
  const last = candidates
    .map((el) => el.textContent?.trim())
    .filter(Boolean)
    .pop()
  return last ?? null
}

function extractMessages(maxN: number, mask: boolean): ThreadMessage[] {
  // This is intentionally heuristic. You will refine selectors during testing.
  const rows = Array.from(
    document.querySelectorAll(
      ".msg-s-message-list__event, .msg-s-event-listitem, [data-control-name='message']"
    )
  )

  // Pull text spans; detect author by simple heuristics (presence of "You" label or alignment)
  const msgs: ThreadMessage[] = []
  for (const row of rows) {
    const text = row.textContent?.trim()
    if (!text) continue

    // crude author detection; you will improve with DOM structure
    const isMe =
      /you/i.test(row.getAttribute("aria-label") ?? "") ||
      row.classList.contains("msg-s-event-listitem--is-from-user")

    msgs.push({
      author: isMe ? "me" : "them",
      text: mask ? maskSensitive(text) : text
    })
  }

  // Keep last N
  return msgs.slice(-maxN)
}

export function buildThreadSnapshot(
  maxMessagesToSend: number,
  mask: boolean
): ThreadSnapshot | null {
  const threadId = getActiveThreadId()
  if (!threadId) return null

  const participantName = getActiveParticipantName()
  const pageUrl = location.href

  const messages = extractMessages(maxMessagesToSend, mask)

  const lastInbound = [...messages]
    .reverse()
    .find((m) => m.author === "them")?.text

  const iHaveMessaged = messages.some((m) => m.author === "me")

  return {
    threadId,
    participants: [{ name: participantName ?? undefined }],
    messages,
    lastInboundText: lastInbound,
    hasSponsoredSignals: detectSponsoredSignals(document),
    iHaveMessaged,
    pageUrl
  }
}

/**
 * Insert suggested text into LinkedIn composer.
 * LinkedIn uses rich editors; best approach is:
 * - Focus the editor
 * - Update text content
 * - Dispatch input event
 */
export function insertIntoComposer(text: string): boolean {
  const selectors = [
    // common contenteditable selector
    '[contenteditable="true"][role="textbox"]',
    ".msg-form__contenteditable",
    ".msg-form__msg-content-container [contenteditable='true']"
  ]

  let editor: HTMLElement | null = null
  for (const s of selectors) {
    const el = document.querySelector(s) as HTMLElement | null
    if (el) {
      editor = el
      break
    }
  }
  if (!editor) return false

  editor.focus()

  // Attempt to set text. Some editors store text in nested spans.
  // This is a best-effort approach and will be refined in real testing.
  editor.innerText = text

  // Notify React/LinkedIn that content changed
  editor.dispatchEvent(new InputEvent("input", { bubbles: true }))

  return true
}

/**
 * Conversation list scanning for Inbox Summary & Batch Review.
 * This is a lightweight pass: extract visible thread previews.
 */
export function scanConversationList(
  mask: boolean,
  limit = 40
): ThreadSnapshot[] {
  const items = Array.from(
    document.querySelectorAll(
      "li.msg-conversation-listitem, li[data-test-conversation-list-item]"
    )
  )

  const out: ThreadSnapshot[] = []
  for (const item of items.slice(0, limit)) {
    const name =
      item
        .querySelector(".msg-conversation-listitem__participant-names")
        ?.textContent?.trim() ||
      item.querySelector("h3")?.textContent?.trim() ||
      "Unknown"

    const preview =
      item
        .querySelector(".msg-conversation-listitem__message-snippet")
        ?.textContent?.trim() ||
      item.textContent?.trim() ||
      ""

    const threadId = stableHash(`${name}::${preview}`)

    out.push({
      threadId,
      participants: [{ name }],
      messages: [
        { author: "them", text: mask ? maskSensitive(preview) : preview }
      ],
      lastInboundText: mask ? maskSensitive(preview) : preview,
      hasSponsoredSignals: /sponsored/i.test(item.textContent ?? ""),
      iHaveMessaged: false,
      pageUrl: location.href
    })
  }

  return out
}
