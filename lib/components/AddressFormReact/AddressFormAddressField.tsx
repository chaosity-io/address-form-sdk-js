import { memo, useEffect, useId } from "react";
import { getIncludeCountriesFilter } from "../../utils/country-filter";
import { FormField } from "../FormField";
import type { TypeaheadOutput } from "../Typeahead";
import { Typeahead } from "../Typeahead";
import type { TypeaheadAPIName } from "../Typeahead/use-typeahead-query";
import { useAddressFormContext } from "./AddressFormContext";
import type { Field } from "./AddressFormFields";

export interface AddressFormAddressFieldProps {
  name: Field;
  label: string;
  showCurrentLocation: boolean;
  apiName: string | TypeaheadAPIName | null; // Using string so we can validate the value when using HTML form
  placeholder?: string;
  className?: string;
}

export const AddressFormAddressField = memo(
  ({ name, label, className, showCurrentLocation, apiName, placeholder }: AddressFormAddressFieldProps) => {
    const context = useAddressFormContext();
    const validatedApiName = validateApiNameProp(apiName);
    const id = useId();

    // Store API name to context since it's required for autofill detection
    useEffect(() => {
      context.setTypeaheadApiName(validatedApiName);
    }, [validatedApiName, context]);

    const handleTypeaheadSelect = (value: TypeaheadOutput) => {
      context.setData({
        placeId: value.placeId,
        addressLineOne: value.addressLineOneField,
        addressLineTwo: value.addressLineTwoField,
        city: value.fullAddress?.Locality,
        postalCode: value.fullAddress?.PostalCode,
        province: value.fullAddress?.Region?.Name,
        country: value.fullAddress?.Country?.Code2,
        originalPosition: value.position?.join(","),
        addressDetails: value.fullAddress,
        secondaryAddresses: value.secondaryAddresses,
      });

      if (value.position) {
        const [longitude, latitude] = value.position;
        context.setMapViewState({ longitude, latitude, zoom: 15 });
        context.setData({ originalPosition: [longitude, latitude].join(","), adjustedPosition: undefined });
      }
    };

    return (
      <FormField id={id} label={label}>
        <Typeahead
          id={id}
          name={name}
          placeholder={placeholder}
          className={className}
          showCurrentLocation={showCurrentLocation}
          apiName={validatedApiName}
          skipNextQuery={context.isAutofill}
          apiInput={{
            PoliticalView: context.politicalView,
            Language: context.language,
            BiasPosition: context.mapViewState
              ? [context.mapViewState.longitude, context.mapViewState.latitude]
              : undefined,
            Filter: {
              IncludePlaceTypes: context.placeTypes,
              IncludeCountries: getIncludeCountriesFilter(
                context.showCurrentCountryResultsOnly,
                context.data.country,
                context.allowedCountries,
              ),
            },
          }}
          value={context.data.addressLineOne ?? ""}
          onChange={(addressLineOne) => context.setData({ addressLineOne })}
          onSelect={handleTypeaheadSelect}
        />
      </FormField>
    );
  },
);

const validateApiNameProp = (apiName: string | TypeaheadAPIName | null): TypeaheadAPIName | null => {
  if (apiName === "" || apiName === null) return null;
  if (apiName === "autocomplete" || apiName === "suggest") return apiName;
  throw new Error(`Invalid apiName: "${apiName}". Must be "autocomplete", "suggest", or null.`);
};
