import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      // 56px, 18px text and a 1.5px --input border for older readers; admin screens pass a smaller size.
      className={cn(
        "field-focus h-14 w-full min-w-0 rounded-md border-[1.5px] border-input bg-card px-4 text-md text-foreground transition-[border-color,box-shadow] placeholder:text-[#5d6f66] disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-80 read-only:bg-muted",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
