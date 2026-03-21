// Components
export { LocationClientProvider } from "@chaosity/location-client-react";
export { AddressForm, type AddressFormData, type SubmitHandler } from "./components/AddressFormReact";
export { Button } from "./components/Button";
export { CountrySelect, type CountrySelectProps } from "./components/CountrySelect";
export { Flex } from "./components/Flex";
export { FormField } from "./components/FormField";
export { Input } from "./components/Input";
export { LocateButton } from "./components/LocateButton";
export { Map, type ColorScheme } from "./components/Map";
export { MapMarker } from "./components/MapMarker";
export { Typeahead } from "./components/Typeahead";

// Utils
export { getColorScheme, getMapStyleType } from "./components/Map/utils";
export { getIncludeCountriesFilter } from "./utils/country-filter";

// Data
export { countries } from "./data/countries";

// Styles
import "maplibre-gl/dist/maplibre-gl.css";

// Legacy exports - deprecated, use components from AddressFormReact instead
export { AddressForm as __AddressForm, AddressFormMap as __AddressFormMap } from "./components/AddressForm";
export type {
  AddressFormData as __AddressFormData,
  AddressFormField as __AddressFormField,
  AddressFormMapProps as __AddressFormMapProps,
  AddressFormProps as __AddressFormProps,
} from "./components/AddressForm";
export {
  FormFieldID as __FormFieldID,
  defaultAddressFormFields as __defaultAddressFormFields,
} from "./components/AddressForm/form-field";
