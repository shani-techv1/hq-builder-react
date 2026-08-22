import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The project's own `bg-*` patterns, declared as what they are.
 *
 * tailwind-merge resolves conflicts by class *name*, so an unregistered
 * `bg-checkerboard` is taken for a background-colour utility and silently
 * dropped the moment it meets a real one — `cn("bg-checkerboard bg-card")`
 * emitted `bg-card` alone, which is why the transparent sheet rendered as a
 * plain white board. Registered under `bg-image` they layer over a colour the
 * way they are written to, and still displace a gradient, which they should.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "bg-image": ["bg-checkerboard", "bg-dot-texture", "bg-grid-lines"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
