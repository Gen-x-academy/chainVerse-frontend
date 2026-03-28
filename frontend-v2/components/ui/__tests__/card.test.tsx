import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "../card"

describe("Card", () => {
  it("renders card with content", () => {
    render(<Card>Card body</Card>)
    expect(screen.getByText("Card body")).toBeInTheDocument()
  })

  it("renders all subcomponents", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
          <CardAction>Action</CardAction>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    expect(screen.getByText("Title")).toBeInTheDocument()
    expect(screen.getByText("Description")).toBeInTheDocument()
    expect(screen.getByText("Action")).toBeInTheDocument()
    expect(screen.getByText("Content")).toBeInTheDocument()
    expect(screen.getByText("Footer")).toBeInTheDocument()
  })

  it("applies data-slot attributes correctly", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>T</CardTitle>
        </CardHeader>
        <CardContent>C</CardContent>
      </Card>
    )
    expect(container.querySelector("[data-slot='card']")).toBeInTheDocument()
    expect(container.querySelector("[data-slot='card-header']")).toBeInTheDocument()
    expect(container.querySelector("[data-slot='card-title']")).toBeInTheDocument()
    expect(container.querySelector("[data-slot='card-content']")).toBeInTheDocument()
  })

  it("forwards custom className", () => {
    render(<Card className="custom-class">content</Card>)
    expect(
      document.querySelector("[data-slot='card']")
    ).toHaveClass("custom-class")
  })
})
