import { spawn } from "node:child_process"

/** Seam the tests replace. */
export const browser = {
  open(url: string): void {
    const [command, args]: [string, string[]] =
      process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", "", url]]
          : ["xdg-open", [url]]
    const child = spawn(command, args, { detached: true, stdio: "ignore" })
    child.once("error", () => console.error(`Could not open a browser. Open ${url} yourself.`))
    child.unref()
  },
}
