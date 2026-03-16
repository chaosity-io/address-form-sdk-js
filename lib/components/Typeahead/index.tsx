import {
  Address,
  GetPlaceAdditionalFeature,
  type GetPlaceCommandOutput,
  type RelatedPlace,
} from "@chaosity/location-client";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import useAmazonLocationContext from "../../hooks/use-amazon-location-context.ts";
import { useDebounce } from "../../utils/debounce.ts";
import { getPlaceQuery } from "../../utils/queries.ts";
import { Input } from "../Input/index.tsx";
import { LocateButton } from "../LocateButton";
import {
  backOption,
  base,
  brandOption,
  brandOptionLink,
  currentLocation,
  info,
  input,
  option,
  optionLabel,
  optionRow,
  options,
  secondaryLabel,
  secondaryOption,
} from "./styles.css.ts";
import { TypeaheadAPIInput, TypeaheadAPIName, TypeaheadResultItem, useTypeaheadQuery } from "./use-typeahead-query.ts";
import { countries } from "../../data/countries.ts";

export interface TypeaheadOutput {
  placeId?: string;
  addressLineOneField?: string;
  addressLineTwoField?: string;
  fullAddress?: Address;
  position?: [number, number];
  secondaryAddresses?: RelatedPlace[];
}

export interface TypeaheadProps {
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  apiName: TypeaheadAPIName | null;
  apiInput?: TypeaheadAPIInput;
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: TypeaheadOutput) => void;
  showCurrentLocation?: boolean;
  debounce?: number;
  skipNextQuery?: boolean;
}

/** Extracts unit/suite designator from SecondaryAddressComponents (e.g. "Apt 4B") */
const getSecondaryDesignator = (result: GetPlaceCommandOutput): string | undefined => {
  const components = result.Address?.SecondaryAddressComponents;
  if (components && components.length > 0) {
    return components
      .map((c) => c.Number)
      .filter(Boolean)
      .join(", ");
  }
  return undefined;
};

/** Builds TypeaheadOutput from a GetPlace result */
const buildOutput = (result: GetPlaceCommandOutput, fallbackTitle: string): TypeaheadOutput => {
  const [lng, lat] = result.Position ?? [];
  const matchedCountry = countries.find((c) => c.code === result.Address?.Country?.Code2);
  const addressLineOneFallback = result.Address?.Label || fallbackTitle;

  const addressLineOneField = matchedCountry?.supported
    ? [result.Address?.AddressNumber, result.Address?.Street].filter(Boolean).join(" ") || addressLineOneFallback
    : addressLineOneFallback;

  let addressLineTwoField: string | undefined;
  if (result.PlaceType === "PointOfInterest") {
    addressLineTwoField = result.Title;
  }

  return {
    placeId: result.PlaceId,
    addressLineOneField,
    addressLineTwoField,
    fullAddress: result.Address,
    position: result.Position ? [lng, lat] : undefined,
    secondaryAddresses: result.SecondaryAddresses,
  };
};

export const Typeahead = ({ apiName, ...props }: TypeaheadProps) => {
  return apiName ? <APITypeahead {...props} apiName={apiName} /> : <InputTypeahead {...props} apiName={null} />;
};

interface ExpandedState {
  result: GetPlaceCommandOutput;
  output: TypeaheadOutput;
  title: string;
}

const APITypeahead = ({
  id,
  name,
  placeholder,
  className,
  value,
  onChange,
  apiName,
  apiInput,
  onSelect,
  showCurrentLocation = true,
  debounce = 1000,
  skipNextQuery,
}: TypeaheadProps & { apiName: TypeaheadAPIName }) => {
  const debouncedValue = useDebounce(value, debounce);
  const { client } = useAmazonLocationContext();
  const queryClient = useQueryClient();
  const isValid = debouncedValue.length >= 2;
  const skipNextQueryRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentBiasPosition = apiInput?.BiasPosition?.join(","); // Used for tracking map view changes

  // Track expanded state when an address has secondary addresses
  const [expanded, setExpanded] = useState<ExpandedState | null>(null);
  const expandedRef = useRef<ExpandedState | null>(null);
  // forceStatic keeps the dropdown visible after backing out of expanded view
  const [forceStatic, setForceStatic] = useState(false);
  const forceStaticRef = useRef(false);
  const updateExpanded = (value: ExpandedState | null) => {
    expandedRef.current = value;
    setExpanded(value);
  };

  useEffect(() => {
    if (skipNextQuery !== undefined) {
      skipNextQueryRef.current = skipNextQuery;
    }
  }, [skipNextQueryRef, skipNextQuery]);

  // Clear typeahead cache on map view change to avoid displaying stale results
  useEffect(() => {
    if (currentBiasPosition) {
      skipNextQueryRef.current = true; // Prevents API call bursts on map view changes by disabling the active query
      queryClient.invalidateQueries({ queryKey: ["typeahead"], refetchType: "none" });
    }
  }, [currentBiasPosition, queryClient]);

  const {
    data = [],
    isLoading,
    isError,
  } = useTypeaheadQuery({
    client,
    apiName,
    apiInput: { QueryText: debouncedValue, MaxResults: 5, ...apiInput },
    enabled: isValid && !skipNextQueryRef.current,
  });

  // Reset expanded state when suggestions change (user typed something new)
  useEffect(() => {
    updateExpanded(null);
  }, [data]);

  /**
   * Handles input value changes and controls typeahead query execution
   * @param value - The new input value
   * @param silent - When true, skips typeahead API calls (used for programmatic updates)
   */
  const handleChange = (value: string, silent = false) => {
    skipNextQueryRef.current = silent;
    onChange(value);
  };

  /** Completes the selection and closes the dropdown */
  const completeSelection = useCallback(
    (output: TypeaheadOutput) => {
      handleChange(output.addressLineOneField ?? "", true);
      onSelect(output);
      updateExpanded(null);
      forceStaticRef.current = false;
      setForceStatic(false);
      queryClient.removeQueries({ queryKey: ["typeahead"] });
      queryClient.removeQueries({ queryKey: ["getPlace"] });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelect, queryClient],
  );

  const handleAddressSelect = async (selected: TypeaheadResultItem | RelatedPlace | null) => {
    if (!selected) return;

    // Handle secondary address selection — get full details for the secondary place
    if ("PlaceId" in selected && expanded) {
      const secondaryResult = await queryClient.ensureQueryData(
        getPlaceQuery(client, {
          PlaceId: selected.PlaceId!,
          Language: apiInput?.Language,
          PoliticalView: apiInput?.PoliticalView,
        }),
      );
      const secondaryOutput = buildOutput(secondaryResult, selected.Title ?? expanded.title);
      // Prepend unit designator to the parent's address line one (e.g. "3/57 South Street")
      const unit = getSecondaryDesignator(secondaryResult);
      const parentAddress = expanded.output.addressLineOneField ?? "";
      secondaryOutput.addressLineOneField = unit ? `${unit}/${parentAddress}` : parentAddress;
      secondaryOutput.addressLineTwoField = undefined;
      completeSelection(secondaryOutput);
      return;
    }

    // Handle primary suggestion selection
    if ("placeId" in selected) {
      const result = await queryClient.ensureQueryData(
        getPlaceQuery(client, {
          PlaceId: selected.placeId,
          Language: apiInput?.Language,
          PoliticalView: apiInput?.PoliticalView,
          AdditionalFeatures: [GetPlaceAdditionalFeature.SECONDARY_ADDRESSES],
        }),
      );

      const output = buildOutput(result, selected.title);

      // If the place has secondary addresses, expand instead of completing
      if (result.SecondaryAddresses && result.SecondaryAddresses.length > 0) {
        updateExpanded({ result, output, title: selected.title });
        return;
      }

      completeSelection(output);
    }
  };

  useEffect(() => {
    if (value.length > 1) {
      // Remove leading space added in onClose to trigger re-render for autofilled values
      onChange(value.trimStart());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Removed: `onChange`
  }, [value]);

  const handleCurrentLocation = (address: TypeaheadOutput) => {
    handleChange(address.addressLineOneField ?? "", true);
    onSelect(address);
  };

  const keepOpen = !!expanded || forceStatic;
  const showDropdown = isValid || keepOpen;

  return (
    <div className={clsx(className, base)}>
      <Combobox
        onChange={handleAddressSelect}
        onClose={() => {
          if (expandedRef.current || forceStaticRef.current) {
            // Don't close when in expanded view or showing results after back navigation
            return;
          }
          // Reset forceStatic on natural close (blur, escape)
          forceStaticRef.current = false;
          setForceStatic(false);
          if (value) {
            // Prepend space to trigger re-render since Combobox doesn't handle autofilled values without user interaction
            onChange(` ${value}`);
          }
        }}
      >
        <ComboboxInput
          ref={inputRef}
          as={Input}
          id={id}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          className={input}
          autoComplete="off"
          onBlur={() => {
            // Natural blur clears forceStatic so dropdown hides
            forceStaticRef.current = false;
            setForceStatic(false);
          }}
        />

        {showDropdown && (
          <ComboboxOptions
            static={keepOpen}
            transition={!keepOpen}
            anchor="bottom start"
            className={clsx(options, "aws-typeahead-results")}
            data-testid={`aws-typeahead-results-${apiName}`}
            modal={false}
          >
            {expanded ? (
              <>
                {/* Back button — plain div to avoid triggering Combobox onChange/close */}
                <div
                  role="option"
                  className={clsx(backOption, "aws-typeahead-results__back")}
                  onClick={() => {
                    forceStaticRef.current = true;
                    setForceStatic(true);
                    updateExpanded(null);
                    requestAnimationFrame(() => {
                      inputRef.current?.focus();
                    });
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span aria-hidden="true">&larr;</span> Back to results
                </div>

                {/* Parent address — select without a specific unit */}
                <ComboboxOption
                  value={
                    expanded.result.SecondaryAddresses?.[0]
                      ? ({ placeId: expanded.output.placeId, title: expanded.title } as TypeaheadResultItem)
                      : null
                  }
                  className={clsx(option, "aws-typeahead-results__option")}
                  disabled
                >
                  <div className={optionRow}>
                    <span className={optionLabel}>{expanded.output.addressLineOneField}</span>
                  </div>
                </ComboboxOption>

                {/* Secondary addresses */}
                {expanded.result.SecondaryAddresses?.map((secondary) => (
                  <ComboboxOption
                    key={secondary.PlaceId}
                    value={secondary}
                    className={clsx(secondaryOption, "aws-typeahead-results__secondary")}
                  >
                    <div className={secondaryLabel}>
                      <span>{secondary.Title ?? secondary.Address?.Label ?? "Unit"}</span>
                    </div>
                  </ComboboxOption>
                ))}
              </>
            ) : (
              <>
                {isLoading && !isError && (
                  <ComboboxOption value={null} className={clsx(info, "aws-typeahead-results__loading")} disabled>
                    Loading...
                  </ComboboxOption>
                )}

                {data.length === 0 && !isLoading && !isError && (
                  <ComboboxOption value={null} className={clsx(info, "aws-typeahead-results__no-results")} disabled>
                    No results.
                  </ComboboxOption>
                )}

                {isError && (
                  <ComboboxOption value={null} className={clsx(info, "aws-typeahead-results__no-results")} disabled>
                    Unable to fetch results.
                  </ComboboxOption>
                )}

                {data.map((results) => (
                  <ComboboxOption
                    key={results.placeId}
                    value={results}
                    className={clsx(option, "aws-typeahead-results__option")}
                  >
                    {results.title}
                  </ComboboxOption>
                ))}
              </>
            )}

            <ComboboxOption value={null} className={clsx(brandOption, "aws-typeahead-results__brand")} disabled>
              <a className={brandOptionLink} href="https://chaosity.cloud" target="_blank" rel="noreferrer">
                Powered by Chaosity Location
              </a>
            </ComboboxOption>
          </ComboboxOptions>
        )}
      </Combobox>

      {showCurrentLocation && <LocateButton onLocate={handleCurrentLocation} className={currentLocation} />}
    </div>
  );
};

const InputTypeahead = ({
  id,
  name,
  placeholder,
  className,
  value,
  onChange,
  onSelect,
  showCurrentLocation = true,
}: TypeaheadProps) => {
  const handleCurrentLocation = (address: TypeaheadOutput) => {
    onChange(address.addressLineOneField ?? "");
    onSelect(address);
  };

  return (
    <div className={clsx(className, base)}>
      <Input
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={input}
        autoComplete="off"
      />

      {showCurrentLocation && <LocateButton onLocate={handleCurrentLocation} className={currentLocation} />}
    </div>
  );
};
