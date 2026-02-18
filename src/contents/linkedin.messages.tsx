import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import React, { useEffect, useMemo, useState } from "react"

import AssistantCard from "~components/AssistantCard"
import BatchReviewModal from "~components/BatchReviewModal"
import InboxSummaryBar from "~components/InboxSummaryBar"
import {
  buildThreadSnapshot,
  insertIntoComposer,
  isLinkedInMessagesPage,
  scanConversationList
} from "~lib/linkedin-dom"
import { sendToBackground } from "~lib/messaging"
import type {
  ReplySuggestion,
  ThreadClassification,
  ThreadSnapshot,
  UserPrefs
} from "~lib/types"
import { formatPct, now } from "~lib/utils"
import stylesCard from "~styles/assistantCard.module.css"
import stylesInbox from "~styles/inboxBar.module.css"

/**
 * Plasmo config:
 * - Only run on LinkedIn messaging routes
 */
export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/*"],
  all_frames: false
}

// Ensure our CSS Modules are loaded
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = "" // CSS Modules are injected by Plasmo build pipeline
  return style
}

function useMutationRerender(enabled: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const obs = new MutationObserver(() => setTick((t) => t + 1))
    obs.observe(document.documentElement, { subtree: true, childList: true })
    return () => obs.disconnect()
  }, [enabled])
}

export default function LinkedInMessagesOverlay() {
  const [prefs, setPrefs] = useState<UserPrefs | null>(null)
  const [activeSnapshot, setActiveSnapshot] = useState<ThreadSnapshot | null>(
    null
  )

  const [classification, setClassification] =
    useState<ThreadClassification | null>(null)
  const [suggestion, setSuggestion] = useState<ReplySuggestion | null>(null)

  const [status, setStatus] = useState<
    "idle" | "classifying" | "ready" | "generating" | "error"
  >("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Inbox/batch features
  const [inboxThreads, setInboxThreads] = useState<ThreadSnapshot[]>([])
  const [inboxCounts, setInboxCounts] = useState({
    interested: 0,
    maybe: 0,
    objection: 0,
    ghosted: 0,
    ignored: 0
  })
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchQueue, setBatchQueue] = useState<ThreadSnapshot[]>([])

  // LinkedIn DOM is dynamic; we re-check regularly + on mutations.
  useMutationRerender(isLinkedInMessagesPage())

  // Load prefs
  useEffect(() => {
    ;(async () => {
      const r = await sendToBackground({ type: "GET_PREFS" })
      if (r.ok && r.type === "GET_PREFS") setPrefs(r.prefs)
    })()
  }, [])

  // Build snapshot for active thread
  useEffect(() => {
    if (!prefs) return
    if (!isLinkedInMessagesPage()) return

    const snap = buildThreadSnapshot(
      prefs.maxMessagesToSend,
      prefs.maskEmailsPhones
    )
    setActiveSnapshot(snap)
  }, [prefs])

  // Classify active thread whenever snapshot changes
  useEffect(() => {
    ;(async () => {
      if (!prefs || !activeSnapshot) return

      setStatus("classifying")
      setErrorMsg(null)

      const r = await sendToBackground({
        type: "CLASSIFY_THREAD",
        snapshot: activeSnapshot
      })
      if (r.type === "ERROR") {
        setStatus("error")
        setErrorMsg(r.error)
        return
      }

      if (r.type === "CLASSIFY_THREAD") {
        setClassification(r.classification)
        setStatus("ready")
      }
    })()
  }, [prefs, activeSnapshot?.threadId])

  // Scan conversation list for inbox summary (lightweight)
  useEffect(() => {
    ;(async () => {
      if (!prefs) return
      if (!isLinkedInMessagesPage()) return

      const threads = scanConversationList(prefs.maskEmailsPhones, 50)
      setInboxThreads(threads)

      // We keep counts local using cached suggestions when possible.
      // For V1, we approximate:
      // - We don’t call AI for every thread automatically.
      // - We count "ignored" as those with sponsored signals.
      const ignored = threads.filter((t) => t.hasSponsoredSignals).length

      setInboxCounts((c) => ({ ...c, ignored }))
    })()
  }, [prefs])

  const shouldShowAssistant = useMemo(() => {
    if (!prefs || !classification) return false
    if (!prefs.outreachOnly) return true // user wants it everywhere (not recommended)
    return (
      classification.bucket === "outreach" &&
      classification.confidence >= prefs.minConfidence
    )
  }, [prefs, classification])

  const assistantMutedReason = useMemo(() => {
    if (!prefs || !classification) return null
    if (!prefs.outreachOnly) return null
    if (classification.bucket !== "outreach")
      return `Not an outreach thread (${classification.bucket}).`
    if (classification.confidence < prefs.minConfidence)
      return `Low confidence (${formatPct(classification.confidence)}). Threshold is ${formatPct(prefs.minConfidence)}.`
    return null
  }, [prefs, classification])

  async function onGenerate() {
    if (!prefs || !activeSnapshot) return
    setStatus("generating")
    setErrorMsg(null)

    const r = await sendToBackground({
      type: "GENERATE_REPLY",
      snapshot: activeSnapshot
    })
    if (r.type === "ERROR") {
      setStatus("error")
      setErrorMsg(r.error)
      return
    }

    if (r.type === "GENERATE_REPLY") {
      setSuggestion(r.suggestion)
      // Sometimes background returns classification too
      if (r.classification) setClassification(r.classification)
      setStatus("ready")
    }
  }

  async function onRegenerate() {
    if (!prefs || !activeSnapshot) return
    setStatus("generating")
    setErrorMsg(null)

    const r = await sendToBackground({
      type: "REGENERATE_REPLY",
      snapshot: activeSnapshot
    })
    if (r.type === "ERROR") {
      setStatus("error")
      setErrorMsg(r.error)
      return
    }

    if (r.type === "REGENERATE_REPLY") {
      setSuggestion(r.suggestion)
      setStatus("ready")
    }
  }

  function onInsert(text: string) {
    const ok = insertIntoComposer(text)
    if (!ok) {
      setStatus("error")
      setErrorMsg(
        "Could not find LinkedIn message composer. LinkedIn UI may have changed."
      )
    }
  }

  // Batch mode: choose a queue and open modal
  async function onOpenBatch(mode: "interested_first" | "all_visible") {
    // In V1 we only have visible list previews;
    // for batch we let user pick from visible threads.
    // You can refine later by fetching more threads via scrolling automation (careful).
    const queue =
      mode === "all_visible" ? inboxThreads : inboxThreads.slice(0, 10)
    setBatchQueue(queue)
    setBatchOpen(true)
  }

  // Only render on messages page
  if (!isLinkedInMessagesPage() || !prefs) return null

  return (
    <>
      {/* Inbox Summary bar (top of conversation list) */}
      <div className={stylesInbox.root}>
        <InboxSummaryBar
          counts={inboxCounts}
          onReviewInterested={() => onOpenBatch("interested_first")}
          onReviewAll={() => onOpenBatch("all_visible")}
        />
      </div>

      {/* Assistant Card */}
      <div className={stylesCard.overlayRoot}>
        <AssistantCard
          prefs={prefs}
          classification={classification}
          suggestion={suggestion}
          status={status}
          errorMsg={errorMsg}
          mutedReason={assistantMutedReason}
          show={true} // always show the card; it can go "quiet mode"
          canGenerate={!!activeSnapshot && !!classification}
          shouldGenerate={shouldShowAssistant}
          onGenerate={onGenerate}
          onRegenerate={onRegenerate}
          onInsert={onInsert}
        />
      </div>

      {/* Batch Review Modal */}
      <BatchReviewModal
        open={batchOpen}
        prefs={prefs}
        initialQueue={batchQueue}
        onClose={() => setBatchOpen(false)}
        onOpenThread={(threadId) => {
          // In V1 we can’t reliably navigate to a specific thread by id.
          // Instead we close and let user click the conversation.
          // In later versions, you can try click automation carefully.
          setBatchOpen(false)
        }}
      />
    </>
  )
}
