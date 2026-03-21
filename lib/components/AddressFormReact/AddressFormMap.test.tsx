import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AddressFormContextType } from "./AddressFormContext";
import { AddressFormContext } from "./AddressFormContext";
import { AddressFormMap } from "./AddressFormMap";

vi.mock("../Map", () => ({
  Map: vi.fn(({ children, mapStyle, ...props }) => (
    <div data-testid="mock-map" data-map-style={mapStyle?.toString()} {...props}>
      {children}
    </div>
  )),
}));

vi.mock("../MapMarker", () => ({
  MapMarker: vi.fn((props) => (
    <div
      data-testid="mock-map-marker"
      data-marker-position={props.markerPosition?.toString()}
      data-adjustable-position={props.adjustablePosition?.toString()}
    />
  )),
}));

const mockContextValue: AddressFormContextType = {
  data: { city: "Seattle" },
  setData: vi.fn(),
  setMapViewState: vi.fn(),
  isAutofill: false,
  setIsAutofill: vi.fn(),
  typeaheadApiName: "autocomplete",
  setTypeaheadApiName: vi.fn(),
};

describe("AddressFormMap", () => {
  it("renders Map component with MapMarker", () => {
    render(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormMap mapStyle={["Standard", "Light"]} />
      </AddressFormContext.Provider>,
    );

    expect(screen.getByTestId("mock-map")).toBeInTheDocument();
    expect(screen.getByTestId("mock-map-marker")).toBeInTheDocument();
  });

  it("passes mapStyle to Map component", () => {
    render(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormMap mapStyle={["Standard", "Dark"]} />
      </AddressFormContext.Provider>,
    );

    const mapElement = screen.getByTestId("mock-map");
    expect(mapElement).toHaveAttribute("data-map-style", "Standard,Dark");
  });
});
