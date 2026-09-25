import type { GetPlaceCommandOutput } from "@chaosity/location-client";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationStore } from "../../stores/notificationStore";
import { renderWithProvider } from "../../test/utils";
import * as api from "../../utils/api";
import { queryClient } from "../../utils/query-client";
import type { AddressFormData } from "./AddressForm";
import { AddressForm } from "./AddressForm";
import { render } from "./render";

/**
 * The `verify` prop (#21).
 *
 * Suggestions and place details are for display only, so since 0.4.0 the form
 * gave an integrator nothing they may keep. `POST /address/verify` is the
 * storable path: with `verify` on, `getData()` resolves the chosen PlaceId
 * through it, once per PlaceId per form, because every call is billed.
 *
 * The lookups are mocked at the module boundary; the verify is NOT. It runs
 * through the real client the provider builds, so what is asserted is the
 * request that reaches `fetch` — the route and the exact body.
 */

vi.mock("../../utils/api", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("../../utils/api")>();
  return { ...actual, autocomplete: vi.fn(), suggest: vi.fn(), getPlace: vi.fn() };
});

vi.mock("../../utils/debounce", () => ({
  useDebounce: (value: string) => value,
}));

// Browser autofill is detected by a CSS animation happy-dom never runs, so the
// detection is stubbed and the test fires it with the values a browser filled.
let autofill: ((values: Record<string, string>) => void) | undefined;
vi.mock("../../utils/detect-autofill", () => ({
  detectAutofill: (_form: HTMLFormElement, callback: (values: Record<string, string>) => void) => {
    autofill = callback;
    return () => {};
  },
}));

const API = "https://test-api.chaosity.cloud";

const place = (fields: Partial<GetPlaceCommandOutput>): GetPlaceCommandOutput => ({
  PlaceId: "unset",
  PlaceType: "PointAddress",
  Title: "unset",
  PricingBucket: "Core",
  Position: [151.2, -33.86],
  $metadata: {},
  ...fields,
});

const HOUSE = place({
  PlaceId: "house-2",
  Title: "2 Other St, Sydney NSW 2000",
  Address: {
    Label: "2 Other St, Sydney NSW 2000",
    AddressNumber: "2",
    Street: "Other St",
    Locality: "Sydney",
    PostalCode: "2000",
    Region: { Name: "New South Wales" },
    Country: { Code2: "AU", Code3: "AUS", Name: "Australia" },
  },
});

const UNIT = place({
  PlaceId: "unit-1",
  PlaceType: "SecondaryAddress",
  Title: "1/100 Example St, Sydney NSW 2000",
  Address: {
    Label: "1/100 Example St, Sydney NSW 2000",
    AddressNumber: "100",
    Street: "Example St",
    Locality: "Sydney",
    PostalCode: "2000",
    Region: { Name: "New South Wales" },
    Country: { Code2: "AU", Code3: "AUS", Name: "Australia" },
    SecondaryAddressComponents: [{ Number: "1" }],
  },
});

const BUILDING = place({
  PlaceId: "building-1",
  Title: "100 Example St, Sydney NSW 2000",
  Address: { ...UNIT.Address, Label: "100 Example St, Sydney NSW 2000", SecondaryAddressComponents: undefined },
  SecondaryAddresses: [{ PlaceId: "unit-1", PlaceType: "SecondaryAddress", Title: "1/100 Example St" }],
});

const LOCALITY = place({
  PlaceId: "locality-3",
  PlaceType: "Locality",
  Title: "Sydney NSW, Australia",
  Address: { Label: "Sydney NSW, Australia", Locality: "Sydney", Country: { Code2: "AU", Name: "Australia" } },
});

const PLACES = [HOUSE, BUILDING, UNIT, LOCALITY];

/** The PlaceId GetPlace answers a unit with: not the one the building lists. */
const REWRITTEN_UNIT_ID = "unit-1-as-answered";

/** The service's answer: the record, `$metadata` stripped, plus `verified`. */
const verifyAnswer = (placeId: string) => {
  const { $metadata: _, ...record } = PLACES.find((p) => p.PlaceId === placeId)!;
  return { ...record, verified: record.PlaceType === "PointAddress" || record.PlaceType === "SecondaryAddress" };
};

let fetchMock: ReturnType<typeof vi.fn>;

/** Every request that reached the wire: only a verify can, the lookups are mocked. */
const verifies = () =>
  fetchMock.mock.calls.map((call) => {
    const [url, init] = call as [string, RequestInit];
    return { url, body: init.body };
  });

const respondWith = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  queryClient.clear();
  useNotificationStore.getState().clearNotifications();
  vi.mocked(api.autocomplete).mockResolvedValue({
    ResultItems: PLACES.filter((p) => p.PlaceType !== "SecondaryAddress").map((p) => ({
      PlaceId: p.PlaceId!,
      PlaceType: p.PlaceType!,
      Title: p.Title!,
      Address: p.Address,
    })),
    PricingBucket: "Core",
    $metadata: {},
  });
  // As Amazon does, GetPlace answers a unit with a different PlaceId than the
  // one its building lists — and that one resolves nowhere (see below).
  vi.mocked(api.getPlace).mockImplementation(async (_client, input) => {
    const found = PLACES.find((p) => p.PlaceId === input.PlaceId)!;
    return found === UNIT ? { ...UNIT, PlaceId: REWRITTEN_UNIT_ID } : found;
  });
  fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const { PlaceId } = JSON.parse(init.body as string);
    if (!PLACES.some((p) => p.PlaceId === PlaceId)) {
      // What the service answers for the rewritten unit PlaceId (measured 25 Sep 2026).
      return respondWith(502, { message: "The upstream location provider failed", code: "UpstreamException" });
    }
    return respondWith(200, verifyAnswer(PlaceId));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** Type into the address field and pick an option by its label; a unit is a second pick. */
async function pick(...labels: string[]) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Sydney" } });
  for (const label of labels) {
    const option = await screen.findByRole("option", { name: label });
    await userEvent.selectOptions(screen.getByRole("listbox"), option);
  }
  // Settled when the pick has written the form: every fixture's locality is Sydney.
  await waitFor(() => expect(screen.getByRole("textbox", { name: "City" })).toHaveValue("Sydney"));
  await act(async () => {});
}

/**
 * What a browser's autofill does: write the fields, then the form's detection
 * fires with their values. Settled when the form has resolved the text to a place.
 */
async function autofillWith(values: Record<string, string>) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: values.addressLineOne } });
  fireEvent.change(screen.getByRole("textbox", { name: "City" }), { target: { value: values.city } });
  fireEvent.change(screen.getByRole("textbox", { name: "Postal code" }), { target: { value: values.postalCode } });
  await act(async () => autofill?.(values));
  await waitFor(() => expect(api.getPlace).toHaveBeenCalled());
  await act(async () => {});
}

const FIELDS = (
  <>
    <input
      data-type="address-form"
      name="addressLineOne"
      data-api-name="autocomplete"
      data-show-current-location="false"
    />
    <input data-type="address-form" name="addressLineTwo" aria-label="Address Line 2" />
    <input data-type="address-form" name="city" aria-label="City" />
    <input data-type="address-form" name="postalCode" aria-label="Postal code" />
    <button data-type="address-form" type="submit">
      Submit
    </button>
  </>
);

/** Submit, and return the getData the form handed onSubmit. */
async function submit(onSubmit: ReturnType<typeof vi.fn>): Promise<() => Promise<AddressFormData>> {
  const before = onSubmit.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() => expect(onSubmit.mock.calls.length).toBe(before + 1));
  return onSubmit.mock.calls[before][0];
}

describe("<AddressForm verify>", () => {
  const renderForm = (verify?: boolean) => {
    const onSubmit = vi.fn();
    renderWithProvider(
      <AddressForm verify={verify} onSubmit={onSubmit}>
        {FIELDS}
      </AddressForm>,
    );
    return onSubmit;
  };

  it("is off by default: no call at submit, and no verified", async () => {
    const onSubmit = renderForm();
    await pick("2 Other St, Sydney NSW 2000");

    const data = await (await submit(onSubmit))();

    expect(data.placeId).toBe("house-2");
    expect(data).not.toHaveProperty("verified");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies at submit, once, with exactly the chosen PlaceId — and not while typing", async () => {
    const onSubmit = renderForm(true);
    await pick("2 Other St, Sydney NSW 2000");
    expect(fetchMock).not.toHaveBeenCalled();

    const data = await (await submit(onSubmit))();

    expect(verifies()).toEqual([{ url: `${API}/address/verify`, body: JSON.stringify({ PlaceId: "house-2" }) }]);
    expect(data.verified).toBe(true);
    expect(data.verification).toEqual(verifyAnswer("house-2"));
    expect(data.placeId).toBe("house-2");
    expect(data.city).toBe("Sydney");
  });

  it("verifies the same PlaceId once, however often it is submitted", async () => {
    const onSubmit = renderForm(true);
    await pick("2 Other St, Sydney NSW 2000");

    const first = await (await submit(onSubmit))();
    const second = await (await submit(onSubmit))();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.verification).toEqual(first.verification);
  });

  it("sends a unit's PlaceId as chosen", async () => {
    const onSubmit = renderForm(true);
    await pick("100 Example St, Sydney NSW 2000", "1/100 Example St");

    const data = await (await submit(onSubmit))();

    expect(verifies()).toEqual([{ url: `${API}/address/verify`, body: JSON.stringify({ PlaceId: "unit-1" }) }]);
    expect(data.verification?.PlaceType).toBe("SecondaryAddress");
    expect(data.verified).toBe(true);
  });

  it("resolves verified: false — a no is an answer", async () => {
    const onSubmit = renderForm(true);
    await pick("Sydney NSW, Australia");

    const data = await (await submit(onSubmit))();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data.verified).toBe(false);
    expect(data.verification?.PlaceType).toBe("Locality");
  });

  it("makes no call when nothing was picked, and leaves verified absent", async () => {
    const onSubmit = renderForm(true);
    fireEvent.change(screen.getByRole("textbox", { name: "City" }), { target: { value: "Sydney" } });

    const data = await (await submit(onSubmit))();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(data).not.toHaveProperty("verified");
    expect(data.city).toBe("Sydney");
  });

  it("makes no call when a picked field was edited by hand: the PlaceId no longer describes it", async () => {
    const onSubmit = renderForm(true);
    await pick("2 Other St, Sydney NSW 2000");
    fireEvent.change(screen.getByRole("textbox", { name: "City" }), { target: { value: "Parramatta" } });

    const data = await (await submit(onSubmit))();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(data).not.toHaveProperty("verified");
    expect(data.placeId).toBe("house-2");
    expect(data.city).toBe("Parramatta");
  });

  it("still verifies when only address line two was added — it is not a picked field", async () => {
    const onSubmit = renderForm(true);
    await pick("2 Other St, Sydney NSW 2000");
    fireEvent.change(screen.getByRole("textbox", { name: "Address Line 2" }), { target: { value: "Rear" } });

    const data = await (await submit(onSubmit))();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data.verified).toBe(true);
    expect(data.addressLineTwo).toBe("Rear");
  });

  it("verifies again once the edit is undone: the fields read what the pick filled in", async () => {
    const onSubmit = renderForm(true);
    await pick("2 Other St, Sydney NSW 2000");
    const city = screen.getByRole("textbox", { name: "City" });
    fireEvent.change(city, { target: { value: "Parramatta" } });
    fireEvent.change(city, { target: { value: "Sydney" } });

    const data = await (await submit(onSubmit))();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data.verified).toBe(true);
  });

  it("shares one call between submits made while the first is in flight", async () => {
    let release: () => void = () => {};
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) => {
          release = () => resolve(respondWith(200, verifyAnswer(JSON.parse(init.body as string).PlaceId)));
        }),
    );
    const onSubmit = renderForm(true);
    await pick("2 Other St, Sydney NSW 2000");

    // A double click: the second submit arrives before the first answer.
    const first = (await submit(onSubmit))();
    const second = (await submit(onSubmit))();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.verified).toBe(true);
    expect(b.verification).toEqual(a.verification);
  });

  it("verifies an autofilled address: the PlaceId the form resolved it to, as sent", async () => {
    // As for a unit, GetPlace answers with a different PlaceId; the one sent is kept.
    vi.mocked(api.getPlace).mockImplementationOnce(async () => ({ ...HOUSE, PlaceId: "house-2-as-answered" }));
    const onSubmit = renderForm(true);
    await autofillWith({ addressLineOne: "2 Other St", city: "Sydney", postalCode: "2000" });

    const data = await (await submit(onSubmit))();

    expect(verifies()).toEqual([{ url: `${API}/address/verify`, body: JSON.stringify({ PlaceId: "house-2" }) }]);
    expect(data.placeId).toBe("house-2");
    expect(data.verified).toBe(true);
  });

  it.each(["autocomplete", "suggest"] as const)(
    "verifies nothing when an autofill resolves to nothing, and does not throw (%s)",
    async (apiName) => {
      // A no-match answer is an empty list, not a missing one.
      const empty = { ResultItems: [], PricingBucket: "Core", $metadata: {} };
      vi.mocked(api.autocomplete).mockResolvedValue(empty);
      vi.mocked(api.suggest).mockResolvedValue(empty);
      const onSubmit = vi.fn();
      renderWithProvider(
        <AddressForm verify onSubmit={onSubmit}>
          <input
            data-type="address-form"
            name="addressLineOne"
            data-api-name={apiName}
            data-show-current-location="false"
          />
          <input data-type="address-form" name="city" aria-label="City" />
          <button data-type="address-form" type="submit">
            Submit
          </button>
        </AddressForm>,
      );
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "1 Nowhere Rd" } });
      fireEvent.change(screen.getByRole("textbox", { name: "City" }), { target: { value: "Nowhere" } });

      // The handler's own promise: a throw inside it fails this test.
      await act(async () => autofill?.({ addressLineOne: "1 Nowhere Rd", city: "Nowhere" }));
      const data = await (await submit(onSubmit))();

      expect(apiName === "suggest" ? api.suggest : api.autocomplete).toHaveBeenCalled();
      expect(api.getPlace).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(data).not.toHaveProperty("verified");
    },
  );

  it("does not verify an autofilled address edited by hand afterwards", async () => {
    const onSubmit = renderForm(true);
    await autofillWith({ addressLineOne: "2 Other St", city: "Sydney", postalCode: "2000" });
    fireEvent.change(screen.getByRole("textbox", { name: "City" }), { target: { value: "Parramatta" } });

    const data = await (await submit(onSubmit))();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(data).not.toHaveProperty("verified");
  });

  it("rejects a failed verify, shows it in the banner, and does not keep it", async () => {
    fetchMock.mockImplementationOnce(async () =>
      respondWith(403, { message: "Forbidden", code: "ForbiddenException", requestId: "r" }),
    );
    const onSubmit = renderForm(true);
    await pick("2 Other St, Sydney NSW 2000");

    await expect((await submit(onSubmit))()).rejects.toMatchObject({ statusCode: 403 });
    expect(await screen.findByText(/Address verification is not available for this application/)).toBeInTheDocument();

    // The failure was not kept: the next submit asks again, and succeeds.
    const data = await (await submit(onSubmit))();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data.verified).toBe(true);
  });
});

describe("render({ verify })", () => {
  const mount = (verify?: boolean) => {
    document.body.innerHTML = `
      <form id="address-form">
        <input data-type="address-form" name="addressLineOne" data-api-name="autocomplete" data-show-current-location="false" />
        <input data-type="address-form" name="city" aria-label="City" />
        <button data-type="address-form" type="submit">Submit</button>
      </form>
    `;
    const onSubmit = vi.fn();
    act(() => {
      render({
        root: "#address-form",
        getConfig: async () => ({ apiUrl: API, token: "test-token", expiresAt: Date.now() + 900_000 }),
        onSubmit,
        verify,
      });
    });
    return onSubmit;
  };

  it("is off by default", async () => {
    const onSubmit = mount();
    await pick("2 Other St, Sydney NSW 2000");

    const data = await (await submit(onSubmit))();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(data).not.toHaveProperty("verified");
  });

  it("verifies the chosen PlaceId at submit, once", async () => {
    const onSubmit = mount(true);
    await pick("2 Other St, Sydney NSW 2000");

    await (
      await submit(onSubmit)
    )();
    const data = await (await submit(onSubmit))();

    expect(verifies()).toEqual([{ url: `${API}/address/verify`, body: JSON.stringify({ PlaceId: "house-2" }) }]);
    expect(data.verified).toBe(true);
  });
});
