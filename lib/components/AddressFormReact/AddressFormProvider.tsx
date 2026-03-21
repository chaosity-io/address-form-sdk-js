import type { AutocompleteFilterPlaceType } from "@chaosity/location-client";
import { QueryClientProvider } from "@tanstack/react-query";
import type { FunctionComponent, PropsWithChildren } from "react";
import { useMemo, useState } from "react";
import { countries } from "../../data/countries";
import { queryClient } from "../../utils/query-client";
import type { TypeaheadAPIName } from "../Typeahead/use-typeahead-query";
import type { AddressFormData } from "./AddressForm";
import type { AddressFormContextType, MapViewState } from "./AddressFormContext";
import { AddressFormContext } from "./AddressFormContext";

export interface AddressFormProps extends PropsWithChildren {
  language?: string;
  politicalView?: string;
  showCurrentCountryResultsOnly?: boolean;
  allowedCountries?: string[];
  placeTypes?: AutocompleteFilterPlaceType[];
  initialMapCenter?: [number, number];
  initialMapZoom?: number;
}

export const AddressFormProvider: FunctionComponent<AddressFormProps> = ({
  children,
  language,
  politicalView,
  showCurrentCountryResultsOnly,
  allowedCountries,
  placeTypes,
  initialMapCenter,
  initialMapZoom,
}) => {
  const [data, setData] = useState<AddressFormData>({});
  const [isAutofill, setIsAutofill] = useState(false);
  const [mapViewState, setMapViewState] = useState<MapViewState>(() => {
    // If explicit initial values provided, use them
    if (initialMapCenter) {
      return {
        longitude: initialMapCenter[0],
        latitude: initialMapCenter[1],
        zoom: initialMapZoom ?? 10,
      };
    }

    // Fallback: If single country allowed, center on that country
    if (allowedCountries?.length === 1) {
      const country = countries.find((c) => c.code === allowedCountries[0]);
      if (country?.position) {
        return {
          longitude: country.position[0],
          latitude: country.position[1],
          zoom: initialMapZoom ?? 5,
        };
      }
    }

    // Default fallback
    return {
      longitude: 0,
      latitude: 0,
      zoom: initialMapZoom ?? 1,
    };
  });
  const [typeaheadApiName, setTypeaheadApiName] = useState<TypeaheadAPIName | null>(null);

  const context = useMemo<AddressFormContextType>(
    () => ({
      data,
      setData: (data: AddressFormData) => setData((state) => ({ ...state, ...data })),
      resetData: () => setData({}),
      mapViewState,
      setMapViewState,
      language,
      politicalView,
      showCurrentCountryResultsOnly,
      allowedCountries,
      placeTypes,
      isAutofill,
      setIsAutofill,
      typeaheadApiName,
      setTypeaheadApiName,
    }),
    [
      data,
      mapViewState,
      language,
      politicalView,
      showCurrentCountryResultsOnly,
      allowedCountries,
      placeTypes,
      isAutofill,
      typeaheadApiName,
    ],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AddressFormContext.Provider value={context}>{children}</AddressFormContext.Provider>
    </QueryClientProvider>
  );
};
