import type { BgRequest, BgResponse } from "~lib/messaging"
import {
  getCache,
  getPrefs,
  getUsage,
  setCache,
  setPrefs,
  setUsage
} from "~lib/storage"
import type {
  Cache,
  ReplySuggestion,
  ThreadClassification,
  ThreadSnapshot
} from "~lib/types"
import { now } from "~lib/utils"

/**
 * Background responsibilities:
 * - caching thread classifications & suggestions
 * - calling your backend (or mock)
 * - enforcing basic limits
 */

function cheapRuleClassify(
  snapshot: ThreadSnapshot
): ThreadClassification | null {
  // Quick deterministic filters to avoid unnecessary model calls
  if (snapshot.hasSponsoredSignals) {
    return {
      bucket: "system",
      confidence: 0.95,
      why: ["Detected Sponsored/InMail/system signals"],
      classifiedAt: now()
    }
  }

  if (!snapshot.iHaveMessaged) {
    // Could be inbound pitch or personal; we'll keep low confidence and let AI decide if needed
    return {
      bucket: "inbound_pitch",
      confidence: 0.55,
      why: [
        "You have not messaged in this thread (likely inbound or unrelated)"
      ],
      classifiedAt: now()
    }
  }

  return null
}

async function backendClassify(
  prefsBaseUrl: string,
  snapshot: ThreadSnapshot
): Promise<ThreadClassification> {
  // Replace with your real endpoint.
  // Keeping a fallback if backend is not reachable (for development).
  try {
    const res = await fetch(
      `${prefsBaseUrl.replace(/\/$/, "")}/classify-thread`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot)
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    // Dev fallback: assume outreach if user has messaged and no sponsored signals
    return {
      bucket: snapshot.iHaveMessaged ? "outreach" : "personal",
      confidence: snapshot.iHaveMessaged ? 0.78 : 0.62,
      why: ["Fallback classifier used (backend unavailable)"],
      classifiedAt: now()
    }
  }
}

async function backendGenerate(
  prefsBaseUrl: string,
  snapshot: ThreadSnapshot,
  force = false
): Promise<ReplySuggestion> {
  try {
    const res = await fetch(
      `${prefsBaseUrl.replace(/\/$/, "")}/generate-reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, force })
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    // Dev fallback: simple template output
    const name = snapshot.participants[0]?.name ?? "there"
    return {
      threadId: snapshot.threadId,
      intent: "interested",
      suggestedText: `Thanks, ${name}! Happy to share more. Would a quick 15-min call this week make sense?`,
      alternatives: [
        `Great—what’s the best time for a quick 10–15 min chat?`,
        `Sounds good. Want me to send a short overview first, or jump on a quick call?`
      ],
      generatedAt: now()
    }
  }
}

async function enforceUsageOrThrow() {
  const usage = await getUsage()
  if (usage.usedThisMonth >= usage.limitThisMonth) {
    throw new Error("Monthly limit reached. Upgrade your plan to continue.")
  }
  // increment in background when we generate
  usage.usedThisMonth += 1
  usage.lastUpdatedAt = now()
  await setUsage(usage)
}

chrome.runtime.onMessage.addListener(
  (req: BgRequest, _sender, sendResponse) => {
    ;(async () => {
      try {
        if (req.type === "GET_PREFS") {
          const prefs = await getPrefs()
          sendResponse({
            ok: true,
            type: "GET_PREFS",
            prefs
          } satisfies BgResponse)
          return
        }

        if (req.type === "SET_PREFS") {
          await setPrefs(req.prefs)
          sendResponse({ ok: true, type: "SET_PREFS" } satisfies BgResponse)
          return
        }

        if (req.type === "GET_USAGE") {
          const usage = await getUsage()
          sendResponse({
            ok: true,
            type: "GET_USAGE",
            usage
          } satisfies BgResponse)
          return
        }

        if (req.type === "IGNORE_THREAD") {
          const cache = await getCache()
          if (req.ignore) cache.ignoredThreads[req.threadId] = true
          else delete cache.ignoredThreads[req.threadId]
          await setCache(cache)
          sendResponse({ ok: true, type: "IGNORE_THREAD" } satisfies BgResponse)
          return
        }

        if (req.type === "CLASSIFY_THREAD") {
          const prefs = await getPrefs()
          const cache = await getCache()

          if (cache.ignoredThreads[req.snapshot.threadId]) {
            const c: ThreadClassification = {
              bucket: "personal",
              confidence: 0.99,
              why: ["Thread is ignored by user"],
              classifiedAt: now()
            }
            sendResponse({
              ok: true,
              type: "CLASSIFY_THREAD",
              classification: c
            } satisfies BgResponse)
            return
          }

          const cached = cache.classifications[req.snapshot.threadId]
          if (cached && now() - cached.classifiedAt < 1000 * 60 * 60 * 24) {
            sendResponse({
              ok: true,
              type: "CLASSIFY_THREAD",
              classification: cached
            } satisfies BgResponse)
            return
          }

          const quick = cheapRuleClassify(req.snapshot)
          const classification =
            quick ?? (await backendClassify(prefs.apiBaseUrl, req.snapshot))

          cache.classifications[req.snapshot.threadId] = classification
          await setCache(cache)

          sendResponse({
            ok: true,
            type: "CLASSIFY_THREAD",
            classification
          } satisfies BgResponse)
          return
        }

        if (req.type === "GENERATE_REPLY" || req.type === "REGENERATE_REPLY") {
          const prefs = await getPrefs()
          const cache: Cache = await getCache()

          // Ensure classification exists (so UI can decide whether to generate)
          let classification = cache.classifications[req.snapshot.threadId]
          if (
            !classification ||
            now() - classification.classifiedAt > 1000 * 60 * 60 * 24
          ) {
            const quick = cheapRuleClassify(req.snapshot)
            classification =
              quick ?? (await backendClassify(prefs.apiBaseUrl, req.snapshot))
            cache.classifications[req.snapshot.threadId] = classification
          }

          // Usage enforcement only when we actually generate
          await enforceUsageOrThrow()

          const suggestion = await backendGenerate(
            prefs.apiBaseUrl,
            req.snapshot,
            req.type === "REGENERATE_REPLY"
          )

          cache.suggestions[req.snapshot.threadId] = suggestion
          await setCache(cache)

          if (req.type === "GENERATE_REPLY") {
            sendResponse({
              ok: true,
              type: "GENERATE_REPLY",
              suggestion,
              classification
            } satisfies BgResponse)
          } else {
            sendResponse({
              ok: true,
              type: "REGENERATE_REPLY",
              suggestion
            } satisfies BgResponse)
          }
          return
        }

        sendResponse({
          ok: false,
          type: "ERROR",
          error: "Unknown request"
        } satisfies BgResponse)
      } catch (e: any) {
        sendResponse({
          ok: false,
          type: "ERROR",
          error: e?.message ?? "Unknown error"
        } satisfies BgResponse)
      }
    })()

    // Important: async response
    return true
  }
)
