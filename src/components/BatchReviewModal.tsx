import React, { useEffect, useMemo, useState } from "react"

import { sendToBackground } from "~lib/messaging"
import type {
  ReplySuggestion,
  ThreadClassification,
  ThreadSnapshot,
  UserPrefs
} from "~lib/types"
import styles from "~styles/batchReview.module.css"

import IntentBadge from "./IntentBadge"

/**
 * Batch Review:
 * - Shows one thread preview at a time
 * - Generates suggestion on demand
 * - Approve & Next inserts text? (In V1 we cannot reliably insert into another thread without navigating)
 *   So "Approve & Next" copies to clipboard; user can open thread and paste.
 *
 * This is a realistic compromise for V1 while keeping UX valuable.
 * Later you can implement "open thread" automation carefully.
 */
export default function BatchReviewModal({
  open,
  prefs,
  initialQueue,
  onClose,
  onOpenThread
}: {
  open: boolean
  prefs: UserPrefs
  initialQueue: ThreadSnapshot[]
  onClose: () => void
  onOpenThread: (threadId: string) => void
}) {
  const [queue, setQueue] = useState<ThreadSnapshot[]>([])
  const [idx, setIdx] = useState(0)

  const [classification, setClassification] =
    useState<ThreadClassification | null>(null)
  const [suggestion, setSuggestion] = useState<ReplySuggestion | null>(null)
  const [draft, setDraft] = useState("")
  const [status, setStatus] = useState<
    "idle" | "classifying" | "generating" | "ready" | "error"
  >("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQueue(initialQueue ?? [])
    setIdx(0)
    setClassification(null)
    setSuggestion(null)
    setDraft("")
    setStatus("idle")
    setError(null)
  }, [open, initialQueue])

  const current = queue[idx] ?? null

  useEffect(() => {
    ;(async () => {
      if (!open || !current) return
      setError(null)
      setStatus("classifying")

      const r = await sendToBackground({
        type: "CLASSIFY_THREAD",
        snapshot: current
      })
      if (r.type === "ERROR") {
        setStatus("error")
        setError(r.error)
        return
      }
      if (r.type === "CLASSIFY_THREAD") {
        setClassification(r.classification)
        setStatus("ready")
        setSuggestion(null)
        setDraft("")
      }
    })()
  }, [open, current?.threadId])

  async function generate() {
    if (!current) return
    setStatus("generating")
    setError(null)

    const r = await sendToBackground({
      type: "GENERATE_REPLY",
      snapshot: current
    })
    if (r.type === "ERROR") {
      setStatus("error")
      setError(r.error)
      return
    }
    if (r.type === "GENERATE_REPLY") {
      setSuggestion(r.suggestion)
      setDraft("")
      setStatus("ready")
    }
  }

  async function regenerate() {
    if (!current) return
    setStatus("generating")
    setError(null)

    const r = await sendToBackground({
      type: "REGENERATE_REPLY",
      snapshot: current
    })
    if (r.type === "ERROR") {
      setStatus("error")
      setError(r.error)
      return
    }
    if (r.type === "REGENERATE_REPLY") {
      setSuggestion(r.suggestion)
      setDraft("")
      setStatus("ready")
    }
  }

  function next() {
    setIdx((i) => Math.min(queue.length - 1, i + 1))
  }

  function skip() {
    next()
  }

  async function approveAndCopy() {
    const text = draft || suggestion?.suggestedText || ""
    if (!text) return
    await navigator.clipboard.writeText(text)
    next()
  }

  if (!open) return null

  const bucket = classification?.bucket ?? "—"
  const eligible = classification
    ? !prefs.outreachOnly ||
      (bucket === "outreach" &&
        classification.confidence >= prefs.minConfidence)
    : false

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.topbar}>
          <div className={styles.title}>Batch Review</div>
          <div className={styles.subtle}>
            {queue.length ? `${idx + 1}/${queue.length}` : "0/0"}
          </div>
          <button className={styles.close} type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        {!current ? (
          <div className={styles.empty}>No threads available.</div>
        ) : (
          <>
            <div className={styles.threadHeader}>
              <div className={styles.threadName}>
                {current.participants[0]?.name ?? "Unknown"}
              </div>
              <div className={styles.threadMeta}>
                <span className={styles.pill}>{bucket}</span>
                {suggestion ? (
                  <IntentBadge intent={suggestion.intent} />
                ) : (
                  <IntentBadge intent="unknown" />
                )}
              </div>
            </div>

            <div className={styles.preview}>
              <div className={styles.previewLabel}>Last message preview</div>
              <div className={styles.previewText}>
                {current.lastInboundText ?? "—"}
              </div>
            </div>

            <div className={styles.actionsRow}>
              <button
                className={styles.secondary}
                type="button"
                onClick={() => onOpenThread(current.threadId)}>
                Open Thread
              </button>

              <button className={styles.secondary} type="button" onClick={skip}>
                Skip
              </button>

              <button
                className={styles.primary}
                type="button"
                onClick={generate}
                disabled={!eligible}>
                {status === "generating" ? "Generating…" : "Generate"}
              </button>

              <button
                className={styles.secondary}
                type="button"
                onClick={regenerate}
                disabled={!suggestion || !eligible}>
                Regenerate
              </button>
            </div>

            <textarea
              className={styles.textarea}
              value={draft || suggestion?.suggestedText || ""}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                eligible
                  ? "Generate a reply to see it here."
                  : "Not eligible (Outreach only / low confidence)."
              }
              disabled={!eligible}
              rows={7}
            />

            <div className={styles.bottomRow}>
              <div className={styles.hint}>
                Approve & Next copies to clipboard (safe V1). Open thread and
                paste.
              </div>
              <button
                className={styles.primary}
                type="button"
                onClick={approveAndCopy}
                disabled={!eligible || !(draft || suggestion?.suggestedText)}>
                Approve & Next (Copy)
              </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}
          </>
        )}
      </div>
    </div>
  )
}
