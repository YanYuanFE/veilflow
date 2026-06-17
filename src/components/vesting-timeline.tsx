import { useState } from "react"
import { Area, AreaChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Kicker } from "@/components/editorial"

const fmtMonth = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
const fmtFullDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const chartConfig = { pct: { label: "Unlocked", color: "var(--seal)" } } satisfies ChartConfig

/** Public unlock-shape chart for a vesting schedule, built on Recharts (shadcn chart).
 *  The schedule — start, cliff, end, initial unlock, cliff jump — is plaintext on-chain,
 *  so the curve is safe to draw; the amount stays confidential, so the y-axis is % of the
 *  recipient's allocation, never an absolute figure. Accent uses --seal (brandable). */
export function VestingTimeline({
  start,
  end,
  cliffSeconds,
  initialUnlockBps,
  cliffAmountBps,
}: {
  start: number
  end: number
  cliffSeconds: number
  initialUnlockBps: number
  cliffAmountBps: number
}) {
  // Computed once on mount (lint-safe); a vesting span is months, so it needn't tick.
  const [now] = useState(() => Math.floor(Date.now() / 1000))
  if (!(end > start)) return null

  const span = end - start
  const cliffTs = start + Math.min(Math.max(cliffSeconds, 0), span)
  const hasCliff = cliffSeconds > 0 && cliffTs < end
  const initialPct = Math.max(0, Math.min(100, initialUnlockBps / 100))
  const cliffPct = Math.max(0, Math.min(100 - initialPct, cliffAmountBps / 100))
  const afterCliffPct = initialPct + cliffPct

  // Cumulative unlock %: flat at initial through the cliff, a jump at the cliff, then a
  // straight stream to 100% at the end.
  const pctAt = (t: number) => {
    if (t < cliffTs) return initialPct
    if (t >= end) return 100
    return afterCliffPct + (100 - afterCliffPct) * ((t - cliffTs) / (end - cliffTs))
  }
  const N = 48
  const data = Array.from({ length: N + 1 }, (_, i) => {
    const t = Math.round(start + (span * i) / N)
    return { t, pct: Number(pctAt(t).toFixed(2)) }
  })
  const showNow = now >= start && now <= end

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Kicker className="tracking-[0.12em]">Vesting timeline</Kicker>
        <span className="font-mono text-[0.625rem] tracking-wide text-muted-foreground">% of your allocation</span>
      </div>
      <ChartContainer config={chartConfig} className="mt-3 w-full" style={{ height: 232 }}>
        <AreaChart data={data} margin={{ top: 18, right: 14, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id="vt-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--seal)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--seal)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <YAxis
            domain={[0, 100]}
            ticks={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
            width={36}
            tick={{ fontSize: 11 }}
          />
          <XAxis
            dataKey="t"
            type="number"
            scale="linear"
            domain={[start, end]}
            ticks={[start, end]}
            tickFormatter={(t) => fmtMonth(Number(t))}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const t = payload?.[0]?.payload?.t
                  return typeof t === "number" ? fmtFullDate(t) : ""
                }}
                formatter={(value) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">Unlocked</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">{value}%</span>
                  </div>
                )}
              />
            }
          />
          {hasCliff && <ReferenceLine x={cliffTs} stroke="var(--border)" strokeDasharray="3 5" />}
          {showNow && (
            <ReferenceLine
              x={now}
              stroke="var(--seal)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
              label={{ value: "now", position: "top", fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
            />
          )}
          <Area
            name="Unlocked"
            dataKey="pct"
            type="linear"
            stroke="var(--muted-foreground)"
            strokeWidth={1.75}
            fill="url(#vt-fill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, fill: "var(--seal)", stroke: "var(--background)", strokeWidth: 1 }}
          />
        </AreaChart>
      </ChartContainer>
      <p className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
        The unlock shape is public; your allocation amount stays sealed until you decrypt it.
      </p>
    </div>
  )
}
