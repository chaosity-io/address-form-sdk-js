import type { Address, AutocompleteFilterPlaceType, VerifyAddressResponse } from "@chaosity/location-client";
import { type RelatedPlace } from "@chaosity/location-client";
import clsx from "clsx";
import type { ComponentProps, FormEventHandler, FunctionComponent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NotificationContainer } from "../Notification";
import type { AddressFormAddressFieldProps } from "./AddressFormAddressField";
import { AddressFormAddressField } from "./AddressFormAddressField";
import { AddressFormAutofillHandler } from "./AddressFormAutofillHandler";
import { useAddressFormContext } from "./AddressFormContext";
import type { AddressFormCountryFieldProps } from "./AddressFormCountryField";
import { AddressFormCountryField } from "./AddressFormCountryField";
import { AddressFormFields } from "./AddressFormFields";
import type { AddressFormMapProps } from "./AddressFormMap";
import { AddressFormMap } from "./AddressFormMap";
import { AddressFormProvider } from "./AddressFormProvider";
import type { AddressFormTextFieldProps } from "./AddressFormTextField";
import { AddressFormTextField } from "./AddressFormTextField";
import * as styles from "./styles.css";
import { useGetData } from "./use-get-data";

export interface AddressFormData {
  /** The PlaceId of the last pick. Not cleared when the fields are edited afterwards. */
  placeId?: string;
  addressLineOne?: string;
  addressLineTwo?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  originalPosition?: string;
  adjustedPosition?: string;
  addressDetails?: Address;
  secondaryAddresses?: RelatedPlace[];
  /**
   * With `verify` on: whether the service verified the chosen PlaceId (#21).
   * Absent when there was nothing to verify — no pick, or a picked field
   * edited by hand since.
   */
  verified?: boolean;
  /**
   * With `verify` on: the service's whole answer — the place record plus
   * `verified`. The one Places result you may store, except a place in Japan.
   */
  verification?: VerifyAddressResponse;
}

export interface AddressFormProps extends AddressFormContentProps {
  /**
   * Resolve the chosen PlaceId through `POST /address/verify` when `getData()`
   * is called, so it returns `verified` and a result you may store (#21). Off by
   * default: each verification is billed, whether or not the address verifies.
   * Needs @chaosity/location-client 0.10.0 or later.
   */
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

interface ChildComponents {
  AddressField: FunctionComponent<AddressFormAddressFieldProps>;
  CountryField: FunctionComponent<AddressFormCountryFieldProps>;
  Map: FunctionComponent<AddressFormMapProps>;
  TextField: FunctionComponent<AddressFormTextFieldProps>;
}

export const AddressForm: FunctionComponent<AddressFormProps> & ChildComponents = ({
  children,
  verify,
  language,
  politicalView,
  showCurrentCountryResultsOnly,
  allowedCountries,
  placeTypes,
  initialMapCenter,
  initialMapZoom,
  ...contentProps
}) => {
  return (
    <AddressFormProvider
      verify={verify}
      language={language}
      politicalView={politicalView}
      showCurrentCountryResultsOnly={showCurrentCountryResultsOnly}
      allowedCountries={allowedCountries}
      placeTypes={placeTypes}
      initialMapCenter={initialMapCenter}
      initialMapZoom={initialMapZoom}
    >
      <AddressFormContent {...contentProps}>{children}</AddressFormContent>
    </AddressFormProvider>
  );
};

export type SubmitHandler = (getData: () => Promise<AddressFormData>) => void;

interface AddressFormContentProps extends Omit<ComponentProps<"form">, "onSubmit"> {
  onSubmit?: SubmitHandler;
  className?: string;
  children: ReactNode;
}

const AddressFormContent: FunctionComponent<AddressFormContentProps> = ({ children, className, onSubmit, ...rest }) => {
  const { resetData } = useAddressFormContext();
  const getData = useGetData();
  const formRef = useRef<HTMLFormElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit: FormEventHandler = (event) => {
    event.preventDefault();

    // Deliberately no second GetPlace. One used to be issued here with
    // IntendedUse: "Storage", but IntendedUse is one of the parameters the
    // Location Service never forwards, so that call returned byte-identical
    // data, granted no storage rights, and billed the customer a second time.
    // Do not reintroduce it (#13). The storable path is `verify` (#21), and it
    // calls only when the integrator asks for the data.
    onSubmit?.(getData);
  };

  return (
    <form ref={formRef} className={clsx(styles.root, className)} {...rest} onSubmit={handleSubmit} onReset={resetData}>
      <NotificationContainer />
      {isMounted && formRef.current && <AddressFormAutofillHandler form={formRef.current} />}
      <AddressFormFields>{children}</AddressFormFields>
    </form>
  );
};

AddressForm.AddressField = AddressFormAddressField;
AddressForm.CountryField = AddressFormCountryField;
AddressForm.Map = AddressFormMap;
AddressForm.TextField = AddressFormTextField;
