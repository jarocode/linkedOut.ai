import React, { useMemo, useState } from "react"

import type {
  ReplySuggestion,
  ThreadClassification,
  UserPrefs
} from "~lib/types"
import { formatPct } from "~lib/utils"
import styles from "~styles/assistantCard.module.css"

import IntentBadge from "./IntentBadge"

/**
 * The in-thread assistant UI:
 * - Shows classification, confidence, and "why"
 * - Shows suggestion (if generated)
 * - Generate / Regenerate
 * - Insert to composer
 * - Quiet mode when not outreach / low confidence
 */
export default function AssistantCard({
  prefs,
  classification,
  suggestion,
  status,
  errorMsg,
  mutedReason,
  show,
  canGenerate,
  shouldGenerate,
  onGenerate,
  onRegenerate,
  onInsert
}: {
  prefs: UserPrefs
  classification: ThreadClassification | null
  suggestion: ReplySuggestion | null
  status: "idle" | "classifying" | "ready" | "generating" | "error"
  errorMsg: string | null
  mutedReason: string | null
  show: boolean
  canGenerate: boolean
  shouldGenerate: boolean
  onGenerate: () => void
  onRegenerate: () => void
  onInsert: (text: string) => void
}) {
  const [expandedWhy, setExpandedWhy] = useState(false)
  const [draft, setDraft] = useState<string>("")

  const suggested = suggestion?.suggestedText ?? ""
  const textValue = draft || suggested

  // Whenever we get a new suggestion, reset draft (so user edits are per-suggestion)
  React.useEffect(() => setDraft(""), [suggestion?.generatedAt])

  const headerRight = useMemo(() => {
    if (status === "classifying") return "Classifying…"
    if (status === "generating") return "Generating…"
    if (status === "error") return "Issue"
    return "Ready"
  }, [status])

  if (!show) return null

  const bucket = classification?.bucket ?? "—"
  const conf = classification ? formatPct(classification.confidence) : "—"

  const quiet = !!mutedReason

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.bot}>🤖</span>
          <span>AI Reply Assistant</span>
        </div>
        <div className={styles.status}>{headerRight}</div>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.metaBlock}>
          <div className={styles.metaLabel}>Thread Type</div>
          <div className={styles.metaValue}>
            <span className={styles.pill}>{bucket}</span>{" "}
            <span className={styles.subtle}>({conf})</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.linkButton}
          onClick={() => setExpandedWhy((v) => !v)}
          disabled={!classification}>
          Why?
        </button>
      </div>

      {expandedWhy && classification && (
        <ul className={styles.whyList}>
          {classification.why.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Intent Detected</div>
          <div>
            {suggestion ? (
              <IntentBadge intent={suggestion.intent} />
            ) : (
              <IntentBadge intent="unknown" />
            )}
          </div>
        </div>

        {quiet && (
          <div className={styles.quietBox}>
            <div className={styles.quietTitle}>Quiet mode</div>
            <div className={styles.quietText}>{mutedReason}</div>
            <div className={styles.quietHint}>
              You can relax this in Options (Outreach Only / Confidence
              Threshold).
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Suggested Reply</div>
          <div className={styles.subtleSmall}>
            Manual approval • never auto-sends
          </div>
        </div>

        <textarea
          className={styles.textarea}
          value={textValue}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            quiet
              ? "This thread is not eligible for suggestions."
              : "Generate a suggestion to see it here."
          }
          disabled={quiet}
          rows={7}
        />

        <div className={styles.controls}>
          <button
            className={styles.primary}
            onClick={onGenerate}
            disabled={
              !canGenerate ||
              quiet ||
              status === "classifying" ||
              status === "generating"
            }
            type="button">
            {suggestion ? "Generate again" : "Generate"}
          </button>

          <button
            className={styles.secondary}
            onClick={onRegenerate}
            disabled={!suggestion || quiet || status === "generating"}
            type="button">
            Regenerate
          </button>

          <button
            className={styles.ghost}
            onClick={() => onInsert(textValue)}
            disabled={!textValue || quiet}
            type="button">
            Insert into chat
          </button>
        </div>

        {errorMsg && <div className={styles.errorBox}>{errorMsg}</div>}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerNote}>
          Tip: Set your default Tone/CTA in Options so suggestions are
          “ready-to-send”.
        </div>
      </div>
    </div>
  )
}
