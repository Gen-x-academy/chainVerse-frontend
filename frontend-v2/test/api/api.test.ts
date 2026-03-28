import { fetchData } from "@/services/api";

global.fetch = jest.fn();

describe("API Integration Tests", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it("should fetch data successfully", async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({ data: [1, 2, 3] }),
    });

    const result = await fetchData("/test");

    expect(fetch).toHaveBeenCalledWith("/test");
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it("should handle API failure", async () => {
    fetch.mockRejectedValueOnce(new Error("API error"));

    await expect(fetchData("/test")).rejects.toThrow("API error");
  });
});