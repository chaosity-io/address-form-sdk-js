import type { AutocompleteCommandOutput, SuggestCommandOutput } from "@chaosity/location-client";
import { GeoPlacesClient } from "@chaosity/location-client";
import { LocationClientProvider } from "@chaosity/location-client-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../utils/api";
import { createQueryClient } from "../../utils/query-client";
import type { TypeaheadAPIName } from "./use-typeahead-query";
import { useTypeaheadQuery } from "./use-typeahead-query";

// Mock the API functions
vi.mock("../../utils/api", () => ({
  autocomplete: vi.fn(),
  suggest: vi.fn(),
}));

// The test's own client, as each form has its own.
const queryClient = createQueryClient();

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
      <LocationClientProvider getConfig={mockGetConfig}>{children}</LocationClientProvider>
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

      expect(api.autocomplete).toHaveBeenCalledWith(
        mockClient,
        { QueryText: "123" },
        {
          signal: expect.any(AbortSignal),
        },
      );
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

      expect(api.autocomplete).toHaveBeenCalledWith(
        mockClient,
        { QueryText: "test", MaxResults: 3 },
        { signal: expect.any(AbortSignal) },
      );
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

      expect(api.suggest).toHaveBeenCalledWith(
        mockClient,
        { QueryText: "rest", BiasPosition: [0, 0] },
        { signal: expect.any(AbortSignal) },
      );
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

      expect(api.suggest).toHaveBeenCalledWith(
        mockClient,
        {
          QueryText: "hotel",
          BiasPosition: [40.7128, -74.006],
          MaxResults: 10,
        },
        { signal: expect.any(AbortSignal) },
      );
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
    /** The keys the cache holds for the typeahead, after these hooks mounted. */
    const typeaheadKeys = () =>
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["typeahead"] })
        .map((q) => q.queryKey);

    it("should generate different query keys for different api types", () => {
      renderHook(() => useTypeaheadQuery({ client: mockClient, apiName: "autocomplete", enabled: false }), {
        wrapper: createWrapper(mockClient),
      });
      renderHook(() => useTypeaheadQuery({ client: mockClient, apiName: "suggest", enabled: false }), {
        wrapper: createWrapper(mockClient),
      });

      expect(typeaheadKeys()).toHaveLength(2);
    });

    it("should generate different query keys for different input parameters", () => {
      for (const QueryText of ["test1", "test2"]) {
        renderHook(
          () =>
            useTypeaheadQuery({ client: mockClient, apiName: "autocomplete", apiInput: { QueryText }, enabled: false }),
          { wrapper: createWrapper(mockClient) },
        );
      }

      expect(typeaheadKeys()).toHaveLength(2);
    });
  });

  // The key used to be ["typeahead", apiName, QueryText], so the same text
  // under another country filter, language or political view was answered
  // from the cache with the list for the first one, for 30 minutes and across
  // every form on the page (#31). Everything that shapes the request is in the
  // key now, except BiasPosition, which the map-view invalidation handles.
  describe("the cache key covers everything that shapes the request (#31)", () => {
    const answer = (label: string): AutocompleteCommandOutput => ({
      ResultItems: [{ PlaceId: label, Address: { Label: label }, PlaceType: "PointAddress", Title: label }],
      PricingBucket: "bucket1",
      $metadata: {},
    });

    const ask = async (apiInput: Parameters<typeof useTypeaheadQuery>[0]["apiInput"]) => {
      const { result, unmount } = renderHook(
        () => useTypeaheadQuery({ client: mockClient, apiName: "autocomplete", apiInput, enabled: true }),
        { wrapper: createWrapper(mockClient) },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const data = result.current.data;
      unmount();
      return data;
    };

    it.each([
      ["Filter.IncludeCountries", { Filter: { IncludeCountries: ["GB"] } }],
      ["Language", { Language: "fr" }],
      ["PoliticalView", { PoliticalView: "IND" }],
      ["MaxResults", { MaxResults: 3 }],
    ])("asks again when only %s changes, and does not show the first list", async (_name, change) => {
      vi.mocked(api.autocomplete).mockResolvedValueOnce(answer("unfiltered")).mockResolvedValueOnce(answer("changed"));

      const first = await ask({ QueryText: "10 High St" });
      const second = await ask({ QueryText: "10 High St", ...change });

      expect(api.autocomplete).toHaveBeenCalledTimes(2);
      expect(vi.mocked(api.autocomplete).mock.calls[1][1]).toMatchObject(change);
      expect(first?.map((r) => r.title)).toEqual(["unfiltered"]);
      expect(second?.map((r) => r.title)).toEqual(["changed"]);
    });

    it("answers from the cache when only BiasPosition changes", async () => {
      vi.mocked(api.autocomplete).mockResolvedValue(answer("one"));

      await ask({ QueryText: "10 High St", BiasPosition: [151.2, -33.8] });
      await ask({ QueryText: "10 High St", BiasPosition: [151.3, -33.9] });

      expect(api.autocomplete).toHaveBeenCalledTimes(1);
    });

    it("is still matched by the ['typeahead'] prefix every invalidation uses", async () => {
      vi.mocked(api.autocomplete).mockResolvedValue(answer("one"));
      await ask({ QueryText: "10 High St", Filter: { IncludeCountries: ["GB"] }, Language: "en" });

      expect(queryClient.getQueryCache().findAll({ queryKey: ["typeahead"] })).toHaveLength(1);
      queryClient.removeQueries({ queryKey: ["typeahead"] });
      expect(queryClient.getQueryCache().findAll({ queryKey: ["typeahead"] })).toHaveLength(0);
    });
  });

  describe("cancellation (#2)", () => {
    /**
     * The reason this hook needs the signal at all.
     *
     * A typeahead fires per keystroke. Without cancellation every superseded
     * request runs to completion: the user pays for searches they have already
     * typed past, and a slow early response can land AFTER a fast later one and
     * overwrite the list with stale results.
     */

    it.each([
      ["autocomplete", () => api.autocomplete],
      ["suggest", () => api.suggest],
    ])("forwards React Query's AbortSignal to %s", async (apiName, fn) => {
      vi.mocked(fn()).mockResolvedValue({
        ResultItems: [],
        PricingBucket: "b",
        $metadata: {},
      } as never);

      const { result } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: apiName as TypeaheadAPIName,
            apiInput: { QueryText: "syd" },
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const options = vi.mocked(fn()).mock.calls[0]?.[2];
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    });

    it("passes a signal that is not already aborted", async () => {
      // A signal that arrives pre-aborted would cancel every first request —
      // the failure mode of threading the wrong controller through.
      vi.mocked(api.autocomplete).mockResolvedValue({
        ResultItems: [],
        PricingBucket: "b",
        $metadata: {},
      } as never);

      const { result } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "autocomplete",
            apiInput: { QueryText: "syd" },
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(vi.mocked(api.autocomplete).mock.calls[0]?.[2]?.signal?.aborted).toBe(false);
    });

    it("keeps the input untouched — the signal travels in options, not the request", async () => {
      // Suggest still gets its BiasPosition default; the signal must not leak
      // into the command input, where AWS would reject it.
      vi.mocked(api.suggest).mockResolvedValue({
        ResultItems: [],
        PricingBucket: "b",
        $metadata: {},
      } as never);

      const { result } = renderHook(
        () =>
          useTypeaheadQuery({
            client: mockClient,
            apiName: "suggest",
            apiInput: { QueryText: "syd" },
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const [, input] = vi.mocked(api.suggest).mock.calls[0]!;
      expect(input).toEqual({ QueryText: "syd", BiasPosition: [0, 0] });
      expect(input).not.toHaveProperty("signal");
    });
  });
});
