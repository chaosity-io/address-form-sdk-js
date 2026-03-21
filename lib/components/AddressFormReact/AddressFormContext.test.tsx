import { render } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AddressFormContextType } from "./AddressFormContext";
import { AddressFormContext } from "./AddressFormContext";

describe("AddressFormContext", () => {
  it("provides undefined by default", () => {
    let contextValue: AddressFormContextType | undefined;

    const TestComponent = () => {
      contextValue = useContext(AddressFormContext);
      return null;
    };

    render(<TestComponent />);
    expect(contextValue).toBeUndefined();
  });

  it("provides context value when wrapped", () => {
    const mockValue: AddressFormContextType = {
      data: { city: "Seattle" },
      setData: vi.fn(),
      setMapViewState: vi.fn(),
      isAutofill: false,
      setIsAutofill: vi.fn(),
      typeaheadApiName: "autocomplete",
      setTypeaheadApiName: vi.fn(),
    };

    let contextValue: AddressFormContextType | undefined;

    const TestComponent = () => {
      contextValue = useContext(AddressFormContext);
      return null;
    };

    render(
      <AddressFormContext.Provider value={mockValue}>
        <TestComponent />
      </AddressFormContext.Provider>,
    );

    expect(contextValue).toEqual(mockValue);
  });
});
