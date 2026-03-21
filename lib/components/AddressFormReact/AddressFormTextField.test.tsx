import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AddressFormContextType } from "./AddressFormContext";
import { AddressFormContext } from "./AddressFormContext";
import { AddressFormTextField } from "./AddressFormTextField";

const mockSetData = vi.fn();
const mockSetMapViewState = vi.fn();

const mockContextValue: AddressFormContextType = {
  data: { city: "Seattle" },
  setData: mockSetData,
  setMapViewState: mockSetMapViewState,
  isAutofill: false,
  setIsAutofill: vi.fn(),
  typeaheadApiName: "autocomplete",
  setTypeaheadApiName: vi.fn(),
};

describe("AddressFormTextField", () => {
  it("renders input with context value", () => {
    render(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormTextField name="city" label="City" />
      </AddressFormContext.Provider>,
    );

    const input = document.querySelector("input");
    expect(input).toHaveValue("Seattle");
  });

  it("calls setData on change", () => {
    render(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormTextField name="city" label="City" />
      </AddressFormContext.Provider>,
    );

    const input = document.querySelector("input")!;
    fireEvent.change(input, { target: { value: "Portland" } });
    expect(mockSetData).toHaveBeenCalledWith({ city: "Portland" });
  });

  it("uses label when provided", () => {
    render(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormTextField name="city" label="Custom Label" />
      </AddressFormContext.Provider>,
    );

    expect(document.querySelector("label")).toHaveTextContent("Custom Label");
  });

  it("handles empty context data", () => {
    const emptyContext = { ...mockContextValue, data: {} };
    render(
      <AddressFormContext.Provider value={emptyContext}>
        <AddressFormTextField name="city" label="City" />
      </AddressFormContext.Provider>,
    );

    const input = document.querySelector("input");
    expect(input).toHaveValue("");
  });
});
