import { memo, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Kicker } from "@/components/editorial"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")
// Build a local "YYYY-MM-DDTHH:mm" string (datetime-local format) from a Date + "HH:mm".
const toLocalInput = (d: Date, time: string) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time || "00:00"}`

/**
 * Date + time picker over a `datetime-local`-shaped string (`YYYY-MM-DDTHH:mm`).
 * Date via shadcn Calendar in a Popover; time via shadcn Input[type=time].
 *
 * Memoized: an unrelated parent re-render (e.g. the create page's per-second
 * `now` tick) would otherwise re-render the open calendar and remount the native
 * month/year `<select>`, stealing focus and closing it before you can pick.
 */
function DateTimePickerImpl({
  value,
  onChange,
  id,
  placeholder = "Pick a date & time",
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value) : undefined
  const time = value ? value.slice(11, 16) : "12:00"

  const onPickDate = (d?: Date) => {
    if (d) onChange(toLocalInput(d, time))
  }
  const onPickTime = (t: string) => {
    onChange(toLocalInput(date ?? new Date(), t))
  }

  const thisYear = new Date().getFullYear()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          // Match the Input field height/shape (h-8) so it lines up with the
          // sibling inputs and action buttons in forms (default Button is h-10).
          className={cn("h-8 w-full justify-between rounded-[4px] px-2.5 font-normal", !date && "text-muted-foreground")}
        >
          {date ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : placeholder}
          <CalendarIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onPickDate}
          defaultMonth={date}
          captionLayout="dropdown"
          startMonth={new Date(thisYear - 1, 0)}
          endMonth={new Date(thisYear + 6, 11)}
          autoFocus
        />
        <div className="flex items-center justify-between gap-3 border-t border-border p-3">
          <div className="flex items-center gap-2.5">
            <Kicker>Time</Kicker>
            <Input
              type="time"
              value={time}
              onChange={(e) => onPickTime(e.target.value)}
              className="h-8 w-fit"
              aria-label="Time"
            />
          </div>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const DateTimePicker = memo(DateTimePickerImpl)
