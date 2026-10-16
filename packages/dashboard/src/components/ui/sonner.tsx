import { Toaster as Sonner, type ToasterProps } from "sonner"

// Sonner's own theme and colors. The app is always dark, so pin the theme rather than following
// the OS setting; richColors gives success/error toasts their green/red styling.
function Toaster(props: ToasterProps) {
  return <Sonner theme="dark" richColors {...props} />
}

export { Toaster }
