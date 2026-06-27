import * as React from "react"
import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/* cult-ui ColorPicker (cult-ui.com/docs/components/color-picker), vendored.
 * Modified for VeilFlow's hex contract: emits hex (not hsl) so readableInk()
 * and the --primary token keep working; external `color` syncs without
 * re-emitting (avoids a controlled-value feedback loop). */

const hslToHex = (h: number, s: number, l: number) => {
  l /= 100
  const a = (s * Math.min(l, 1 - l)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase()
}

const hexToHsl = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]

  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/** Parse any accepted color (hex or hsl(...)) into [h, s, l]. */
const toHsl = (color: string): [number, number, number] => {
  if (color.startsWith("#")) return hexToHsl(color)
  const [h, s, l] = color.match(/\d+(\.\d+)?/g)?.map(Number) || [0, 0, 0]
  return [h, s, l]
}

const trimColorString = (color: string, maxLength = 20): string =>
  color.length <= maxLength ? color : `${color.slice(0, maxLength - 3)}...`

const colorPresets = [
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#4CD964",
  "#5AC8FA",
  "#007AFF",
  "#5856D6",
  "#FF2D55",
  "#8E8E93",
  "#EFEFF4",
  "#E5E5EA",
  "#D1D1D6",
]

export function ColorPicker({
  color,
  onChange,
}: {
  color: string
  onChange: (color: string) => void
}) {
  const [hsl, setHsl] = useState<[number, number, number]>(() => toHsl(color))
  const [colorInput, setColorInput] = useState(color)
  const [isOpen, setIsOpen] = useState(false)
  const [prevColor, setPrevColor] = useState(color)

  // Adjust internal state when the controlled value changes externally — React's
  // recommended alternative to a sync effect, and it never re-emits onChange.
  if (color !== prevColor) {
    setPrevColor(color)
    setHsl(toHsl(color))
    setColorInput(color)
  }

  // Exact hex preserved (presets, typed hex).
  const setFromHex = (hex: string) => {
    const up = hex.toUpperCase()
    setHsl(hexToHsl(up))
    setColorInput(up)
    onChange(up)
  }

  // hsl-origin (saturation/lightness pad, hue slider) — hex is derived.
  const setFromHsl = (h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l)
    setHsl([h, s, l])
    setColorInput(hex)
    onChange(hex)
  }

  const handleSaturationLightnessChange = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const s = Math.round((x / rect.width) * 100)
    const l = Math.round(100 - (y / rect.height) * 100)
    setFromHsl(hsl[0], s, l)
  }

  const handleColorInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value
    setColorInput(newColor)
    if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      setFromHex(newColor)
    } else if (/^hsl\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?%\s*,\s*\d+(\.\d+)?%\s*\)$/.test(newColor)) {
      const [h, s, l] = toHsl(newColor)
      setFromHsl(h, s, l)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-8 w-full justify-start px-2.5 text-left font-normal">
          <div className="mr-2 h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: colorInput }} />
          <span className="grow font-mono">{trimColorString(colorInput)}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          <motion.div
            className="relative h-40 w-full cursor-crosshair overflow-hidden rounded-lg"
            style={{
              background: `
                linear-gradient(to top, rgba(0, 0, 0, 1), transparent),
                linear-gradient(to right, rgba(255, 255, 255, 1), rgba(255, 0, 0, 0)),
                hsl(${hsl[0]}, 100%, 50%)
              `,
            }}
            onClick={handleSaturationLightnessChange}
          >
            <motion.div
              className="absolute h-4 w-4 rounded-full border-2 border-white shadow-md"
              style={{
                left: `${hsl[1]}%`,
                top: `${100 - hsl[2]}%`,
                backgroundColor: `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`,
              }}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            />
          </motion.div>
          <motion.input
            type="range"
            min="0"
            max="360"
            value={hsl[0]}
            onChange={(e) => setFromHsl(Number(e.target.value), hsl[1], hsl[2])}
            className="h-3 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right,
                hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%),
                hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%)
              )`,
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          />
          <div className="flex items-center space-x-2">
            <Label htmlFor="color-input" className="sr-only">
              Color
            </Label>
            <Input
              id="color-input"
              type="text"
              value={colorInput}
              onChange={handleColorInputChange}
              className="h-8 grow font-mono text-sm"
              placeholder="#RRGGBB or hsl(h, s%, l%)"
            />
            <motion.div
              className="h-8 w-8 rounded-md shadow-sm"
              style={{ backgroundColor: colorInput }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            />
          </div>
          <div className="grid grid-cols-6 gap-2">
            <AnimatePresence>
              {colorPresets.map((preset) => (
                <motion.button
                  key={preset}
                  type="button"
                  className="relative h-8 w-8 rounded-full"
                  style={{ backgroundColor: preset }}
                  onClick={() => setFromHex(preset)}
                  whileHover={{ scale: 1.2, zIndex: 1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {colorInput === preset && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.2 }}>
                      <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  )
}
