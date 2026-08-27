import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BarcodeScanInput } from "../BarcodeScanInput";

describe("BarcodeScanInput", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading state", () => {
    render(<BarcodeScanInput isLoading />);
    expect(screen.getByLabelText("Loading scanner")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<BarcodeScanInput error="Scanner unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Scanner unavailable");
  });

  it("does not submit partial barcode values on Enter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onScan = vi.fn();

    render(<BarcodeScanInput onScan={onScan} />);
    const input = screen.getByLabelText("Scan barcode");
    await user.type(input, "123");
    await user.keyboard("{Enter}");

    expect(onScan).not.toHaveBeenCalled();
  });

  it("submits complete barcode on Enter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onScan = vi.fn().mockResolvedValue({ success: true });

    render(<BarcodeScanInput onScan={onScan} />);
    const input = screen.getByLabelText("Scan barcode");
    await user.type(input, "9780000000001");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith("9780000000001", "checkout");
    });
  });

  it("debounces duplicate scans", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onScan = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, duplicate: true });

    render(<BarcodeScanInput onScan={onScan} />);
    const input = screen.getByLabelText("Scan barcode");

    await user.type(input, "9780000000001");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onScan).toHaveBeenCalledTimes(1));

    await user.type(input, "9780000000001");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText(/Duplicate scan/i)).toBeInTheDocument();
    });
  });

  it("shows manual fallback when camera is denied", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("denied")),
      },
      configurable: true,
    });

    render(<BarcodeScanInput onManualLookup={vi.fn()} />);
    await user.click(screen.getByText("Use camera scanner"));

    expect(screen.getByText(/Camera access denied/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Manual barcode or ISBN lookup")).toBeInTheDocument();
  });
});
