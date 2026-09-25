import type { GetPlaceCommandOutput } from "@chaosity/location-client";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProvider } from "../../test/utils";
import * as api from "../../utils/api";
import { LocateButton } from "../LocateButton";
import { Typeahead } from "./index";

/**
 * The PlaceId a pick yields is the one that was CHOSEN and sent, never the one
 * a GetPlace response carries (#21).
 *
 * They are not always the same. Asked for a unit by the PlaceId its building's
 * `SecondaryAddresses` lists, Amazon answers with a different, longer PlaceId —
 * and that one is accepted by no Places route: GetPlace and verify both fail
 * with an upstream internal error (measured on 25 Sep 2026). The form used to
 * record the response's PlaceId, so a unit's `placeId` could not be looked up
 * or verified. The one that was sent was just resolved, so it is known good.
 *
 * Every GetPlace below answers with a rewritten PlaceId, as Amazon does for a
 * unit, so a pick that records the response's fails here.
 */

vi.mock("../../utils/api", () => ({
  getPlace: vi.fn(),
  autocomplete: vi.fn(),
  suggest: vi.fn(),
  reverseGeocode: vi.fn(),
}));

vi.mock("../../utils/debounce", () => ({
  useDebounce: (value: string) => value,
}));

const answered = (sent: string, fields: Partial<GetPlaceCommandOutput> = {}): GetPlaceCommandOutput => ({
  PlaceId: `${sent}-as-answered`,
  PlaceType: "PointAddress",
  Title: sent,
  PricingBucket: "Core",
  Address: { Label: sent, AddressNumber: "100", Street: "Example St", Country: { Code2: "AU" } },
  Position: [151.2, -33.86],
  $metadata: {},
  ...fields,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getPlace).mockImplementation(async (_client, input) =>
    input.PlaceId === "building"
      ? answered("building", {
          SecondaryAddresses: [{ PlaceId: "unit-as-listed", PlaceType: "SecondaryAddress", Title: "1/100 Example St" }],
        })
      : answered(input.PlaceId!, {
          PlaceType: input.PlaceId === "unit-as-listed" ? "SecondaryAddress" : "PointAddress",
        }),
  );
});

const typeaheadPick = () => {
  vi.mocked(api.autocomplete).mockResolvedValue({
    ResultItems: [
      { PlaceId: "building", PlaceType: "PointAddress", Title: "100 Example St", Address: { Label: "100 Example St" } },
      { PlaceId: "house", PlaceType: "PointAddress", Title: "2 Other St", Address: { Label: "2 Other St" } },
    ],
    PricingBucket: "Core",
    $metadata: {},
  });
  const onSelect = vi.fn();
  renderWithProvider(<Typeahead apiName="autocomplete" value="Ex" onChange={() => {}} onSelect={onSelect} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Example" } });
  const pick = (name: string) =>
    userEvent.selectOptions(screen.getByRole("listbox"), screen.getByRole("option", { name }));
  return { onSelect, pick };
};

describe("a pick yields the PlaceId that was chosen", () => {
  it("a suggestion: the result item's PlaceId", async () => {
    const { onSelect, pick } = typeaheadPick();
    await screen.findByRole("option", { name: "2 Other St" });
    await pick("2 Other St");

    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(onSelect.mock.calls[0][0].placeId).toBe("house");
  });

  it("a unit: the PlaceId its building's SecondaryAddresses lists", async () => {
    const { onSelect, pick } = typeaheadPick();
    await screen.findByRole("option", { name: "100 Example St" });
    await pick("100 Example St");
    await screen.findByRole("option", { name: "1/100 Example St" });
    await pick("1/100 Example St");

    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(onSelect.mock.calls[0][0].placeId).toBe("unit-as-listed");
  });

  it("the locate button: the PlaceId it looked up", async () => {
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: -33.86, longitude: 151.2 } } as GeolocationPosition),
      },
    });
    vi.mocked(api.suggest).mockResolvedValue({
      ResultItems: [
        { SuggestResultItemType: "Place", Title: "Here", Place: { PlaceId: "located", PlaceType: "PointAddress" } },
      ],
      PricingBucket: "Core",
      $metadata: {},
    });
    const onLocate = vi.fn();
    renderWithProvider(<LocateButton onLocate={onLocate} />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onLocate).toHaveBeenCalled());
    expect(onLocate.mock.calls[0][0].placeId).toBe("located");
  });
});
