export type ThreadBucket = "outreach" | "inbound_pitch" | "personal" | "system"

export type IntentLabel =
  | "interested"
  | "maybe"
  | "objection"
  | "not_interested"
  | "ghosted"
  | "unknown"

export type Tone = "casual" | "professional" | "direct"

export type CTA =
  | "ask_15min_call"
  | "ask_clarifying_question"
  | "send_info"
  | "soft_bump"
  | "none"

export type ThreadClassification = {
  bucket: ThreadBucket
  confidence: number // 0..1
  why: string[]
  classifiedAt: number // epoch ms
}

export type ReplySuggestion = {
  threadId: string
  intent: IntentLabel
  suggestedText: string
  alternatives?: string[]
  generatedAt: number
}

export type ThreadMessage = {
  author: "me" | "them"
  text: string
  ts?: string
}

export type ThreadSnapshot = {
  threadId: string
  participants: { name?: string; profileUrl?: string }[]
  messages: ThreadMessage[] // last N messages
  lastInboundText?: string // last message from them
  hasSponsoredSignals?: boolean
  iHaveMessaged?: boolean
  pageUrl: string
}

export type UserPrefs = {
  apiBaseUrl: string // your backend, e.g. https://your-api.com
  tone: Tone
  cta: CTA
  calendarLink?: string

  // Safety & relevance
  outreachOnly: boolean // default true
  minConfidence: number // default 0.75
  allowInboundDismissTemplates: boolean // default true

  // Privacy
  maxMessagesToSend: number // default 10
  maskEmailsPhones: boolean // default true
}

export type Usage = {
  usedThisMonth: number
  limitThisMonth: number
  lastUpdatedAt: number
}

export type Cache = {
  classifications: Record<string, ThreadClassification>
  suggestions: Record<string, ReplySuggestion>
  ignoredThreads: Record<string, true>
}
