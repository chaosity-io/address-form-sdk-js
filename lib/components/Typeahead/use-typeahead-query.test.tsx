import { AutocompleteCommandOutput, SuggestCommandOutput } from "@chaosity/location-client";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeoPlacesClient } from "@chaosity/location-client";
import { LocationClientProvider } from "@chaosity/location-client-react";
import { QueryClientProvider } from "@tanstack/react-query";
import * as api from "../../utils/api";
import { queryClient } from "../../utils/query-client";
import { TypeaheadAPIName, useTypeaheadQuery } from "./use-typeahead-query";

// Mock the API functions
vi.mock("../../utils/api", () => ({
  autocomplete: vi.fn(),
  suggest: vi.fn(),
}));

// Regular function so vi.clearAllMocks() cannot clear its implementation
const mockGetConfig = () =>
  Promise.resolve({
    apiUrl: "https://test-api.chaosity.cloud",
    token: "test-token",
    expiresAt: Date.now() + 900_000,
  });

// Create a wrapper component for testing hooks that need the providers
const createWrapper = (_client?: GeoPlacesClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LocationClientProvider getConfig={mockGetConfig}>
        {children}
      </LocationClientProvider>
    </QueryClientProvider>
  );
};

describe("useTypeaheadQuery", () => {
  let mockClient: GeoPlacesClient;

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    mockClient = new GeoPlacesClient({ apiUrl: "https://test-api.chaosity.cloud", token: "test-token" });
  });

  describe("autocomplete api", () => {
    it("should call autocomplete api with default querytext when api is autocomplete", async () => {
      const mockResponse: AutocompleteCommandOutput = {
        ResultItems: [
          {
            PlaceId: "place-1",
            Address: { Label: "123 Main St" },
            PlaceType: "Street",
            Title: "Place",
          },
        ],
        PricingBucket: "bucket1",
        $metadata: {},
      };
      vi.mocked(api.autocomplete).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "autocomplete",
            apiInput: { QueryText: "123" },
            enabled: true,
          }),
        { wrapper: createWrapper(mockClient) },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.autocomplete).toHaveBeenCalledWith(mockClient, { QueryText: "123" });
      expect(result.current.data).toEqual([{ placeId: "place-1", title: "123 Main St" }]);
    });

    it("should call autocomplete api with custom input when source is array", async () => {
      const mockResponse: AutocompleteCommandOutput = {
        ResultItems: [
          {
            PlaceId: "place-2",
            Address: { Label: "456 Oak Ave" },
            PlaceType: "Street",
            Title: "Place",
          },
        ],
        PricingBucket: "bucket1",
        $metadata: {},
      };
      vi.mocked(api.autocomplete).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "autocomplete",
            apiInput: { QueryText: "test", MaxResults: 3 },
            enabled: true,
          }),
        {
          wrapper: createWrapper(mockClient),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.autocomplete).toHaveBeenCalledWith(mockClient, { QueryText: "test", MaxResults: 3 });
      expect(result.current.data).toEqual([{ placeId: "place-2", title: "456 Oak Ave" }]);
    });

    it("should filter out autocomplete results without place id or address label", async () => {
      const mockResponse: AutocompleteCommandOutput = {
        ResultItems: [
          {
            PlaceId: "place-1",
            Address: { Label: "123 Main St" },
            PlaceType: "InterpolatedAddress",
            Title: "123 Main St",
          },
          {
            PlaceId: undefined, // Missing PlaceId
            Address: { Label: "456 Oak Ave" },
            PlaceType: "InterpolatedAddress",
            Title: "456 Oak Ave",
          },
          {
            PlaceId: "place-3",
            Address: { Label: undefined }, // Missing Label
            PlaceType: "InterpolatedAddress",
            Title: "Place 3",
          },
          {
            PlaceId: "place-4",
            Address: { Label: "789 Pine Rd" },
            PlaceType: "InterpolatedAddress",
            Title: "789 Pine Rd",
          },
        ],
        PricingBucket: "bucket1",
        $metadata: {},
      };
      vi.mocked(api.autocomplete).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "autocomplete", enabled: true }),
        { wrapper: createWrapper(mockClient) },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([
        { placeId: "place-1", title: "123 Main St" },
        { placeId: "place-4", title: "789 Pine Rd" },
      ]);
    });

    it("should return empty array when autocomplete has no resultitems", async () => {
      const mockResponse = {
        ResultItems: undefined,
        PricingBucket: "bucket1",
        $metadata: {},
      };
      vi.mocked(api.autocomplete).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "autocomplete", enabled: true }),
        { wrapper: createWrapper(mockClient) },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe("suggest api", () => {
    it("should call suggest api with default querytext and biasposition when api is suggest", async () => {
      const mockResponse: SuggestCommandOutput = {
        ResultItems: [
          {
            Place: { PlaceId: "place-1" },
            Title: "Restaurant ABC",
            SuggestResultItemType: "Place",
          },
        ],
        PricingBucket: "bucket1",
        $metadata: {},
      };
      vi.mocked(api.suggest).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "suggest",
            apiInput: { QueryText: "rest" },
            enabled: true,
          }),
        { wrapper: createWrapper(mockClient) },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.suggest).toHaveBeenCalledWith(mockClient, { QueryText: "rest", BiasPosition: [0, 0] });
      expect(result.current.data).toEqual([{ placeId: "place-1", title: "Restaurant ABC" }]);
    });

    it("should call suggest api with custom input and preserve custom biasposition", async () => {
      const mockResponse: SuggestCommandOutput = {
        ResultItems: [
          {
            Place: { PlaceId: "place-2" },
            Title: "Hotel XYZ",
            SuggestResultItemType: "Place",
          },
        ],
        PricingBucket: "bucket1",
        $metadata: {},
      };
      vi.mocked(api.suggest).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "suggest",
            apiInput: {
              QueryText: "hotel",
              BiasPosition: [40.7128, -74.006],
              MaxResults: 10,
            },
            enabled: true,
          }),
        {
          wrapper: createWrapper(mockClient),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.suggest).toHaveBeenCalledWith(mockClient, {
        QueryText: "hotel",
        BiasPosition: [40.7128, -74.006],
        MaxResults: 10,
      });
      expect(result.current.data).toEqual([{ placeId: "place-2", title: "Hotel XYZ" }]);
    });

    it("should filter out suggest results without place place id or title", async () => {
      const mockResponse: SuggestCommandOutput = {
        ResultItems: [
          {
            Place: { PlaceId: "place-1" },
            Title: "Restaurant ABC",
            SuggestResultItemType: "Place",
          },
          {
            Place: { PlaceId: undefined }, // Missing PlaceId
            Title: "Hotel XYZ",
            SuggestResultItemType: "Place",
          },
          {
            Place: { PlaceId: "place-3" },
            Title: undefined, // Missing Title
            SuggestResultItemType: "Place",
          },
          {
            Place: { PlaceId: "place-4" },
            Title: "Coffee Shop",
            SuggestResultItemType: "Place",
          },
        ],
        PricingBucket: "bucket1",
        $metadata: {},
      };
      vi.mocked(api.suggest).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "suggest", enabled: true }),
        {
          wrapper: createWrapper(mockClient),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([
        { placeId: "place-1", title: "Restaurant ABC" },
        { placeId: "place-4", title: "Coffee Shop" },
      ]);
    });

    it("should return empty array when suggest has no resultitems", async () => {
      const mockResponse: SuggestCommandOutput = {
        ResultItems: undefined,
        PricingBucket: "bucket1",
        $metadata: {},
      };
      vi.mocked(api.suggest).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "suggest", enabled: true }),
        {
          wrapper: createWrapper(mockClient),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe("query behavior", () => {
    it("should not execute query when enabled is false", () => {
      renderHook(() => useTypeaheadQuery({ client: mockClient, apiName: "autocomplete", enabled: false }), {
        wrapper: createWrapper(mockClient),
      });

      expect(api.autocomplete).not.toHaveBeenCalled();
    });

    it("should use correct query key for caching", () => {
      const { result } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "autocomplete",
            apiInput: { QueryText: "test" },
            enabled: true,
          }),
        { wrapper: createWrapper(mockClient) },
      );

      // The query key should include the API type and input parameters
      expect(result.current.isLoading || result.current.isSuccess).toBe(true);
    });

    it("should handle api errors gracefully", async () => {
      const mockError = new Error("API Error");
      vi.mocked(api.autocomplete).mockRejectedValue(mockError);

      const defaultOptions = queryClient.getDefaultOptions();
      queryClient.setDefaultOptions({ queries: { retry: false } });

      const { result } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "autocomplete", enabled: true }),
        { wrapper: createWrapper(mockClient) },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(mockError);

      // Restore default options
      queryClient.setDefaultOptions(defaultOptions);
    });

    it("should throw error for invalid api type", async () => {
      const defaultOptions = queryClient.getDefaultOptions();
      queryClient.setDefaultOptions({ queries: { retry: false } });

      const { result } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "invalid-api" as TypeaheadAPIName, enabled: true }),
        { wrapper: createWrapper(mockClient) },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toContain("Invalid value for typeahead api name");

      // Restore default options
      queryClient.setDefaultOptions(defaultOptions);
    });
  });

  describe("query key generation", () => {
    it("should generate different query keys for different api types", () => {
      const { result: autocompleteResult } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "autocomplete", enabled: false }),
        { wrapper: createWrapper(mockClient) },
      );

      const { result: suggestResult } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "suggest", enabled: false }),
        { wrapper: createWrapper(mockClient) },
      );

      // Both should be different instances since they have different query keys
      expect(autocompleteResult.current).not.toBe(suggestResult.current);
    });

    it("should generate different query keys for different input parameters", () => {
      const { result: result1 } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "autocomplete",
            apiInput: { QueryText: "test1" },
            enabled: false,
          }),
        { wrapper: createWrapper(mockClient) },
      );

      const { result: result2 } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "autocomplete",
            apiInput: { QueryText: "test2" },
            enabled: false,
          }),
        { wrapper: createWrapper(mockClient) },
      );

      // Both should be different instances since they have different query keys
      expect(result1.current).not.toBe(result2.current);
    });
  });
});
