import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supportingDocumentService } from "../../documents";
import { SupportingDocuments } from "../SupportingDocuments";

vi.mock("../../documents", async () => {
  const actual =
    await vi.importActual<typeof import("../../documents")>("../../documents");
  return {
    ...actual,
    supportingDocumentService: {
      ...actual.supportingDocumentService,
      list: vi.fn(),
      upload: vi.fn(),
    },
  };
});

describe("SupportingDocuments", () => {
  beforeEach(() => vi.mocked(supportingDocumentService.list).mockReset());

  it("announces loading and exposes keyboard and screen-reader controls", () => {
    vi.mocked(supportingDocumentService.list).mockReturnValue(
      new Promise(() => undefined),
    );
    render(<SupportingDocuments />);

    expect(
      screen.getByRole("status", { name: /loading uploaded documents/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /choose a file/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("group", { name: /supporting document type/i }),
    ).toBeInTheDocument();
  });

  it("announces an empty document state", async () => {
    vi.mocked(supportingDocumentService.list).mockResolvedValue([]);
    render(<SupportingDocuments />);

    expect(
      await screen.findByText(/no supporting documents have been uploaded/i),
    ).toBeInTheDocument();
  });

  it("announces load failures without exposing document details", async () => {
    vi.mocked(supportingDocumentService.list).mockRejectedValue(
      new Error("network failure"),
    );
    render(<SupportingDocuments />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be loaded/i,
    );
    expect(screen.queryByText(/network failure/i)).not.toBeInTheDocument();
  });

  it("renders a successful private document response", async () => {
    vi.mocked(supportingDocumentService.list).mockResolvedValue([
      {
        id: "document-1",
        applicationId: "demo-application",
        kind: "transcript",
        fileName: "transcript.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
        status: "available",
        scanStatus: "clean",
        uploadedAt: "2026-09-25T12:00:00.000Z",
        accessLogged: true,
      },
    ]);
    render(<SupportingDocuments />);

    await waitFor(() =>
      expect(
        screen.getByRole("list", { name: /uploaded supporting documents/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("transcript.pdf")).toBeInTheDocument();
    expect(screen.getByText(/security scan: clean/i)).toBeInTheDocument();
  });
});
