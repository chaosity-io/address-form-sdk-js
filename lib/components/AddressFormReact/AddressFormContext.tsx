import type { AutocompleteFilterPlaceType } from "@chaosity/location-client";
import { createContext, useContext } from "react";
import type { TypeaheadAPIName } from "../Typeahead/use-typeahead-query";
import type { AddressFormData } from "./AddressForm";
import type { PickedFields } from "./use-get-data";

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface AddressFormContextType {
  data: AddressFormData;
  /**
   * The picked fields as they stood when `placeId` was last written — by a
   * pick, or by autofill resolving the browser's text to a place. `getData`
   * verifies only while the form still reads them (#21).
   */
  pick?: PickedFields;
  /** Resolve the chosen PlaceId through `POST /address/verify` on submit (#21). */
  verify?: boolean;
  setData: (data: AddressFormData) => void;
  resetData?: () => void;
  mapViewState?: MapViewState;
  setMapViewState: (mapViewState: MapViewState) => void;
  language?: string;
  /**
   * Political view for address suggestions. Open to every plan — unlike the
   * map's own `politicalView` on `AddressForm.Map`, which is a plan feature.
   */
  politicalView?: string;
  showCurrentCountryResultsOnly?: boolean;
  allowedCountries?: string[];
  placeTypes?: AutocompleteFilterPlaceType[];
  isAutofill: boolean;
  setIsAutofill: (isAutofill: boolean) => void;
  typeaheadApiName: TypeaheadAPIName | null;
  setTypeaheadApiName: (typeaheadApiName: TypeaheadAPIName | null) => void;
}

export const AddressFormContext = createContext<AddressFormContextType | undefined>(undefined);

export const useAddressFormContext = () => {
  const context = useContext(AddressFormContext);

  if (!context) {
    throw new Error("Address form context is not initialized.");
  }

  return context;
};
