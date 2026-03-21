import { describe, it, expect, vi, beforeEach } from "vitest";
import { autocomplete, suggest, getPlace } from "./api";
import { GeoPlacesClient } from "@chaosity/location-client";

vi.mock("@chaosity/location-client", () => {
  return {
    AutocompleteCommand: class {
      constructor(public input: unknown) {}
    },
    SuggestCommand: class {
      constructor(public input: unknown) {}
    },
    GetPlaceCommand: class {
      constructor(public input: unknown) {}
    },
    GeoPlacesClient: vi.fn(function (this: { send: ReturnType<typeof vi.fn> }) {
      this.send = vi.fn();
    }),
  };
});

describe("API", () => {
  let client: GeoPlacesClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GeoPlacesClient({ apiUrl: "https://test-api.chaosity.cloud", token: "test-token" });
  });

  describe("autocomplete", () => {
    const mockInput = { QueryText: "test query" };
    const mockResponse = { ResultItems: [] };

    it("should make an Autocomplete request and return the response", async () => {
      vi.mocked(client.send).mockResolvedValueOnce(mockResponse as unknown as void);
      const result = await autocomplete(client, mockInput);
      expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ input: mockInput }));
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors from the Autocomplete request", async () => {
      const mockError = new Error("API error");
      vi.mocked(client.send).mockRejectedValueOnce(mockError);
      await expect(autocomplete(client, mockInput)).rejects.toThrow("API error");
    });
  });

  describe("suggest", () => {
    const mockInput = { QueryText: "test query" };
    const mockResponse = { ResultItems: [] };

    it("should make a Suggest request and return the response", async () => {
      vi.mocked(client.send).mockResolvedValueOnce(mockResponse as unknown as void);
      const result = await suggest(client, mockInput);
      expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ input: mockInput }));
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors from the Suggest request", async () => {
      const mockError = new Error("API error");
      vi.mocked(client.send).mockRejectedValueOnce(mockError);
      await expect(suggest(client, mockInput)).rejects.toThrow("API error");
    });
  });

  describe("getPlace", () => {
    const mockInput = { PlaceId: "test-place-id" };
    const mockResponse = { Place: { Label: "Test Place" } };

    it("should make a GetPlace request and return the response", async () => {
      vi.mocked(client.send).mockResolvedValueOnce(mockResponse as unknown as void);
      const result = await getPlace(client, mockInput);
      expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ input: mockInput }));
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors from the GetPlace request", async () => {
      const mockError = new Error("API error");
      vi.mocked(client.send).mockRejectedValueOnce(mockError);
      await expect(getPlace(client, mockInput)).rejects.toThrow("API error");
    });
  });
});
