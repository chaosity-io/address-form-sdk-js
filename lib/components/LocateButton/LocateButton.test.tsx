import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProvider } from "../../test/utils";
import * as api from "../../utils/api";
import { LocateButton } from "./index";

vi.mock("../../utils/api", () => ({
  suggest: vi.fn(),
  getPlace: vi.fn(),
}));

vi.mock("../../icons/Locate", () => ({
  Locate: () => <div data-testid="locate-icon">Locate Icon</div>,
}));

describe("LocateButton Component", () => {
  const mockProps = {
    onLocate: vi.fn(),
  };

  const mockGeolocation = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };

  beforeEach(() => {
    Object.defineProperty(global.navigator, "geolocation", {
      value: mockGeolocation,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("renders correctly with default props", async () => {
    renderWithProvider(<LocateButton onLocate={() => {}} />);
    // Wait for async provider initialization
    await act(async () => {});
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("styleButton");
    expect(screen.getByTestId("locate-icon")).toBeInTheDocument();
  });

  it("handles click and gets current location using suggest + getPlace", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 47.6062,
          longitude: -122.3321,
        },
      });
    });

    vi.mocked(api.suggest).mockResolvedValue({
      ResultItems: [
        {
          SuggestResultItemType: "Place",
          Title: "123 Main St, Seattle, WA",
          Place: {
            PlaceId: "test-place-id",
          },
        },
      ],
      PricingBucket: "mock-pricing-bucket",
      $metadata: {},
    });

    vi.mocked(api.getPlace).mockResolvedValue({
      PlaceId: "test-place-id",
      PlaceType: "Street",
      Title: "123 Main St",
      PricingBucket: "mock-pricing-bucket",
      Address: {
        AddressNumber: "123",
        Street: "Main St",
        Country: {
          Code2: "US",
          Name: "United States",
        },
      },
      Position: [-122.3321, 47.6062],
      $metadata: {},
    });

    renderWithProvider(<LocateButton {...mockProps} />);
    // Wait for async provider initialization
    await act(async () => {});

    const button = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
      expect(api.suggest).toHaveBeenCalledWith(expect.any(Object), {
        QueryText: "47.6062,-122.3321",
        BiasPosition: [-122.3321, 47.6062],
        MaxResults: 1,
      });
      expect(api.getPlace).toHaveBeenCalledWith(expect.any(Object), {
        PlaceId: "test-place-id",
      });
      expect(mockProps.onLocate).toHaveBeenCalledWith({
        placeId: "test-place-id",
        addressLineOneField: "123 Main St",
        fullAddress: {
          AddressNumber: "123",
          Street: "Main St",
          Country: {
            Code2: "US",
            Name: "United States",
          },
        },
        position: [-122.3321, 47.6062],
      });
    });
  });
});
