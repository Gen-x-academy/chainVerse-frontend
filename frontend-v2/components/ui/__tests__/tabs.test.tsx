"use client"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect } from "vitest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs"

describe("Tabs", () => {
  function TabsFixture() {
    return (
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
  }

  it("renders tabs and shows default tab content", () => {
    render(<TabsFixture />)
    expect(screen.getByText("Tab 1")).toBeInTheDocument()
    expect(screen.getByText("Tab 2")).toBeInTheDocument()
    expect(screen.getByText("Content 1")).toBeVisible()
  })

  it("switches content on tab click", async () => {
    const user = userEvent.setup()
    render(<TabsFixture />)
    await user.click(screen.getByRole("tab", { name: "Tab 2" }))
    expect(screen.getByText("Content 2")).toBeVisible()
  })

  it("marks active tab with aria-selected", async () => {
    const user = userEvent.setup()
    render(<TabsFixture />)
    const tab1 = screen.getByRole("tab", { name: "Tab 1" })
    const tab2 = screen.getByRole("tab", { name: "Tab 2" })
    expect(tab1).toHaveAttribute("aria-selected", "true")
    await user.click(tab2)
    expect(tab2).toHaveAttribute("aria-selected", "true")
    expect(tab1).toHaveAttribute("aria-selected", "false")
  })

  it("tab triggers have focus-visible styles", () => {
    render(<TabsFixture />)
    const trigger = screen.getByRole("tab", { name: "Tab 1" })
    expect(trigger.className).toContain("focus-visible")
  })

  it("disabled tab is not clickable", async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    await user.click(screen.getByRole("tab", { name: "Tab 2" }))
    expect(screen.getByRole("tab", { name: "Tab 1" })).toHaveAttribute("aria-selected", "true")
  })
})
