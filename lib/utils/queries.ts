import type {
  AutocompleteCommandInput,
  AutocompleteCommandOutput,
  GetPlaceCommandInput,
  GetPlaceCommandOutput,
  ReverseGeocodeCommandInput,
  ReverseGeocodeCommandOutput,
  SuggestCommandInput,
  SuggestCommandOutput,
} from "@chaosity/location-client";
import type { LocationClientLike } from "./api";
import { autocomplete, getPlace, reverseGeocode, suggest } from "./api";

/**
 * React Query hands `queryFn` an AbortSignal and aborts it when a query is
 * superseded or unmounted. Forwarding it is what makes a typeahead stop paying
 * for keystrokes the user has already typed past — the request is cancelled in
 * flight rather than completing into a result nobody reads.
 *
 * Each `queryFn` names its output type from `@chaosity/location-client`.
 * Inferred, the declarations wrote it as an import of
 * `@aws-sdk/client-geo-places`, which this package does not declare (#33).
 */

export const autocompleteQuery = (client: LocationClientLike, input: AutocompleteCommandInput) => {
  return {
    queryKey: ["autocomplete", input],
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<AutocompleteCommandOutput> =>
      autocomplete(client, input, { signal }),
  };
};

export const suggestQuery = (client: LocationClientLike, input: SuggestCommandInput) => {
  return {
    queryKey: ["suggest", input],
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<SuggestCommandOutput> => suggest(client, input, { signal }),
  };
};

export const getPlaceQuery = (client: LocationClientLike, input: GetPlaceCommandInput) => {
  return {
    queryKey: ["getPlace", input],
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetPlaceCommandOutput> =>
      getPlace(client, input, { signal }),
  };
};

export const reverseGeocodeQuery = (client: LocationClientLike, input: ReverseGeocodeCommandInput) => {
  return {
    queryKey: ["reverseGeocode", input],
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<ReverseGeocodeCommandOutput> =>
      reverseGeocode(client, input, { signal }),
  };
};
