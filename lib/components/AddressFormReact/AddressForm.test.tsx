import { fireEvent, waitFor, screen, act } from "@testing-library/react";
import { useContext, useEffect } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProvider } from "../../test/utils";
import { AddressForm } from "./AddressForm";
import { AddressFormContext, AddressFormContextType, useAddressFormContext } from "./AddressFormContext";
import { GeoPlacesClient, GetPlaceIntendedUse } from "@chaosity/location-client";
import * as api from "../../utils/api";
import { useNotificationStore } from "../../stores/notificationStore";

vi.mock("../../utils/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/api")>();
  return { ...actual, getPlace: vi.fn() };
});

const mockContextValue: AddressFormContextType = {
  data: {},
  setData: vi.fn(),
  setMapViewState: vi.fn(),
  isAutofill: false,
  setIsAutofill: vi.fn(),
  typeaheadApiName: "autocomplete",
  setTypeaheadApiName: vi.fn(),
};

const renderWithContext = (ui: React.ReactElement) => {
  return renderWithProvider(<AddressFormContext.Provider value={mockContextValue}>{ui}</AddressFormContext.Provider>);
};

describe("AddressForm", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearNotifications();
  });

  it("renders form element", () => {
    renderWithContext(
      <AddressForm>
        <div />
      </AddressForm>,
    );
    expect(document.querySelector("form")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    renderWithContext(
      <AddressForm className="custom">
        <div />
      </AddressForm>,
    );
    expect(document.querySelector("form")).toHaveClass("custom");
  });

  it("renders child components", () => {
    renderWithContext(
      <AddressForm>
        <input data-type="address-form" name="city" />
        <button data-type="address-form" type="submit" />
      </AddressForm>,
    );
    expect(document.querySelector("input")).toBeInTheDocument();
    expect(document.querySelector("button")).toBeInTheDocument();
  });

  it("provides context value", () => {
    const TestComponent = () => {
      const context = useContext(AddressFormContext);
      return <div data-testid="context">{context ? "has-context" : "no-context"}</div>;
    };

    renderWithContext(
      <AddressForm>
        <TestComponent />
      </AddressForm>,
    );
    expect(document.querySelector('[data-testid="context"]')).toHaveTextContent("has-context");
  });

  it("resets form data when Reset button is clicked", () => {
    const { getByLabelText, getByRole } = renderWithProvider(
      <AddressForm>
        <input data-type="address-form" name="addressLineTwo" />
        <input data-type="address-form" name="city" />
        <input data-type="address-form" name="province" />
        <input data-type="address-form" name="postalCode" />
        <button data-type="address-form" type="reset">
          Reset
        </button>
      </AddressForm>,
    );

    const addressLineTwo = getByLabelText("Address Line 2");
    const city = getByLabelText("City");
    const province = getByLabelText("Province/State");
    const postalCode = getByLabelText("Postal/Zip code");
    const resetButton = getByRole("button", { name: "Reset" });

    // Populate all form fields with data
    fireEvent.change(addressLineTwo, { target: { value: "Apartment 456" } });
    fireEvent.change(city, { target: { value: "Vancouver" } });
    fireEvent.change(province, { target: { value: "BC" } });
    fireEvent.change(postalCode, { target: { value: "V6B 1Z6" } });

    // Verify all fields have data
    expect(addressLineTwo).toHaveValue("Apartment 456");
    expect(city).toHaveValue("Vancouver");
    expect(province).toHaveValue("BC");
    expect(postalCode).toHaveValue("V6B 1Z6");

    // Click reset button
    fireEvent.click(resetButton);

    // Verify all fields are cleared
    expect(addressLineTwo).toHaveValue("");
    expect(city).toHaveValue("");
    expect(province).toHaveValue("");
    expect(postalCode).toHaveValue("");
  });

  it("calls getPlace with STORAGE intendedUse when getData is called with STORAGE", async () => {
    const mockOnSubmit = vi.fn();

    const TestForm = () => {
      const { setData } = useAddressFormContext();

      useEffect(() => {
        setData({ placeId: "test-place-id" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return (
        <button data-type="address-form" type="submit">
          Submit
        </button>
      );
    };

    const { getByRole } = renderWithProvider(
      <AddressForm onSubmit={mockOnSubmit}>
        <TestForm />
      </AddressForm>,
    );

    // Wait for LocationClientProvider async init so client is available
    await act(async () => {});

    fireEvent.click(getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    const getData = mockOnSubmit.mock.calls[0][0];
    const data = await getData({ intendedUse: GetPlaceIntendedUse.STORAGE });

    expect(data).toEqual({ placeId: "test-place-id" });
    expect(api.getPlace).toHaveBeenCalledWith(expect.any(GeoPlacesClient), {
      PlaceId: "test-place-id",
      IntendedUse: GetPlaceIntendedUse.STORAGE,
    });
  });

  it("does not call getPlace when getData is called without STORAGE intendedUse", async () => {
    vi.clearAllMocks();
    const mockOnSubmit = vi.fn();

    const TestForm = () => {
      const { setData } = useAddressFormContext();

      useEffect(() => {
        setData({ placeId: "test-place-id" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return (
        <button data-type="address-form" type="submit">
          Submit
        </button>
      );
    };

    const { getByRole } = renderWithProvider(
      <AddressForm onSubmit={mockOnSubmit}>
        <TestForm />
      </AddressForm>,
    );

    fireEvent.click(getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    const getData = mockOnSubmit.mock.calls[0][0];
    const data = await getData({ intendedUse: GetPlaceIntendedUse.SINGLE_USE });

    expect(data).toEqual({ placeId: "test-place-id" });
    expect(api.getPlace).not.toHaveBeenCalled();
  });

  it("displays notification message when added to store", async () => {
    renderWithProvider(
      <AddressForm>
        <div />
      </AddressForm>,
    );

    act(() => {
      useNotificationStore.getState().addNotification({
        message: "Test notification message",
        type: "error",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Test notification message")).toBeInTheDocument();
    });
  });
});
