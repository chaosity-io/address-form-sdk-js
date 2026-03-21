import { memo, useId } from "react";
import { FormField } from "../FormField";
import { Input } from "../Input";
import { useAddressFormContext } from "./AddressFormContext";
import type { Field } from "./AddressFormFields";

export interface AddressFormTextFieldProps {
  name: Field;
  className?: string;
  label: string;
  placeholder?: string;
}

export const AddressFormTextField = memo(({ name, className, label, placeholder }: AddressFormTextFieldProps) => {
  const context = useAddressFormContext();
  const id = useId();

  return (
    <FormField id={id} label={label}>
      <Input
        id={id}
        name={name}
        className={className}
        placeholder={placeholder}
        value={context.data[name] ?? ""}
        onChange={(event) => context.setData({ [name]: event.target.value })}
      />
    </FormField>
  );
});
