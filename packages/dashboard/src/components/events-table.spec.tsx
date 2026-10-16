import { WorkEvent } from "@/types"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EventsTable } from "./events-table"

const mockData: WorkEvent[] = [
  {
    id: "1",
    project: "Project A",
    timeframe: "60m",
    minutes: 60,
    description: "Work on feature X",
    timestamp: new Date().toISOString(),
    created: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-01T00:00:00.000Z",
  },
]

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

describe("EventsTable", () => {
  it("should open the edit sheet when the edit button is clicked", async () => {
    const user = userEvent.setup()
    render(<EventsTable data={mockData} isGrouped={false} />)

    const menuButton = screen.getByRole("button", { name: "Open menu" })
    await user.click(menuButton)

    const editButton = await screen.findByTestId("edit-menu-item")
    await user.click(editButton)

    const editSheet = await screen.findByRole("dialog")
    expect(editSheet).toBeInTheDocument()
  })

  it("should call onDataChange when an item is deleted", async () => {
    const user = userEvent.setup()
    const onDataChange = vi.fn()
    render(<EventsTable data={mockData} isGrouped={false} onDataChange={onDataChange} />)

    const menuButton = screen.getByRole("button", { name: "Open menu" })
    await user.click(menuButton)

    // The delete button is inside a dropdown menu.
    const deleteMenuItem = await screen.findByTestId("delete-menu-item")

    // First click to show confirm state
    await user.click(deleteMenuItem)

    // Wait for confirm state and click again to actually delete
    await waitFor(() => {
      expect(screen.getByText("Confirm")).toBeInTheDocument()
    })

    const confirmButton = screen.getByText("Confirm")
    await user.click(confirmButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/events/1", { method: "DELETE" })
    })

    await waitFor(() => {
      expect(onDataChange).toHaveBeenCalled()
    })
  })
})
