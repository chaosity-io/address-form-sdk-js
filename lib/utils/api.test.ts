import { describe, it, expect, vi, beforeEach } from "vitest";
import { autocomplete, suggest, getPlace } from "./api";
import { AutocompleteCommand, SuggestCommand, GetPlaceCommand } from "@chaosity/location-client";
import { GeoPlacesClient } from "@chaosity/location-client";

vi.mock("@chaosity/location-client", () => {
  return {
    AutocompleteCommand: vi.fn(),
    SuggestCommand: vi.fn(),
    GetPlaceCommand: vi.fn(),
    GeoPlacesClient: vi.fn(() => ({
      send: vi.fn(),
    })),
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
      const mockCommand = {};
      vi.mocked(AutocompleteCommand).mockReturnValueOnce(mockCommand as AutocompleteCommand);
      vi.mocked(client.send).mockResolvedValueOnce(mockResponse as unknown as void);
      const result = await autocomplete(client, mockInput);
      expect(AutocompleteCommand).toHaveBeenCalledWith(mockInput);
      expect(client.send).toHaveBeenCalledWith(mockCommand);
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
      const mockCommand = {};
      vi.mocked(SuggestCommand).mockReturnValueOnce(mockCommand as SuggestCommand);
      vi.mocked(client.send).mockResolvedValueOnce(mockResponse as unknown as void);
      const result = await suggest(client, mockInput);
      expect(SuggestCommand).toHaveBeenCalledWith(mockInput);
      expect(client.send).toHaveBeenCalledWith(mockCommand);
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
      const mockCommand = {};
      vi.mocked(GetPlaceCommand).mockReturnValueOnce(mockCommand as GetPlaceCommand);
      vi.mocked(client.send).mockResolvedValueOnce(mockResponse as unknown as void);
      const result = await getPlace(client, mockInput);
      expect(GetPlaceCommand).toHaveBeenCalledWith(mockInput);
      expect(client.send).toHaveBeenCalledWith(mockCommand);
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors from the GetPlace request", async () => {
      const mockError = new Error("API error");
      vi.mocked(client.send).mockRejectedValueOnce(mockError);
      await expect(getPlace(client, mockInput)).rejects.toThrow("API error");
    });
  });
});
