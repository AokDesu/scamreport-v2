import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

// Restyled for the approved theme: heading font 600, 48px minimum, 56px citizen primary (size lg),
// amber focus ring from the base layer, and a `signal` variant used only for "Call next".
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-heading font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_2px_6px_-2px_rgb(15_31_29/0.35)] hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-danger-soft-foreground",
        "destructive-outline": "bg-card text-destructive shadow-[inset_0_0_0_1.5px_currentColor] hover:bg-danger-soft",
        outline: "bg-card text-foreground shadow-[inset_0_0_0_1.5px_var(--input)] hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "bg-transparent text-primary hover:bg-accent",
        link: "min-h-0 px-0 text-primary underline underline-offset-4 decoration-[1.5px]",
        signal: "bg-signal text-sidebar-primary-foreground shadow-md hover:bg-[#eaa928]",
      },
      size: {
        default: "min-h-12 rounded-md px-4.5 text-base",
        sm: "min-h-10 rounded-sm px-3.5 text-sm",
        lg: "min-h-14 rounded-lg px-6 text-md",
        icon: "size-12 rounded-md",
        "icon-sm": "size-10 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
