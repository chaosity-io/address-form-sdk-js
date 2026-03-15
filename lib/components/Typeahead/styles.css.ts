import { style } from "@vanilla-extract/css";

export const base = style({
  position: "relative",
});

export const input = style({
  width: "100%",
  paddingRight: "2rem",
  boxSizing: "border-box",
});

export const option = style({
  padding: "0.5rem 0.75rem",
  fontSize: "0.8rem",

  selectors: {
    '&[data-headlessui-state~="active"]': {
      cursor: "pointer",
      backgroundColor: "#eaeaea",
    },
  },
});

export const info = style({
  padding: "0.5rem 0.75rem",
  fontSize: "0.75rem",
  fontWeight: "bold",
});

export const options = style({
  width: "calc(var(--input-width) - 1px)",
  border: "0.1px solid black",
  backgroundColor: "white",
  zIndex: 999,
  maxHeight: "250px !important",
});

export const currentLocation = style({
  position: "absolute",
  right: "0.5rem",
  top: "0.55rem",
});

export const brandOption = style({
  textAlign: "right",
  padding: "0.5rem 0.75rem",
  fontSize: "0.7rem",
  fontWeight: "bold",
});

export const brandOptionLink = style({
  textDecoration: "none",
  color: "gray",
});

export const expandIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.25rem",
  height: "1.25rem",
  borderRadius: "50%",
  backgroundColor: "#e5e7eb",
  color: "#374151",
  fontSize: "0.75rem",
  fontWeight: "bold",
  flexShrink: 0,
  lineHeight: 1,
  marginLeft: "auto",

  selectors: {
    '[data-headlessui-state~="active"] &': {
      backgroundColor: "#d1d5db",
    },
  },
});

export const optionRow = style({
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
});

export const optionLabel = style({
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const secondaryOption = style({
  padding: "0.4rem 0.75rem 0.4rem 1.5rem",
  fontSize: "0.75rem",
  color: "#4b5563",
  borderLeft: "2px solid #e5e7eb",
  marginLeft: "0.75rem",

  selectors: {
    '&[data-headlessui-state~="active"]': {
      cursor: "pointer",
      backgroundColor: "#f3f4f6",
    },
  },
});

export const secondaryLabel = style({
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
});

export const backOption = style({
  padding: "0.4rem 0.75rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#6b7280",
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",

  selectors: {
    '&[data-headlessui-state~="active"]': {
      cursor: "pointer",
      backgroundColor: "#f3f4f6",
    },
  },
});
