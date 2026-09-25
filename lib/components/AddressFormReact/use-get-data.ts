import type { VerifyAddressResponse } from "@chaosity/location-client";
import { useLocationClient } from "@chaosity/location-client-react";
import { useCallback, useRef } from "react";
import { verifyAddress } from "../../utils/api";
import type { AddressFormData } from "./AddressForm";
import { useAddressFormContext } from "./AddressFormContext";

/**
 * The fields a pick fills in that a person can then change by hand (#21).
 *
 * Address line two is not one of them: it is the free "Apartment, suite, etc."
 * line, which a pick of an address leaves empty. A unit is verified by picking
 * it from the building's unit list, not by typing it there.
 */
const PICKED_FIELDS = ["addressLineOne", "city", "province", "postalCode", "country"] as const;

export type PickedFields = Pick<AddressFormData, (typeof PICKED_FIELDS)[number]>;

/** The picked fields as they stand in `data`. */
export const pickedFields = (data: AddressFormData): PickedFields =>
  Object.fromEntries(PICKED_FIELDS.map((field) => [field, data[field]])) as PickedFields;

/**
 * Whether the form still reads what the pick filled in, so the PlaceId still
 * describes what is being submitted. Compared as text, trimmed: the typeahead
 * pads the address line with a space for a moment after a selection.
 */
const matchesPick = (data: AddressFormData, pick: PickedFields | undefined): boolean =>
  !!pick && PICKED_FIELDS.every((field) => (data[field] ?? "").trim() === (pick[field] ?? "").trim());

/**
 * The `getData` a submit hands to `onSubmit` (#21): the form as it stood at
 * that submit, and — with `verify` on — the chosen PlaceId resolved through
 * `POST /address/verify`.
 *
 * Verified once per PlaceId for as long as the form lives. Every call is
 * billed, and a verify result may be kept, so a second submit of the same
 * selection reuses the first answer. A failure is not kept: the next submit
 * asks again.
 *
 * No PlaceId, or picked fields edited since the pick, means no call and no
 * `verified`: there is nothing the service could verify that describes this
 * submission. A failed verify rejects `getData`, after `verifyAddress` has put
 * it in the form's notification banner.
 */
export const useGetData = (): (() => Promise<AddressFormData>) => {
  const { data, pick, verify } = useAddressFormContext();
  const { client } = useLocationClient();
  const verifications = useRef(new Map<string, Promise<VerifyAddressResponse>>()).current;

  return useCallback(async () => {
    const { placeId } = data;
    if (!verify || !placeId || !matchesPick(data, pick)) return data;

    // A PlaceId is only ever written by a pick or by autofill's resolution,
    // and both needed the client.
    if (!client) throw new Error("Address verification needs the location client, which is not available.");

    let answer = verifications.get(placeId);
    if (!answer) {
      answer = verifyAddress(client, placeId);
      verifications.set(placeId, answer);
      const kept = answer;
      kept.catch(() => {
        if (verifications.get(placeId) === kept) verifications.delete(placeId);
      });
    }

    const verification = await answer;
    return { ...data, verified: verification.verified, verification };
  }, [data, pick, verify, client, verifications]);
};
