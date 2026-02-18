import React, { useEffect, useState } from "react"

import Toggle from "~components/Toggle"
import { sendToBackground } from "~lib/messaging"
import type { Usage, UserPrefs } from "~lib/types"
import styles from "~styles/popup.module.css"

export default function Popup() {
  const [prefs, setPrefs] = useState<UserPrefs | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    ;(async () => {
      const p = await sendToBackground({ type: "GET_PREFS" })
      if (p.ok && p.type === "GET_PREFS") setPrefs(p.prefs)

      const u = await sendToBackground({ type: "GET_USAGE" })
      if (u.ok && u.type === "GET_USAGE") setUsage(u.usage)
    })()
  }, [])

  async function updatePrefs(next: UserPrefs) {
    setPrefs(next)
    await sendToBackground({ type: "SET_PREFS", prefs: next })
  }

  if (!prefs) return <div className={styles.root}>Loading…</div>

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.brand}>🤖 AI Reply Assistant</div>
        <div className={styles.subtle}>LinkedIn Messages</div>
      </div>

      <div className={styles.section}>
        <Toggle
          label="Outreach only (recommended)"
          checked={prefs.outreachOnly}
          onChange={(v) => updatePrefs({ ...prefs, outreachOnly: v })}
        />
        <Toggle
          label="Show inbound dismiss templates"
          checked={prefs.allowInboundDismissTemplates}
          onChange={(v) =>
            updatePrefs({ ...prefs, allowInboundDismissTemplates: v })
          }
        />
      </div>

      <div className={styles.section}>
        <div className={styles.kpiRow}>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Usage</div>
            <div className={styles.kpiValue}>
              {usage ? `${usage.usedThisMonth}/${usage.limitThisMonth}` : "—"}
            </div>
          </div>
          <button
            className={styles.link}
            type="button"
            onClick={() => chrome.runtime.openOptionsPage()}>
            Settings →
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerNote}>
          Nothing is auto-sent. You approve every message.
        </div>
      </div>
    </div>
  )
}
