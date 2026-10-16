import { VariantProps } from "class-variance-authority"
import { useEffect, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"

const confirmThreshold = 1000 * 3 // 3 seconds

export const ConfirmButton = ({
  confirmChild,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  } & {
    confirmChild?: React.ReactNode
  }) => {
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (confirm) {
      setTimeout(() => {
        setConfirm(false)
      }, confirmThreshold)
    }
  }, [confirm])

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (confirm) {
      setConfirm(false)
      props?.onClick?.(e)
    } else {
      setConfirm(true)
    }
  }

  return (
    <Button {...props} onClick={handleClick} title={confirm ? "Click to confirm" : props.title}>
      {confirm ? (confirmChild ? confirmChild : "Click to confirm") : props.children}
    </Button>
  )
}
