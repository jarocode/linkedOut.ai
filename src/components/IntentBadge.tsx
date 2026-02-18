import React from "react"

import type { IntentLabel } from "~lib/types"
import styles from "~styles/badge.module.css"

const LABELS: Record<IntentLabel, string> = {
  interested: "Interested",
  maybe: "Maybe",
  objection: "Objection",
  not_interested: "Not interested",
  ghosted: "Ghosted",
  unknown: "Unknown"
}

export default function IntentBadge({ intent }: { intent: IntentLabel }) {
  return (
    <span className={`${styles.badge} ${styles[intent]}`}>
      {LABELS[intent] ?? "Unknown"}
    </span>
  )
}
