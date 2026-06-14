import { useEffect, useState } from "react"

/** Current UNIX time in seconds, re-rendering on an interval. Keeps Date.now()
 *  out of render bodies (React purity rule) while time-based UI still updates. */
export function useNowSeconds(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
