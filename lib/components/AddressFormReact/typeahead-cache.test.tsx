import type { AutocompleteCommandOutput } from "@chaosity/location-client";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProvider, untilClient } from "../../test/utils";
import * as api from "../../utils/api";
import { AddressForm } from "./AddressForm";
import { useAddressFormContext } from "./AddressFormContext";

/**
 * The typeahead's cache, through the real form (#31).
 *
 * Its key was the query text alone, and the form's QueryClient was
 * module-global with a 30-minute staleTime. So a list fetched before the
 * country was chosen, or in another language, or by another form on the page
 * with other countries, came back for the same text with no request sent.
 */

vi.mock("../../utils/api", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("../../utils/api")>();
  return { ...actual, autocomplete: vi.fn() };
});

vi.mock("../../utils/debounce", () => ({
  useDebounce: (value: string) => value,
}));

/** One suggestion per request, named for the countries it was filtered to. */
const answerFor = (input: { Filter?: { IncludeCountries?: string[] }; Language?: string }) => {
  const label = `${(input.Filter?.IncludeCountries ?? ["any"]).join("+")} ${input.Language ?? "default"}`;
  const out: AutocompleteCommandOutput = {
    ResultItems: [{ PlaceId: label, Address: { Label: label }, PlaceType: "PointAddress", Title: label }],
    PricingBucket: "bucket1",
    $metadata: {},
  };
  return out;
};

/** Sets the country the way the country field does: `setData` and nothing else. */
const ChooseCountry = ({ code }: { code: string }) => {
  const { setData } = useAddressFormContext();
  return (
    <button type="button" onClick={() => setData({ country: code })}>
      choose {code}
    </button>
  );
};

const Form = (props: { id: string; language?: string; allowedCountries?: string[]; only?: boolean }) => (
  <div data-testid={props.id}>
    <AddressForm
      language={props.language}
      allowedCountries={props.allowedCountries}
      showCurrentCountryResultsOnly={props.only}
    >
      <input data-type="address-form" name="addressLineOne" data-api-name="autocomplete" aria-label="Address" />
      <ChooseCountry code="GB" />
    </AddressForm>
  </div>
);

const typeInto = (form: string, text: string) =>
  fireEvent.change(within(screen.getByTestId(form)).getByRole("combobox"), { target: { value: text } });

/** The open list's results. Headless UI renders them in a portal, so follow `aria-controls`. */
const options = (form: string) => {
  const id = within(screen.getByTestId(form)).getByRole("combobox").getAttribute("aria-controls");
  const list = id ? document.getElementById(id) : null;
  // Result rows only: the list always ends with a "Powered by" row.
  return list ? [...list.querySelectorAll(".aws-typeahead-results__option")].map((o) => o.textContent) : [];
};

const sent = () => vi.mocked(api.autocomplete).mock.calls.map(([, input]) => input);

describe("the typeahead does not serve one request's list for another (#31)", () => {
  beforeEach(() => {
    vi.mocked(api.autocomplete).mockReset();
    vi.mocked(api.autocomplete).mockImplementation(async (_client, input) => answerFor(input));
  });

  it("asks again, filtered, after the country is chosen with showCurrentCountryResultsOnly", async () => {
    renderWithProvider(<Form id="a" only />);
    await untilClient();

    typeInto("a", "10 High St");
    await waitFor(() => expect(options("a")).toEqual(["any default"]));

    act(() => screen.getByRole("button", { name: "choose GB" }).click());
    typeInto("a", "10 High St X");
    typeInto("a", "10 High St");

    await waitFor(() => expect(options("a")).toEqual(["GB default"]));
    expect(sent()).toContainEqual(
      expect.objectContaining({
        QueryText: "10 High St",
        Filter: expect.objectContaining({ IncludeCountries: ["GB"] }),
      }),
    );
  });

  it("asks again after the language changes", async () => {
    const { rerender } = renderWithProvider(<Form id="a" language="en" />);
    await untilClient();

    typeInto("a", "10 High St");
    await waitFor(() => expect(options("a")).toEqual(["any en"]));

    rerender(<Form id="a" language="fr" />);
    typeInto("a", "10 High St X");
    typeInto("a", "10 High St");

    await waitFor(() => expect(options("a")).toEqual(["any fr"]));
    expect(sent()).toContainEqual(expect.objectContaining({ QueryText: "10 High St", Language: "fr" }));
  });

  // A key covers the request, not who asks: two forms under two applications,
  // whose country scopes differ, can send the same request and be owed
  // different answers. So each form has its own cache, and two forms with the
  // same props each ask.
  it("does not share a list between two forms even with the same props", async () => {
    renderWithProvider(
      <>
        <Form id="one" allowedCountries={["AU"]} />
        <Form id="two" allowedCountries={["AU"]} />
      </>,
    );
    await untilClient();

    typeInto("one", "10 High St");
    await waitFor(() => expect(options("one")).toEqual(["AU default"]));
    typeInto("two", "10 High St");
    await waitFor(() => expect(options("two")).toEqual(["AU default"]));

    expect(sent().filter((i) => i.QueryText === "10 High St")).toHaveLength(2);
  });

  it("does not share a list between two forms with different allowedCountries", async () => {
    renderWithProvider(
      <>
        <Form id="au" allowedCountries={["AU"]} />
        <Form id="nz" allowedCountries={["NZ"]} />
      </>,
    );
    await untilClient();

    typeInto("au", "10 High St");
    await waitFor(() => expect(options("au")).toEqual(["AU default"]));
    typeInto("nz", "10 High St");

    await waitFor(() => expect(options("nz")).toEqual(["NZ default"]));
    expect(options("au")).toEqual(["AU default"]);
    expect(sent()).toContainEqual(
      expect.objectContaining({
        QueryText: "10 High St",
        Filter: expect.objectContaining({ IncludeCountries: ["NZ"] }),
      }),
    );
  });
});
