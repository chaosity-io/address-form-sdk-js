import type { AutocompleteCommandInput, GeoPlacesClient, SuggestCommandInput } from "@chaosity/location-client";
import { useQuery } from "@tanstack/react-query";
import { autocomplete, suggest } from "../../utils/api";

export type TypeaheadAPIName = "autocomplete" | "suggest";

export type TypeaheadAPIInput = Partial<AutocompleteCommandInput> | Partial<SuggestCommandInput>;

export type UseTypeaheadParams = {
  client: GeoPlacesClient;
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
    queryFn: () => {
      if (apiName === "autocomplete") {
        return getAutocompleteResults(client, {
          QueryText: "",
          ...(apiInput as Partial<AutocompleteCommandInput>),
        });
      }

      if (apiName === "suggest") {
        return getSuggestResults(client, {
          QueryText: "",
          ...(apiInput as Partial<SuggestCommandInput>),
        });
      }

      throw new Error(`Invalid value for typeahead api name: '${apiName}'`);
    },
  });
};

const getAutocompleteResults = async (
  client: GeoPlacesClient,
  input: AutocompleteCommandInput,
): Promise<TypeaheadResultItem[]> => {
  const response = await autocomplete(client, input);

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
  client: GeoPlacesClient,
  input: SuggestCommandInput,
): Promise<TypeaheadResultItem[]> => {
  const response = await suggest(client, {
    ...input,
    BiasPosition: input.BiasPosition ?? [0, 0],
  });

  return (
    response.ResultItems?.filter((item) => {
      return item.Place?.PlaceId && item.Title;
    }).map((item) => ({
      placeId: item.Place!.PlaceId!,
      title: item.Place?.Address?.Label ?? item.Title!,
    })) ?? []
  );
};
