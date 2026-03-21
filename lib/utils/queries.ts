import type {
  AutocompleteCommandInput,
  GeoPlacesClient,
  GetPlaceCommandInput,
  SuggestCommandInput,
} from "@chaosity/location-client";
import { autocomplete, getPlace, suggest } from "./api";

export const autocompleteQuery = (client: GeoPlacesClient, input: AutocompleteCommandInput) => {
  return {
    queryKey: ["autocomplete", input],
    queryFn: () => autocomplete(client, input),
  };
};

export const suggestQuery = (client: GeoPlacesClient, input: SuggestCommandInput) => {
  return {
    queryKey: ["suggest", input],
    queryFn: () => suggest(client, input),
  };
};

export const getPlaceQuery = (client: GeoPlacesClient, input: GetPlaceCommandInput) => {
  return {
    queryKey: ["getPlace", input],
    queryFn: () => getPlace(client, input),
  };
};
