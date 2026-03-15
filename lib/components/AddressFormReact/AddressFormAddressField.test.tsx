import { fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProvider } from "../../test/utils";
import * as api from "../../utils/api";
import { AddressFormAddressField } from "./AddressFormAddressField";
import { AddressFormContext, AddressFormContextType } from "./AddressFormContext";

// Mock the autocomplete, getPlace, and suggest functions
vi.mock("../../utils/api", () => ({
  autocomplete: vi.fn(),
  suggest: vi.fn(),
  getPlace: vi.fn(),
}));

const mockSetData = vi.fn();
const mockSetMapViewState = vi.fn();

const mockContextValue: AddressFormContextType = {
  data: { addressLineOne: "123 Main St", country: "US" },
  setData: mockSetData,
  setMapViewState: mockSetMapViewState,
  isAutofill: false,
  setIsAutofill: vi.fn(),
  typeaheadApiName: "autocomplete",
  setTypeaheadApiName: vi.fn(),
};

describe("AddressFormAddressField", () => {
  it("renders with context value", () => {
    renderWithProvider(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormAddressField
          name="addressLineOne"
          label="Address"
          showCurrentLocation={false}
          apiName="autocomplete"
        />
      </AddressFormContext.Provider>,
    );

    expect(document.querySelector("label")).toHaveTextContent("Address");
    expect(document.querySelector("input")).toHaveValue("123 Main St");
  });

  it("applies placeholder prop", () => {
    renderWithProvider(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormAddressField
          name="addressLineOne"
          label="Address"
          showCurrentLocation={false}
          apiName="autocomplete"
          placeholder="Enter address"
        />
      </AddressFormContext.Provider>,
    );

    const input = document.querySelector("input")!;
    expect(input).toHaveAttribute("placeholder", "Enter address");
  });

  it("calls setData on change", () => {
    renderWithProvider(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormAddressField
          name="addressLineOne"
          label="Address"
          showCurrentLocation={false}
          apiName="autocomplete"
        />
      </AddressFormContext.Provider>,
    );

    const input = document.querySelector("input")!;
    fireEvent.change(input, { target: { value: "456 Oak Ave" } });
    expect(mockSetData).toHaveBeenCalledWith({ addressLineOne: "456 Oak Ave" });
  });

  it("handles empty context data", () => {
    const emptyContext = { ...mockContextValue, data: {} };
    renderWithProvider(
      <AddressFormContext.Provider value={emptyContext}>
        <AddressFormAddressField
          name="addressLineOne"
          label="Address"
          showCurrentLocation={false}
          apiName="autocomplete"
        />
      </AddressFormContext.Provider>,
    );

    const input = document.querySelector("input");
    expect(input).toHaveValue("");
  });

  it("accepts string apiName values", () => {
    renderWithProvider(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormAddressField name="addressLineOne" label="Address" showCurrentLocation={false} apiName="suggest" />
      </AddressFormContext.Provider>,
    );

    expect(document.querySelector("input")).toBeInTheDocument();
  });

  it("treats empty string apiName as null", () => {
    renderWithProvider(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormAddressField name="addressLineOne" label="Address" showCurrentLocation={false} apiName="" />
      </AddressFormContext.Provider>,
    );

    expect(document.querySelector("input")).toBeInTheDocument();
  });

  it("throws error for invalid apiName", () => {
    expect(() => {
      renderWithProvider(
        <AddressFormContext.Provider value={mockContextValue}>
          <AddressFormAddressField
            name="addressLineOne"
            label="Address"
            showCurrentLocation={false}
            apiName="invalid"
          />
        </AddressFormContext.Provider>,
      );
    }).toThrow('Invalid apiName: "invalid". Must be "autocomplete", "suggest", or null.');
  });

  it("updates context with addressDetails when typeahead result is selected", async () => {
    vi.clearAllMocks();

    // Create a real data state to capture updates
    let contextData = { addressLineOne: "test" };

    const mockSetData = vi.fn((updater) => {
      if (typeof updater === "function") {
        contextData = { ...contextData, ...updater(contextData) };
      } else {
        contextData = { ...contextData, ...updater };
      }
    });

    const mockContextValueWithRealUpdater = {
      ...mockContextValue,
      data: contextData,
      setData: mockSetData,
    };

    const mockAutocompleteResponse = {
      ResultItems: [
        {
          PlaceId: "test-place-id",
          Title: "510 W Georgia St, Vancouver, BC",
          Address: {
            Label: "510 W Georgia St, Vancouver, BC",
          },
          PlaceType: undefined,
        },
      ],
      PricingBucket: undefined,
      $metadata: {},
    };

    vi.mocked(api.autocomplete).mockResolvedValue(mockAutocompleteResponse);

    // Mock getPlace response
    const mockGetPlaceResponse = {
      Address: {
        Label: "510 W Georgia St, Vancouver, BC",
        Country: { Code2: "CA", Name: "Canada" },
        Region: { Name: "BC" },
        Locality: "Vancouver",
        PostalCode: "V6B 1Z6",
        AddressNumber: "510",
        Street: "W Georgia St",
      },
      Position: [-123.1207, 49.2827],
      PlaceId: undefined,
      PlaceType: undefined,
      Title: undefined,
      PricingBucket: undefined,
      $metadata: {},
    };
    vi.mocked(api.getPlace).mockResolvedValue(mockGetPlaceResponse);

    const { getByLabelText, getByRole } = renderWithProvider(
      <AddressFormContext.Provider value={mockContextValueWithRealUpdater}>
        <AddressFormAddressField
          name="addressLineOne"
          label="Address"
          showCurrentLocation={false}
          apiName="autocomplete"
        />
      </AddressFormContext.Provider>,
    );

    const input = getByLabelText("Address");

    // Type something to trigger API call
    await userEvent.clear(input);
    await userEvent.type(input, "510 W Georgia");

    // Wait for autocomplete to be called (with debounce)
    await waitFor(() => {
      expect(api.autocomplete).toHaveBeenCalled();
    });

    // Wait for and click the first option
    const firstOption = await waitFor(() => getByRole("option", { name: /510 W Georgia St, Vancouver, BC/ }));
    await userEvent.click(firstOption);

    // Verify getPlace was called with the correct PlaceId
    await waitFor(() => {
      expect(api.getPlace).toHaveBeenCalledWith(
        expect.any(Object), // client
        expect.objectContaining({ PlaceId: "test-place-id" }),
      );
    });

    // Verify context was updated with address data including addressDetails
    await waitFor(() => {
      expect(mockSetData).toHaveBeenCalledWith(
        expect.objectContaining({
          addressLineOne: "510 W Georgia St",
          city: "Vancouver",
          postalCode: "V6B 1Z6",
          province: "BC",
          country: "CA",
          originalPosition: "-123.1207,49.2827",
          addressDetails: mockGetPlaceResponse.Address,
        }),
      );
    });
  });

  it("updates context with addressDetails when locate button is clicked", async () => {
    vi.clearAllMocks();

    // Mock geolocation
    const mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(global.navigator, "geolocation", {
      value: mockGeolocation,
      configurable: true,
    });

    // Create a real data state to capture updates
    let contextData = { addressLineOne: "" };

    const mockSetData = vi.fn((updater) => {
      if (typeof updater === "function") {
        contextData = { ...contextData, ...updater(contextData) };
      } else {
        contextData = { ...contextData, ...updater };
      }
    });

    const mockContextValueWithRealUpdater = {
      ...mockContextValue,
      data: contextData,
      setData: mockSetData,
    };

    // Mock suggest response (used by LocateButton for coordinate lookup)
    vi.mocked(api.suggest).mockResolvedValue({
      ResultItems: [
        {
          SuggestResultItemType: "Place",
          Title: "510 W Georgia St, Vancouver, BC",
          Place: { PlaceId: "locate-place-id" },
        },
      ],
      PricingBucket: "mock-pricing-bucket",
      $metadata: {},
    });

    // Mock getPlace response
    vi.mocked(api.getPlace).mockResolvedValue({
      PlaceId: "locate-place-id",
      PlaceType: "Street",
      Title: "510 W Georgia St",
      PricingBucket: "mock-pricing-bucket",
      Address: {
        Label: "510 W Georgia St, Vancouver, BC",
        Country: { Code2: "CA", Name: "Canada" },
        Region: { Name: "BC" },
        Locality: "Vancouver",
        PostalCode: "V6B 1Z6",
        AddressNumber: "510",
        Street: "W Georgia St",
      },
      Position: [-123.1207, 49.2827],
      $metadata: {},
    });

    // Mock getCurrentPosition to return coordinates
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 49.2827,
          longitude: -123.1207,
        },
      });
    });

    const { getByRole } = renderWithProvider(
      <AddressFormContext.Provider value={mockContextValueWithRealUpdater}>
        <AddressFormAddressField
          name="addressLineOne"
          label="Address"
          showCurrentLocation={true}
          apiName="autocomplete"
        />
      </AddressFormContext.Provider>,
    );

    // Click the locate button
    const locateButton = getByRole("button");
    await userEvent.click(locateButton);

    // Verify getCurrentPosition was called
    await waitFor(() => {
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    });

    // Verify suggest was called with coordinates
    await waitFor(() => {
      expect(api.suggest).toHaveBeenCalledWith(
        expect.any(Object), // client
        expect.objectContaining({
          BiasPosition: [-123.1207, 49.2827],
          MaxResults: 1,
        }),
      );
    });

    // Verify getPlace was called with the place ID from suggest
    await waitFor(() => {
      expect(api.getPlace).toHaveBeenCalledWith(
        expect.any(Object), // client
        expect.objectContaining({ PlaceId: "locate-place-id" }),
      );
    });

    // Verify context was updated with address data including addressDetails
    await waitFor(() => {
      expect(mockSetData).toHaveBeenCalledWith(
        expect.objectContaining({
          addressLineOne: "510 W Georgia St",
          city: "Vancouver",
          postalCode: "V6B 1Z6",
          province: "BC",
          country: "CA",
          originalPosition: "-123.1207,49.2827",
        }),
      );
    });
  });
});
