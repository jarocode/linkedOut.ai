import React from "react"

import styles from "~styles/inboxBar.module.css"

/**
 * Inbox-level summary.
 * In V1 counts are basic; in later versions you can compute these from cached classifications/suggestions.
 */
export default function InboxSummaryBar({
  counts,
  onReviewInterested,
  onReviewAll
}: {
  counts: {
    interested: number
    maybe: number
    objection: number
    ghosted: number
    ignored: number
  }
  onReviewInterested: () => void
  onReviewAll: () => void
}) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.kpis}>
          <span className={styles.kpi}>
            <strong>Interested</strong> {counts.interested}
          </span>
          <span className={styles.kpi}>
            <strong>Maybe</strong> {counts.maybe}
          </span>
          <span className={styles.kpi}>
            <strong>Objections</strong> {counts.objection}
          </span>
          <span className={styles.kpi}>
            <strong>Ghosted</strong> {counts.ghosted}
          </span>
          <span className={styles.kpiMuted}>
            <strong>Ignored</strong> {counts.ignored}
          </span>
        </div>
      </div>
      <div className={styles.right}>
        <button
          className={styles.primary}
          type="button"
          onClick={onReviewInterested}>
          Review Interested First
        </button>
        <button
          className={styles.secondary}
          type="button"
          onClick={onReviewAll}>
          Batch Review (Visible)
        </button>
      </div>
    </div>
  )
}
