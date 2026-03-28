import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { Button } from "../button"

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument()
  })

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Submit</Button>)
    await user.click(screen.getByRole("button"))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("applies variant class", () => {
    render(<Button variant="destructive">Delete</Button>)
    const btn = screen.getByRole("button")
    expect(btn).toHaveAttribute("data-variant", "destructive")
  })

  it("applies size class", () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole("button")
    expect(btn).toHaveAttribute("data-size", "lg")
  })

  it("renders as child element with asChild", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    expect(screen.getByRole("link", { name: "Link Button" })).toBeInTheDocument()
  })

  it("has visible focus ring classes", () => {
    render(<Button>Focus</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("focus-visible")
  })
})
