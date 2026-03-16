import { useQueryClient } from "@tanstack/react-query";
import { ComponentProps, useState } from "react";
import { Locate } from "../../icons/Locate.tsx";
import { getPlaceQuery, suggestQuery } from "../../utils/queries.ts";
import { TypeaheadOutput } from "../Typeahead/index.tsx";
import { styleButton } from "./styles.css.ts";
import useAmazonLocationContext from "../../hooks/use-amazon-location-context.ts";
import { countries } from "../../data/countries.ts";

interface LocateButtonProps extends ComponentProps<"button"> {
  onLocate: (address: TypeaheadOutput) => void;
  className?: string;
}

export function LocateButton({ onLocate, className = "", ...restProps }: LocateButtonProps) {
  const [isDisabled, setIsDisabled] = useState(false);
  const queryClient = useQueryClient();
  const { client } = useAmazonLocationContext();

  const getCurrentLocation = (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by your browser");
      setIsDisabled(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { longitude, latitude } = position.coords;

        // Use suggest with bias position to find the nearest address
        const suggestResult = await queryClient.ensureQueryData(
          suggestQuery(client, {
            QueryText: `${latitude},${longitude}`,
            BiasPosition: [longitude, latitude],
            MaxResults: 1,
          }),
        );

        const placeId = suggestResult.ResultItems?.[0]?.Place?.PlaceId;
        if (!placeId) return;

        // Get full place details
        const placeResult = await queryClient.ensureQueryData(getPlaceQuery(client, { PlaceId: placeId }));

        const matchedCountry = countries.find((c) => c.code === placeResult.Address?.Country?.Code2);
        const addressLineOneFallback = placeResult.Address?.Label || "";
        const addressLineOneField = matchedCountry?.supported
          ? [placeResult.Address?.AddressNumber, placeResult.Address?.Street].filter(Boolean).join(" ") ||
            addressLineOneFallback
          : addressLineOneFallback;

        onLocate({
          placeId: placeResult.PlaceId,
          addressLineOneField,
          fullAddress: placeResult.Address,
          position: placeResult.Position as [number, number],
        });
      },
      (err) => {
        console.error(`Error getting location: ${err.message}`);
        setIsDisabled(true);
      },
    );
  };

  return (
    <button
      onClick={getCurrentLocation}
      className={`${styleButton} ${className || ""}`}
      {...restProps}
      disabled={isDisabled}
      data-testid="aws-current-location"
    >
      <Locate />
    </button>
  );
}
