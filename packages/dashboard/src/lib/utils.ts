import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sleep = async (intervalMs: number): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, intervalMs)
  })
}

export const toRomanNumeral = (val: string | null | undefined): string => {
  if (!val) {
    return ""
  }

  const data: Record<string, string> = {
    "1": "I",
    "2": "II",
    "3": "III",
    "4": "IV",
    "5": "V",
  }
  return data[val] || val
}

export const boolYesNo = (
  val: boolean | null | undefined | number | string,
  defaultValue = "-",
) => {
  if (val === undefined || val === null) {
    return defaultValue
  }
  if (val === "true" || val === 1) {
    return "Yes"
  }
  if (val === "false" || val === 0) {
    return "No"
  }
  return val ? "Yes" : "No"
}

export function formatDate(val: string | undefined) {
  if (!val) return ""

  const date = new Date(val)
  if (!date) return ""

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return "-"
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

const splitNameFirst = (name: string) => {
  if (!name || typeof name !== "string") return ""
  return name.split(" ")[0]
}

const splitNameLast = (name: string) => {
  if (!name || typeof name !== "string") return ""

  const components = name.split(" ")
  if (components && components.length > 1) {
    components.shift() // remove first element
    return components.join(" ") // return the rest
  }

  return ""
}

export const stringAvatar = (name: string) => {
  const first = splitNameFirst(name)
  const last = splitNameLast(name)
  if (first && last) {
    return `${first ? first[0]?.toUpperCase() : ""}${last ? last[0]?.toUpperCase() : ""}`
  }
  return name?.slice(0, 2)?.toUpperCase()
}

export const formatUrl = (val: string | null | undefined, withParams = false): string => {
  if (!val) {
    return "#"
  }
  try {
    const inputUrl = val.startsWith("https://") ? val : `https://${val}`

    const url = new URL(inputUrl)
    url.protocol = "https"
    if (withParams) {
      const params = url.searchParams
      params.append("utm_source", "recruitreach.com")
      url.search = params.toString()
    }

    return url.toString()
  } catch {
    console.error("failed to convert to url", val)
  }
  return ""
}
