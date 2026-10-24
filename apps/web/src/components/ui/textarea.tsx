import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-focus flex min-h-30 w-full resize-y rounded-md border-[1.5px] border-input bg-card px-4 py-3 text-md leading-[1.65] text-foreground transition-[border-color,box-shadow] placeholder:text-[#5d6f66] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
