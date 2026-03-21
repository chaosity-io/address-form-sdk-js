import clsx from "clsx";
import type { FunctionComponent } from "react";
import type { ButtonProps } from "../../Button";
import { Button } from "../../Button";
import { root } from "./styles.css";

export const AdjustButton: FunctionComponent<Omit<ButtonProps, "variant">> = ({ className, ...props }) => {
  return <Button variant="primary" className={clsx(root, className)} {...props} />;
};
