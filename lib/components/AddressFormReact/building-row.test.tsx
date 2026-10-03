import type { AutocompleteCommandOutput, GetPlaceCommandOutput } from "@chaosity/location-client";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProvider, untilClient } from "../../test/utils";
import * as api from "../../utils/api";
import { AddressForm, type AddressFormData } from "./AddressForm";
import { useAddressFormContext } from "./AddressFormContext";

/**
 * A place that lists units can itself be picked (#32).
 *
 * Picking a suggestion whose GetPlace lists `SecondaryAddresses` expands the
 * list into its units, and the building's own row was rendered `disabled`:
 * a business at the building's address could only pick a unit it does not
 * occupy, or leave, with city and postcode unfilled and nothing to verify.
 * The row now completes with the output already built for the building.
 */

vi.mock("../../utils/api", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("../../utils/api")>();
  return { ...actual, autocomplete: vi.fn(), getPlace: vi.fn() };
});

vi.mock("../../utils/debounce", () => ({
  useDebounce: (value: string) => value,
}));

const SUGGESTION: AutocompleteCommandOutput = {
  ResultItems: [
    {
      PlaceId: "building-id",
      Address: { Label: "100 George St, The Rocks NSW 2000, Australia" },
      PlaceType: "PointAddress",
      Title: "100 George St, The Rocks NSW 2000, Australia",
    },
  ],
  PricingBucket: "bucket1",
  $metadata: {},
};

const BUILDING: GetPlaceCommandOutput = {
  PlaceId: "building-id",
  PlaceType: "PointAddress",
  Title: "100 George St, The Rocks NSW 2000, Australia",
  Address: {
    Label: "100 George St, The Rocks NSW 2000, Australia",
    Country: { Code2: "AU", Name: "Australia" },
    Region: { Name: "New South Wales" },
    Locality: "The Rocks",
    PostalCode: "2000",
    AddressNumber: "100",
    Street: "George St",
  },
  Position: [151.2084, -33.8587],
  SecondaryAddresses: [
    { PlaceId: "unit-id", PlaceType: "SecondaryAddress", Title: "1/100 George St, The Rocks NSW 2000, Australia" },
  ],
  PricingBucket: "bucket1",
  $metadata: {},
};

let lastData: AddressFormData = {};
const Spy = () => {
  lastData = useAddressFormContext().data;
  return null;
};

const renderForm = () =>
  renderWithProvider(
    <AddressForm>
      <input data-type="address-form" name="addressLineOne" data-api-name="autocomplete" aria-label="Address" />
      <input data-type="address-form" name="city" aria-label="City" />
      <input data-type="address-form" name="postalCode" aria-label="Postal code" />
      <Spy />
    </AddressForm>,
  );

/** Type, pick the suggestion, and wait for the building's units to show. */
const expandBuilding = async () => {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "100 George St" } });
  const suggestion = await screen.findByRole("option", { name: SUGGESTION.ResultItems![0].Title });
  await userEvent.click(suggestion);
  await screen.findByText("Back to results");
};

/** The building's own row: the first result row once the list is expanded. */
const buildingRow = () => document.querySelector<HTMLElement>(".aws-typeahead-results__option")!;

describe("the building's own row completes the selection (#32)", () => {
  beforeEach(() => {
    lastData = {};
    vi.mocked(api.autocomplete).mockReset().mockResolvedValue(SUGGESTION);
    vi.mocked(api.getPlace).mockReset().mockResolvedValue(BUILDING);
  });

  const expectBuildingPicked = async () => {
    await waitFor(() => expect(screen.queryByText("Back to results")).toBeNull());
    expect(lastData.placeId).toBe("building-id");
    expect(within(document.body).getByLabelText("City")).toHaveValue("The Rocks");
    expect(within(document.body).getByLabelText("Postal code")).toHaveValue("2000");
    // The building was looked up once, to expand it; picking it asks nothing more.
    expect(api.getPlace).toHaveBeenCalledTimes(1);
  };

  it("by click", async () => {
    renderForm();
    await untilClient();
    await expandBuilding();

    expect(buildingRow()).not.toHaveAttribute("aria-disabled", "true");
    await userEvent.click(buildingRow());

    await expectBuildingPicked();
  });

  it("by keyboard", async () => {
    renderForm();
    await untilClient();
    await expandBuilding();

    const input = screen.getByRole("combobox");
    act(() => input.focus());
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(buildingRow()).toHaveAttribute("data-focus"));
    await userEvent.keyboard("{Enter}");

    await expectBuildingPicked();
  });

  it("still lets a unit be picked", async () => {
    vi.mocked(api.getPlace).mockImplementation(async (_client, input) =>
      input.PlaceId === "unit-id"
        ? { ...BUILDING, PlaceId: "unit-id", SecondaryAddresses: undefined, Title: "1/100 George St" }
        : BUILDING,
    );
    renderForm();
    await untilClient();
    await expandBuilding();

    await userEvent.click(screen.getByRole("option", { name: "1/100 George St, The Rocks NSW 2000, Australia" }));

    await waitFor(() => expect(lastData.placeId).toBe("unit-id"));
  });
});
