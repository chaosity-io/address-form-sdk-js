import type { AutocompleteCommandInput, SuggestCommandInput } from "@chaosity/location-client";
import { useQuery } from "@tanstack/react-query";
import type { LocationClientLike } from "../../utils/api";
import { autocomplete, suggest } from "../../utils/api";

export type TypeaheadAPIName = "autocomplete" | "suggest";

export type TypeaheadAPIInput = Partial<AutocompleteCommandInput> | Partial<SuggestCommandInput>;

export type UseTypeaheadParams = {
  client: LocationClientLike;
  apiName: TypeaheadAPIName;
  apiInput?: TypeaheadAPIInput;
  enabled: boolean;
};

export interface TypeaheadResultItem {
  title: string;
  placeId: string;
}

export const useTypeaheadQuery = ({ client, apiName, apiInput, enabled }: UseTypeaheadParams) => {
  return useQuery({
    enabled,
    queryKey: ["typeahead", apiName, apiInput?.QueryText], // Only trigger calls if on query text change
    // React Query hands `queryFn` an AbortSignal and aborts it as soon as the
    // query is superseded or unmounted. Forwarding it is the whole point of
    // this hook's existence in a typeahead: without it, every keystroke's
    // request runs to completion, so the user pays for searches they have
    // already typed past, and a slow early response can land AFTER a fast
    // later one and overwrite the list with stale results.
    //
    // The sibling helpers in utils/queries.ts have done this since T31; this
    // hook was the one path left that did not, and it is the one that fires on
    // every keystroke (#2 / T34).
    queryFn: ({ signal }) => {
      if (apiName === "autocomplete") {
        return getAutocompleteResults(
          client,
          {
            QueryText: "",
            ...(apiInput as Partial<AutocompleteCommandInput>),
          },
          signal,
        );
      }

      if (apiName === "suggest") {
        return getSuggestResults(
          client,
          {
            QueryText: "",
            ...(apiInput as Partial<SuggestCommandInput>),
          },
          signal,
        );
      }

      throw new Error(`Invalid value for typeahead api name: '${apiName}'`);
    },
  });
};

const getAutocompleteResults = async (
  client: LocationClientLike,
  input: AutocompleteCommandInput,
  signal?: AbortSignal,
): Promise<TypeaheadResultItem[]> => {
  const response = await autocomplete(client, input, { signal });

  return (
    response.ResultItems?.filter((item) => {
      return item.PlaceId && item.Address?.Label;
    }).map((item) => ({
      placeId: item.PlaceId!,
      title: item.Address!.Label!,
    })) ?? []
  );
};

const getSuggestResults = async (
  client: LocationClientLike,
  input: SuggestCommandInput,
  signal?: AbortSignal,
): Promise<TypeaheadResultItem[]> => {
  const response = await suggest(
    client,
    {
      ...input,
      BiasPosition: input.BiasPosition ?? [0, 0],
    },
    { signal },
  );

  return (
    response.ResultItems?.filter((item) => {
      return item.Place?.PlaceId && item.Title;
    }).map((item) => ({
      placeId: item.Place!.PlaceId!,
      title: item.Place?.Address?.Label ?? item.Title!,
    })) ?? []
  );
};
