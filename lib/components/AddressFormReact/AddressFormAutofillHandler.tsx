import { GeoPlacesClient, GetPlaceAdditionalFeature } from "@chaosity/location-client";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import useAmazonLocationContext from "../../hooks/use-amazon-location-context";
import { AutofillValues, detectAutofill } from "../../utils/detect-autofill";
import { autocompleteQuery, getPlaceQuery, suggestQuery } from "../../utils/queries";
import { TypeaheadAPIName } from "../Typeahead/use-typeahead-query";
import { useAddressFormContext } from "./AddressFormContext";
import type { Field } from "./AddressFormFields";

interface AddressFormAutofillHandlerProps {
  form: HTMLFormElement;
}

export const AddressFormAutofillHandler = ({ form }: AddressFormAutofillHandlerProps) => {
  const { client } = useAmazonLocationContext();
  const { mapViewState, setMapViewState, setData, setIsAutofill, typeaheadApiName, language } = useAddressFormContext();
  const queryClient = useQueryClient();
  const handleAutofillRef = useRef<(values: AutofillValues) => Promise<void>>(undefined);

  handleAutofillRef.current = async (values: AutofillValues) => {
    if (typeaheadApiName === null) {
      return;
    }

    setIsAutofill(true);
    const query = buildQuery(values);

    const placeId = await getPlaceId(queryClient, client, query, typeaheadApiName, language, [
      mapViewState?.longitude ?? 0,
      mapViewState?.latitude ?? 0,
    ]);

    if (!placeId) {
      setIsAutofill(false);
      return;
    }

    const placeResponse = await queryClient.ensureQueryData(
      getPlaceQuery(client, {
        PlaceId: placeId,
        Language: language,
        AdditionalFeatures: [GetPlaceAdditionalFeature.SECONDARY_ADDRESSES],
      }),
    );

    if (placeResponse.Position?.length === 2) {
      const [longitude, latitude] = placeResponse.Position;
      setMapViewState({ longitude, latitude, zoom: 15 });
    }

    setData({
      country: placeResponse.Address?.Country?.Code2, // This override is required since user might have the country name instead of the code in the saved autofill
      originalPosition: placeResponse.Position?.join(","),
      addressDetails: placeResponse.Address,
      secondaryAddresses: placeResponse.SecondaryAddresses,
    });

    setIsAutofill(false);

    // The user filled an address, we can clear the cache without refetching
    queryClient.removeQueries({ queryKey: ["typeahead"] });
    queryClient.removeQueries({ queryKey: ["getPlace"] });
  };

  useEffect(() => {
    return detectAutofill(form, (values) => handleAutofillRef.current?.(values));
  }, [form]);

  return null;
};

/**
 * Builds a comma-separated query string from autofill form values
 */
const buildQuery = (values: AutofillValues): string => {
  return [
    getValue(values, "addressLineOne"),
    getValue(values, "city"),
    getValue(values, "province"),
    getValue(values, "postalCode"),
    getValue(values, "country"),
  ]
    .filter(Boolean)
    .join(", ");
};

/**
 * Extracts and trims a field value from autofill values
 */
const getValue = (values: AutofillValues, field: Field) => {
  if (field in values) {
    const value = values[field].trim();

    if (value) {
      return value;
    }
  }
};

/**
 * Retrieves place ID using autocomplete or suggest API
 */
const getPlaceId = async (
  queryClient: QueryClient,
  client: GeoPlacesClient,
  query: string,
  apiName: TypeaheadAPIName,
  language?: string,
  biasPosition?: [number, number],
) => {
  if (apiName === "autocomplete") {
    const autocompleteResponse = await queryClient.ensureQueryData(
      autocompleteQuery(client, {
        QueryText: query,
        MaxResults: 1,
        Language: language,
      }),
    );

    return autocompleteResponse.ResultItems?.[0].PlaceId;
  }

  if (apiName === "suggest") {
    const suggestResponse = await queryClient.ensureQueryData(
      suggestQuery(client, {
        QueryText: query,
        MaxResults: 1,
        BiasPosition: biasPosition,
        Language: language,
      }),
    );

    return suggestResponse.ResultItems?.[0].Place?.PlaceId;
  }
};
