import { ReactNode } from "react"

export interface FilterContainerProps {
  children: ReactNode
  className?: string
}

export const FilterContainer = ({ children, className }: FilterContainerProps) => {
  return <div className={`flex flex-wrap items-center gap-4 mx-0 ${className}`}>{children}</div>
}
