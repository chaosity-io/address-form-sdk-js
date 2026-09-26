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
import { LocationClientStatus } from "./LocationClientStatus";
import type { PickedFields } from "./use-get-data";
import { pickedFields } from "./use-get-data";

export interface AddressFormProps extends PropsWithChildren {
  /** Resolve the chosen PlaceId through `POST /address/verify` on submit (#21). */
  verify?: boolean;
  language?: string;
  /**
   * Political view for address suggestions. Open to every plan — unlike the
   * map's own `politicalView` on `AddressForm.Map`, which is a plan feature.
   */
  politicalView?: string;
  showCurrentCountryResultsOnly?: boolean;
  allowedCountries?: string[];
  placeTypes?: AutocompleteFilterPlaceType[];
  initialMapCenter?: [number, number];
  initialMapZoom?: number;
}

export const AddressFormProvider: FunctionComponent<AddressFormProps> = ({
  children,
  verify,
  language,
  politicalView,
  showCurrentCountryResultsOnly,
  allowedCountries,
  placeTypes,
  initialMapCenter,
  initialMapZoom,
}) => {
  // The data, and the picked fields as they stood when `placeId` was last
  // written — by a pick, or by autofill resolving the browser's text to a place.
  // One state, so the two cannot disagree (#21).
  const [{ data, pick }, setForm] = useState<{ data: AddressFormData; pick?: PickedFields }>({ data: {} });
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
      pick,
      verify,
      setData: (next: AddressFormData) =>
        setForm((form) => {
          const merged = { ...form.data, ...next };
          return { data: merged, pick: "placeId" in next ? pickedFields(merged) : form.pick };
        }),
      resetData: () => setForm({ data: {} }),
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
      pick,
      verify,
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
      <AddressFormContext.Provider value={context}>
        {/* Here, so both forms — <AddressForm> and render() — carry it (#30). */}
        <LocationClientStatus />
        {children}
      </AddressFormContext.Provider>
    </QueryClientProvider>
  );
};
