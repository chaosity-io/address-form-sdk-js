import { LocationClientProvider } from "@chaosity/location-client-react";
import { act, fireEvent, render as renderReact, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationStore } from "../../stores/notificationStore";
import * as api from "../../utils/api";
import { AddressForm } from "./AddressForm";
import { render } from "./render";

vi.mock("../../utils/api", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("../../utils/api")>();
  return {
    ...actual,
    autocomplete: vi.fn().mockResolvedValue({ ResultItems: [] }),
    suggest: vi.fn().mockResolvedValue({ ResultItems: [] }),
    reverseGeocode: vi.fn().mockResolvedValue({ ResultItems: [] }),
    getPlace: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("../../utils/debounce", () => ({
  useDebounce: (value: string) => value,
}));

// Browser autofill is detected by a CSS animation jsdom never runs, so the
// detection is stubbed and the test fires it with the values a browser filled.
let autofill: ((values: Record<string, string>) => void) | undefined;
vi.mock("../../utils/detect-autofill", () => ({
  detectAutofill: (_form: HTMLFormElement, callback: (values: Record<string, string>) => void) => {
    autofill = callback;
    return () => {};
  },
}));

// MapLibre needs WebGL, which jsdom has not got; the map is not the subject here.
vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="maplibre-map">{children}</div>,
  NavigationControl: () => null,
  Marker: () => null,
}));

const CONFIG = { apiUrl: "https://test-api.chaosity.cloud", token: "test-token", expiresAt: Date.now() + 900_000 };
const FAILURE = "token route answered 500";

/** What the README's React example renders, with every field. */
const FIELDS = (
  <>
    <input data-type="address-form" name="addressLineOne" data-api-name="autocomplete" />
    <input data-type="address-form" name="addressLineTwo" aria-label="Address Line 2" />
    <input data-type="address-form" name="city" aria-label="City" />
    <input data-type="address-form" name="province" aria-label="Province" />
    <input data-type="address-form" name="postalCode" aria-label="Postal code" />
    <input data-type="address-form" name="country" aria-label="Country" />
    <AddressForm.Map mapStyle={["Standard", "Light"]} />
  </>
);

const HOST_FORM = `
  <form id="address-form">
    <input data-type="address-form" name="addressLineOne" data-api-name="autocomplete" />
    <input data-type="address-form" name="addressLineTwo" aria-label="Address Line 2" />
    <input data-type="address-form" name="city" aria-label="City" />
    <input data-type="address-form" name="province" aria-label="Province" />
    <input data-type="address-form" name="postalCode" aria-label="Postal code" />
    <input data-type="address-form" name="country" aria-label="Country" />
    <div data-type="address-form" data-map-style="Standard,Light"></div>
  </form>
`;

const ADDRESS_FIELDS = ["addressLineOne", "addressLineTwo", "city", "province", "postalCode"];

const field = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
const shown = () => useNotificationStore.getState().notifications.map((n) => n.message);

/** React reports an error nothing caught through `reportError`, which jsdom turns into a window "error" event. */
let uncaught: unknown[];
const onUncaught = (event: ErrorEvent) => {
  uncaught.push(event.error);
  event.preventDefault();
};

beforeEach(() => {
  document.body.innerHTML = "";
  useNotificationStore.getState().clearNotifications();
  vi.clearAllMocks();
  autofill = undefined;
  uncaught = [];
  window.addEventListener("error", onUncaught);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  window.removeEventListener("error", onUncaught);
  vi.restoreAllMocks();
});

/**
 * One failed `getConfig` (#30).
 *
 * The provider settles with `client: null`, `loading: false` and an `error`,
 * and retries on its own timer. The form's own hook used to read that state as
 * a missing provider and throw during render. Nothing caught it, so React
 * unmounted the whole form: every address input gone, and with `render()` the
 * page's own inputs too, which it had already removed to mount its own.
 */
describe("a getConfig that fails", () => {
  const expectUsable = async (getConfig: () => Promise<unknown>) => {
    await waitFor(() => expect(getConfig).toHaveBeenCalled());
    // Let the rejection reach the provider, and the provider's state the form.
    await act(async () => {});
    await act(async () => {});
    expect(uncaught).toEqual([]);
    for (const name of ADDRESS_FIELDS) expect(field(name), name).toBeInTheDocument();
    await waitFor(() => expect(shown().join("\n")).toContain(FAILURE));
    await userEvent.type(field("addressLineOne")!, "12 Example Street");
    // Nothing to ask with, so nothing is asked, and no list opens to say
    // "No results." about an address nobody looked up.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.type(field("city")!, "Sydney");
    expect(field("addressLineOne")).toHaveValue("12 Example Street");
    expect(field("city")).toHaveValue("Sydney");
    expect(api.autocomplete).not.toHaveBeenCalled();
    expect(uncaught).toEqual([]);
  };

  it("leaves every <AddressForm> field in place, typeable, and says why in the banner", async () => {
    const getConfig = vi.fn().mockRejectedValue(new Error(FAILURE));
    renderReact(
      <LocationClientProvider getConfig={getConfig}>
        <AddressForm>{FIELDS}</AddressForm>
      </LocationClientProvider>,
    );
    await expectUsable(getConfig);
  });

  it("leaves every render() field in place, typeable, and says why in the banner", async () => {
    document.body.innerHTML = HOST_FORM;
    const getConfig = vi.fn().mockRejectedValue(new Error(FAILURE));
    act(() => render({ root: "#address-form", getConfig }));
    await expectUsable(getConfig);
  });

  it("disables the locate button until there is a client", async () => {
    const getConfig = vi.fn().mockRejectedValue(new Error(FAILURE));
    renderReact(
      <LocationClientProvider getConfig={getConfig}>
        <AddressForm>{FIELDS}</AddressForm>
      </LocationClientProvider>,
    );
    await waitFor(() => expect(shown().join("\n")).toContain(FAILURE));
    expect(screen.getByTestId("aws-current-location")).toBeDisabled();
  });

  it("takes the banner down and suggests again once the provider's retry succeeds", async () => {
    // The provider retries a failed first getConfig after a backoff of 1 to 2
    // seconds for a first failure, with jitter.
    const getConfig = vi.fn().mockRejectedValueOnce(new Error(FAILURE)).mockResolvedValue(CONFIG);
    renderReact(
      <LocationClientProvider getConfig={getConfig}>
        <AddressForm>{FIELDS}</AddressForm>
      </LocationClientProvider>,
    );
    await waitFor(() => expect(shown().join("\n")).toContain(FAILURE));

    // Typed while there is no client: nothing is asked yet...
    fireEvent.change(field("addressLineOne")!, { target: { value: "12 Example" } });
    await act(async () => {});
    expect(api.autocomplete).not.toHaveBeenCalled();

    await waitFor(() => expect(getConfig).toHaveBeenCalledTimes(2), { timeout: 5_000 });
    await waitFor(() => expect(shown()).toEqual([]));
    expect(screen.getByTestId("aws-current-location")).toBeEnabled();

    // ...and it is asked for once the client arrives, with no further keystroke.
    await waitFor(() =>
      expect(api.autocomplete).toHaveBeenCalledWith(
        expect.objectContaining({ send: expect.any(Function) }),
        expect.objectContaining({ QueryText: "12 Example" }),
        expect.anything(),
      ),
    );
    expect(uncaught).toEqual([]);
  });
});

/**
 * Before the first `getConfig` answers.
 *
 * The same hook handed its callers `client!` while the provider was loading:
 * a null that the types said could not be null. Typing sent it into a request,
 * which failed on `null.send` and told the visitor autocomplete was
 * unavailable.
 */
describe("before the provider has a client", () => {
  const pending = () => new Promise<never>(() => {});

  it("types without asking for suggestions, and shows no error", async () => {
    renderReact(
      <LocationClientProvider getConfig={pending}>
        <AddressForm>{FIELDS}</AddressForm>
      </LocationClientProvider>,
    );
    await userEvent.type(field("addressLineOne")!, "12 Example");
    await new Promise((r) => setTimeout(r, 50));

    expect(field("addressLineOne")).toHaveValue("12 Example");
    expect(api.autocomplete).not.toHaveBeenCalled();
    // Not "No results.": nothing has been looked up yet.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(shown()).toEqual([]);
  });

  it("disables the locate button", () => {
    renderReact(
      <LocationClientProvider getConfig={pending}>
        <AddressForm>{FIELDS}</AddressForm>
      </LocationClientProvider>,
    );
    expect(screen.getByTestId("aws-current-location")).toBeDisabled();
  });

  it("leaves a browser autofill as typed, without a request", async () => {
    renderReact(
      <LocationClientProvider getConfig={pending}>
        <AddressForm>{FIELDS}</AddressForm>
      </LocationClientProvider>,
    );
    await waitFor(() => expect(autofill).toBeDefined());
    fireEvent.change(field("addressLineOne")!, { target: { value: "12 Example Street" } });
    fireEvent.change(field("city")!, { target: { value: "Sydney" } });
    await act(async () => autofill?.({ addressLineOne: "12 Example Street", city: "Sydney" }));
    await new Promise((r) => setTimeout(r, 50));

    expect(api.autocomplete).not.toHaveBeenCalled();
    expect(api.getPlace).not.toHaveBeenCalled();
    expect(field("addressLineOne")).toHaveValue("12 Example Street");
    expect(shown()).toEqual([]);
  });
});
