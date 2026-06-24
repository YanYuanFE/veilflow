import { type Address, type Hex } from "viem"
import { useAllRecipients, useRecipientVestings, useVestingInfo } from "@tokenops/sdk/fhe-vesting/react"
import { type VestingInfo } from "@tokenops/sdk/fhe-vesting"
import { type Distribution } from "@/lib/api"
import { numberConfig } from "@/routes/distribution/shared"

// The plaintext schedule fields our UI draws — shared by the timeline chart and the
// one-line description. Amounts stay encrypted and are never part of this.
export type VestingSchedule = {
  start: number
  end: number
  cliffSeconds: number
  releaseIntervalSecs: number
  initialUnlockBps: number
  cliffAmountBps: number
  timelockSeconds: number
  isRevocable: boolean
}

// On-chain snapshot → schedule. The cliff is stored on-chain as an absolute timestamp; the
// timeline wants seconds-from-start.
export function scheduleFromInfo(info: VestingInfo): VestingSchedule {
  return {
    start: info.startTimestamp,
    end: info.endTimestamp,
    cliffSeconds: info.cliffReleaseTimestamp > info.startTimestamp ? info.cliffReleaseTimestamp - info.startTimestamp : 0,
    releaseIntervalSecs: info.releaseIntervalSecs,
    initialUnlockBps: info.initialUnlockBps,
    cliffAmountBps: info.cliffAmountBps,
    timelockSeconds: info.timelock,
    isRevocable: info.isRevocable,
  }
}

// DB fallback — the schedule captured at create time (before deploy, or while the chain read loads).
export function scheduleFromConfig(d: Distribution): VestingSchedule {
  return {
    start: numberConfig(d, "startTimestamp", 0),
    end: numberConfig(d, "endTimestamp", 0),
    cliffSeconds: numberConfig(d, "cliffSeconds", 0),
    releaseIntervalSecs: numberConfig(d, "releaseIntervalSecs", 0),
    initialUnlockBps: numberConfig(d, "initialUnlockBps", 0),
    cliffAmountBps: numberConfig(d, "cliffAmountBps", 0),
    timelockSeconds: numberConfig(d, "timelockSeconds", 0),
    isRevocable: d.config.isRevocable === true,
  }
}

const fmtDay = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export function fmtDuration(secs: number): string {
  if (secs <= 0) return "—"
  const day = Math.floor(secs / 86_400)
  const hr = Math.floor((secs % 86_400) / 3600)
  const min = Math.floor((secs % 3600) / 60)
  if (day) return `${day} day${day === 1 ? "" : "s"}${hr ? ` ${hr}h` : ""}`
  if (hr) return `${hr}h${min ? ` ${min}m` : ""}`
  return `${min}m`
}

// One-line plain-English summary of the unlock rules — start/cliff/cadence woven into a sentence.
export function describeSchedule(s: VestingSchedule): string {
  const initialPct = s.initialUnlockBps / 100
  const cliffPct = s.cliffAmountBps / 100
  const remainder = Math.max(0, 100 - initialPct - cliffPct)
  const cadence = s.releaseIntervalSecs > 0 ? `every ${fmtDuration(s.releaseIntervalSecs)}` : "continuously"

  const steps: string[] = []
  if (initialPct > 0) steps.push(`${initialPct}% at start`)
  if (s.cliffSeconds > 0)
    steps.push(cliffPct > 0 ? `${cliffPct}% after a ${fmtDuration(s.cliffSeconds)} cliff` : `a ${fmtDuration(s.cliffSeconds)} cliff`)
  if (remainder > 0) steps.push(steps.length ? `then the remaining ${remainder}% ${cadence}` : `releases ${cadence}`)

  const window = s.end > s.start ? `Vests ${fmtDay(s.start)} → ${fmtDay(s.end)}` : "Vesting schedule"
  const timelock = s.timelockSeconds > 0 ? ` Claims are timelocked ${fmtDuration(s.timelockSeconds)}.` : ""
  return `${window}${steps.length ? `: ${steps.join(", ")}` : ""}.${timelock}`
}

// The distribution's schedule read on-chain. A manager stores one schedule per vesting but the
// whole distribution shares one set of terms, so we read the first recipient's first vesting as
// the representative and fall back to the DB snapshot until it loads.
export function useRepresentativeSchedule(
  manager: Address,
  d: Distribution,
): { schedule: VestingSchedule; onchain: boolean } {
  const recipientsQ = useAllRecipients({ address: manager })
  const firstRecipient = recipientsQ.data?.[0]
  const vestingsQ = useRecipientVestings({ address: manager, recipient: firstRecipient })
  const firstVesting = vestingsQ.data?.[0] as Hex | undefined
  const infoQ = useVestingInfo({ address: manager, vestingId: firstVesting })
  return infoQ.data ? { schedule: scheduleFromInfo(infoQ.data), onchain: true } : { schedule: scheduleFromConfig(d), onchain: false }
}
