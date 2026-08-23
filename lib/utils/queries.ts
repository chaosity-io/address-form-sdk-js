import type {
  AutocompleteCommandInput,
  GetPlaceCommandInput,
  ReverseGeocodeCommandInput,
  SuggestCommandInput,
} from "@chaosity/location-client";
import type { LocationClientLike } from "./api";
import { autocomplete, getPlace, reverseGeocode, suggest } from "./api";

/**
 * React Query hands `queryFn` an AbortSignal and aborts it when a query is
 * superseded or unmounted. Forwarding it is what makes a typeahead stop paying
 * for keystrokes the user has already typed past — the request is cancelled in
 * flight rather than completing into a result nobody reads.
 */

export const autocompleteQuery = (client: LocationClientLike, input: AutocompleteCommandInput) => {
  return {
    queryKey: ["autocomplete", input],
    queryFn: ({ signal }: { signal: AbortSignal }) => autocomplete(client, input, { signal }),
  };
};

export const suggestQuery = (client: LocationClientLike, input: SuggestCommandInput) => {
  return {
    queryKey: ["suggest", input],
    queryFn: ({ signal }: { signal: AbortSignal }) => suggest(client, input, { signal }),
  };
};

export const getPlaceQuery = (client: LocationClientLike, input: GetPlaceCommandInput) => {
  return {
    queryKey: ["getPlace", input],
    queryFn: ({ signal }: { signal: AbortSignal }) => getPlace(client, input, { signal }),
  };
};

export const reverseGeocodeQuery = (client: LocationClientLike, input: ReverseGeocodeCommandInput) => {
  return {
    queryKey: ["reverseGeocode", input],
    queryFn: ({ signal }: { signal: AbortSignal }) => reverseGeocode(client, input, { signal }),
  };
};
