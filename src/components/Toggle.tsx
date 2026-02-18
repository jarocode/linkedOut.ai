import React from "react"

import styles from "~styles/toggle.module.css"

export default function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={styles.row}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={`${styles.toggle} ${checked ? styles.on : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}>
        <span className={styles.knob} />
      </button>
    </label>
  )
}
