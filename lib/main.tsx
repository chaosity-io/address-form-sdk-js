// Components
export { AddressForm, type AddressFormData, type SubmitHandler } from "./components/AddressFormReact";
export { LocationClientProvider } from "@chaosity/location-client-react";
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
export { getIncludeCountriesFilter } from "./utils/country-filter";
export { getMapStyleType, getColorScheme } from "./components/Map/utils";

// Data
export { countries } from "./data/countries";

// Styles
import "maplibre-gl/dist/maplibre-gl.css";

// Legacy exports - deprecated, use components from AddressFormReact instead
export { AddressForm as __AddressForm, AddressFormMap as __AddressFormMap } from "./components/AddressForm";
export {
  defaultAddressFormFields as __defaultAddressFormFields,
  FormFieldID as __FormFieldID,
} from "./components/AddressForm/form-field";
export type {
  AddressFormProps as __AddressFormProps,
  AddressFormMapProps as __AddressFormMapProps,
  AddressFormField as __AddressFormField,
  AddressFormData as __AddressFormData,
} from "./components/AddressForm";
