import { WorkEvent } from "@/types"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditResourceSheet } from "./edit-resource-sheet"

const mockEvent: WorkEvent = {
  id: "1",
  project: "Project A",
  timeframe: "60m",
  minutes: 60,
  description: "Work on feature X",
  timestamp: new Date().toISOString(),
  created: "2026-01-01T00:00:00.000Z",
  updated: "2026-01-01T00:00:00.000Z",
}

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url === "/api/projects") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(["Project A", "Project B"]),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
  }) as unknown as typeof fetch
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("EditResourceSheet", () => {
  it("should submit the form with updated data", async () => {
    const user = userEvent.setup()
    const onDataChange = vi.fn()
    const onClose = vi.fn()
    render(
      <EditResourceSheet
        isOpen={true}
        onClose={onClose}
        event={mockEvent}
        onDataChange={onDataChange}
      />,
    )

    const descriptionInput = screen.getByPlaceholderText("Enter a description")
    await user.clear(descriptionInput)
    await user.type(descriptionInput, "Updated description")

    const submitButton = screen.getByRole("button", { name: "Submit" })
    await user.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenLastCalledWith(
        "/api/events/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            timestamp: new Date(mockEvent.timestamp || ""),
            project: "Project A",
            description: "Updated description",
            timeframe: "60m",
          }),
        }),
      )
    })

    await waitFor(() => {
      expect(onDataChange).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
