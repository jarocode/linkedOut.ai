import React, { useEffect, useState } from "react"

import { sendToBackground } from "~lib/messaging"
import type { CTA, Tone, UserPrefs } from "~lib/types"
import styles from "~styles/options.module.css"

const TONES: Tone[] = ["casual", "professional", "direct"]
const CTAS: { value: CTA; label: string }[] = [
  { value: "ask_15min_call", label: "Ask for 15-min call" },
  { value: "ask_clarifying_question", label: "Ask a clarifying question" },
  { value: "send_info", label: "Offer to send info" },
  { value: "soft_bump", label: "Soft bump follow-up" },
  { value: "none", label: "No CTA" }
]

export default function Options() {
  const [prefs, setPrefs] = useState<UserPrefs | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      const r = await sendToBackground({ type: "GET_PREFS" })
      if (r.ok && r.type === "GET_PREFS") setPrefs(r.prefs)
    })()
  }, [])

  async function save(next: UserPrefs) {
    setPrefs(next)
    await sendToBackground({ type: "SET_PREFS", prefs: next })
    setSaved(true)
    setTimeout(() => setSaved(false), 900)
  }

  if (!prefs) return <div className={styles.root}>Loading…</div>

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>AI Reply Assistant — Settings</div>
        <div className={styles.subtle}>
          Make suggestions “ready-to-send” by default.
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Backend</h3>
          <label className={styles.label}>API Base URL</label>
          <input
            className={styles.input}
            value={prefs.apiBaseUrl}
            onChange={(e) => save({ ...prefs, apiBaseUrl: e.target.value })}
            placeholder="https://your-api.com"
          />
          <div className={styles.hint}>
            Used by background to call /classify-thread and /generate-reply.
          </div>
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Defaults</h3>

          <label className={styles.label}>Tone</label>
          <select
            className={styles.select}
            value={prefs.tone}
            onChange={(e) => save({ ...prefs, tone: e.target.value as Tone })}>
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <label className={styles.label}>Primary CTA</label>
          <select
            className={styles.select}
            value={prefs.cta}
            onChange={(e) => save({ ...prefs, cta: e.target.value as CTA })}>
            {CTAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <label className={styles.label}>Calendar link (optional)</label>
          <input
            className={styles.input}
            value={prefs.calendarLink ?? ""}
            onChange={(e) => save({ ...prefs, calendarLink: e.target.value })}
            placeholder="https://cal.com/you/15min"
          />
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Safety & Relevance</h3>

          <label className={styles.row}>
            <input
              type="checkbox"
              checked={prefs.outreachOnly}
              onChange={(e) =>
                save({ ...prefs, outreachOnly: e.target.checked })
              }
            />
            <span>Only show AI for outreach threads</span>
          </label>

          <label className={styles.label}>Min confidence</label>
          <input
            className={styles.range}
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={prefs.minConfidence}
            onChange={(e) =>
              save({ ...prefs, minConfidence: Number(e.target.value) })
            }
          />
          <div className={styles.hint}>
            Higher = safer, fewer false positives.
          </div>

          <label className={styles.row}>
            <input
              type="checkbox"
              checked={prefs.allowInboundDismissTemplates}
              onChange={(e) =>
                save({
                  ...prefs,
                  allowInboundDismissTemplates: e.target.checked
                })
              }
            />
            <span>Allow inbound dismiss templates</span>
          </label>
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Privacy</h3>

          <label className={styles.label}>Max messages sent for context</label>
          <input
            className={styles.input}
            type="number"
            min={3}
            max={20}
            value={prefs.maxMessagesToSend}
            onChange={(e) =>
              save({ ...prefs, maxMessagesToSend: Number(e.target.value) })
            }
          />
          <div className={styles.hint}>
            Fewer messages = more privacy, less context.
          </div>

          <label className={styles.row}>
            <input
              type="checkbox"
              checked={prefs.maskEmailsPhones}
              onChange={(e) =>
                save({ ...prefs, maskEmailsPhones: e.target.checked })
              }
            />
            <span>Mask emails & phone numbers before sending</span>
          </label>
        </section>
      </div>

      <div className={styles.footer}>
        <div className={styles.saveState}>{saved ? "Saved ✓" : ""}</div>
      </div>
    </div>
  )
}
