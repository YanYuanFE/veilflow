import type { Distribution } from "@/lib/api"

export type LifecycleStep = { key: string; label: string }

export type Lifecycle = {
  steps: LifecycleStep[]
  current: number // index of the active step; everything before it is done
  done: boolean // the active step is itself complete (terminal state)
  nextLabel: string | null // short "what to do next" hint for the dashboard
}

/** Derive where a distribution sits in its lifecycle, so the UI can show a
 *  stepper and let the issuer resume from the right place on re-entry. */
export function lifecycle(d: Distribution): Lifecycle {
  if (d.type === "disperse") {
    const steps = [
      { key: "configure", label: "Configure" },
      { key: "send", label: "Disperse" },
    ]
    const done = d.status === "completed"
    return { steps, current: 1, done, nextLabel: done ? null : "Send batch" }
  }

  const deployLabel = d.type === "airdrop" ? "Deploy & fund" : "Deploy manager"
  const steps = [
    { key: "configure", label: "Configure" },
    { key: "deploy", label: deployLabel },
    { key: "recipients", label: "Add recipients" },
    { key: "live", label: "Live" },
  ]
  // Address is written back only once the deploy tx confirms → drives resume.
  if (!d.contractAddress) return { steps, current: 1, done: false, nextLabel: deployLabel }
  if (d.status !== "live") return { steps, current: 2, done: false, nextLabel: "Add recipients · go live" }
  return { steps, current: 3, done: true, nextLabel: null }
}
