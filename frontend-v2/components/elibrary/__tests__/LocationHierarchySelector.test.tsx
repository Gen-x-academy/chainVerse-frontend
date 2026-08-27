import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LocationHierarchySelector } from "../LocationHierarchySelector";
import type { LocationNode, LocationSelection } from "@/src/features/library/types/library.types";

const mockNodes: LocationNode[] = [
  {
    id: "b1",
    label: "Main",
    level: "branch",
    active: true,
    children: [
      {
        id: "r1",
        label: "Room 1",
        level: "room",
        active: true,
        children: [
          {
            id: "s1",
            label: "Shelf 1",
            level: "shelf",
            active: true,
            children: [
              { id: "bin1", label: "Bin A", level: "bin", active: true },
              { id: "bin2", label: "Bin B", level: "bin", active: false },
            ],
          },
        ],
      },
    ],
  },
];

function ControlledSelector({
  initial = {},
}: {
  initial?: LocationSelection;
}) {
  const [selection, setSelection] = useState<LocationSelection>(initial);
  return (
    <LocationHierarchySelector nodes={mockNodes} selection={selection} onChange={setSelection} />
  );
}

describe("LocationHierarchySelector", () => {
  it("renders loading state", () => {
    render(<LocationHierarchySelector nodes={[]} selection={{}} onChange={vi.fn()} isLoading />);
    expect(screen.getByLabelText("Loading locations")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(
      <LocationHierarchySelector nodes={[]} selection={{}} onChange={vi.fn()} error="Failed to load" />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");
  });

  it("renders empty state", () => {
    render(<LocationHierarchySelector nodes={[]} selection={{}} onChange={vi.fn()} />);
    expect(screen.getByText("No locations configured.")).toBeInTheDocument();
  });

  it("resets dependent choices when branch changes", async () => {
    const user = userEvent.setup();
    render(<ControlledSelector initial={{ branchId: "b1", roomId: "r1", shelfId: "s1", binId: "bin1" }} />);

    expect(screen.getByLabelText("Select room")).toHaveValue("r1");
    await user.selectOptions(screen.getByLabelText("Select branch"), "");
    expect(screen.getByLabelText("Select room")).toHaveValue("");
    expect(screen.getByLabelText("Select shelf")).toHaveValue("");
  });

  it("disables inactive locations in bin select", async () => {
    const user = userEvent.setup();
    render(<ControlledSelector initial={{ branchId: "b1", roomId: "r1", shelfId: "s1" }} />);

    const binSelect = screen.getByLabelText("Select bin");
    const inactiveOption = Array.from(binSelect.querySelectorAll("option")).find(
      (o) => o.textContent?.includes("Bin B")
    );
    expect(inactiveOption).toBeDisabled();
  });

  it("shows breadcrumb on small screens", () => {
    render(
      <LocationHierarchySelector
        nodes={mockNodes}
        selection={{ branchId: "b1", roomId: "r1" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Location breadcrumb")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Room 1")).toBeInTheDocument();
  });
});
