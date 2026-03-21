import type { AddressFormField } from ".";

export const FormFieldID = {
  ADDRESS_LINE_ONE: "aws-address-line-one",
  ADDRESS_LINE_TWO: "aws-address-line-two",
  CITY: "aws-city",
  PROVINCE: "aws-province",
  POSTAL_CODE: "aws-postal-code",
  COUNTRY: "aws-country",
  ADJUSTED_POSITION: "aws-adjusted-position",
} as const;

export type FormFieldID = (typeof FormFieldID)[keyof typeof FormFieldID];

export const defaultAddressFormFields: AddressFormField[] = [
  {
    id: FormFieldID.ADDRESS_LINE_ONE,
    name: "addressLineOne",
    label: "Address",
    placeholder: "Enter address",
  },
  {
    id: FormFieldID.ADDRESS_LINE_TWO,
    name: "addressLineTwo",
    label: "Address Line 2",
    placeholder: "Apartment, suite, etc.",
  },
  {
    id: FormFieldID.CITY,
    name: "city",
    label: "City",
  },
  {
    id: FormFieldID.PROVINCE,
    name: "province",
    label: "Province/State",
  },
  {
    id: FormFieldID.POSTAL_CODE,
    name: "postalCode",
    label: "Postal/Zip code",
  },
  {
    id: FormFieldID.COUNTRY,
    name: "country",
    label: "Country",
  },
];
