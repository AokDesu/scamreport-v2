import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Light mode only (approved scope): an ink toast with the amber "now" icon, labelled in the UI language.
function Toaster({ ...props }: ToasterProps) {
  const { t } = useTranslation()
  return <Sonner
    theme="light"
    containerAriaLabel={t("app.notifications")}
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-5 text-signal" />,
      info: <InfoIcon className="size-5 text-signal" />,
      warning: <TriangleAlertIcon className="size-5 text-signal" />,
      error: <OctagonXIcon className="size-5 text-signal" />,
      loading: <Loader2Icon className="size-5 animate-spin text-signal" />,
    }}
    style={
      {
        "--normal-bg": "var(--foreground)",
        "--normal-text": "var(--card)",
        "--normal-border": "var(--foreground)",
        "--border-radius": "var(--radius)",
      } as React.CSSProperties
    }
    toastOptions={{ classNames: { toast: "font-heading text-base shadow-lg" } }}
    {...props}
  />
}

export { Toaster }
