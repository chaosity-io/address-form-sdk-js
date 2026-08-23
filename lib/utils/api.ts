import type {
  AutocompleteCommandInput,
  AutocompleteCommandOutput,
  GetPlaceCommandInput,
  GetPlaceCommandOutput,
  ReverseGeocodeCommandInput,
  ReverseGeocodeCommandOutput,
  SuggestCommandInput,
  SuggestCommandOutput,
} from "@chaosity/location-client";
import { AutocompleteCommand, GetPlaceCommand, ReverseGeocodeCommand, SuggestCommand } from "@chaosity/location-client";
import { useNotificationStore } from "../stores/notificationStore";

/**
 * Per-request transport options, forwarded to the client's `send`.
 *
 * Declared structurally rather than imported so this builds against the
 * currently published client; it matches `SendOptions` there.
 */
export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  retry?: false | { maxAttempts?: number };
}

/**
 * What this package needs from a client.
 *
 * Structural rather than `GeoPlacesClient`, for two reasons.
 *
 * It lets the two release independently: a client whose `send` takes only the
 * command is still assignable, which is what let the AbortSignal land before the
 * client carrying it was published.
 *
 * And it is the only thing that works across client versions. `useLocationClient()`
 * returned a `GeoPlacesClient` instance up to `@chaosity/location-client-react`
 * 0.2.x and returns a `LocationClient` INTERFACE from 0.3.0. A class with private
 * fields is not assignable to that interface, so anything here typed as the class
 * stops compiling for consumers on 0.3.0. Structural accepts both.
 */
export interface LocationClientLike {
  send<TInput, TOutput>(command: TInput, options?: RequestOptions): Promise<TOutput>;
}

export const autocomplete = async (
  client: LocationClientLike,
  input: AutocompleteCommandInput,
  options?: RequestOptions,
): Promise<AutocompleteCommandOutput> => {
  try {
    const command = new AutocompleteCommand(input);
    return await client.send(command, options);
  } catch (error) {
    handleApiError(error, "autocomplete", "Address autocomplete");
    throw error;
  }
};

export const suggest = async (
  client: LocationClientLike,
  input: SuggestCommandInput,
  options?: RequestOptions,
): Promise<SuggestCommandOutput> => {
  try {
    const command = new SuggestCommand(input);
    return await client.send(command, options);
  } catch (error) {
    handleApiError(error, "suggest", "Address suggestions");
    throw error;
  }
};

export const getPlace = async (
  client: LocationClientLike,
  input: GetPlaceCommandInput,
  options?: RequestOptions,
): Promise<GetPlaceCommandOutput> => {
  try {
    const command = new GetPlaceCommand(input);
    return await client.send(command, options);
  } catch (error) {
    handleApiError(error, "get-place", "Place details");
    throw error;
  }
};

export const reverseGeocode = async (
  client: LocationClientLike,
  input: ReverseGeocodeCommandInput,
  options?: RequestOptions,
): Promise<ReverseGeocodeCommandOutput> => {
  try {
    const command = new ReverseGeocodeCommand(input);
    return await client.send(command, options);
  } catch (error) {
    handleApiError(error, "reverse-geocode", "Reverse geocode");
    throw error;
  }
};

/**
 * Shape-checked rather than `instanceof`, so this works against any published
 * version of the client without a version lockstep.
 */
interface ClientError {
  name?: string;
  code?: string;
  statusCode?: number;
  message?: string;
}

const asClientError = (error: unknown): ClientError | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const e = error as ClientError;
  return e.name === "LocationServiceException" ? e : undefined;
};

/**
 * What the user is told, per failure class.
 *
 * Everything used to produce one line — "… is currently unavailable" — which was
 * wrong in both directions: it told someone with a bad API key to wait, and it
 * told someone whose network blipped that our service was down.
 *
 * `undefined` means SAY NOTHING. That matters most for cancellation: the client
 * now aborts a superseded request on every keystroke, so a notification per
 * abort would fire a stream of errors at someone who is simply still typing.
 */
const describe = (error: unknown, description: string): string | undefined => {
  const e = asClientError(error);
  const verb = description.endsWith("s") ? "are" : "is";

  if (!e) return `${description} ${verb} currently unavailable.`;

  switch (e.code) {
    case "AbortedException":
      return undefined;
    case "TimeoutException":
    case "NetworkException":
      return `${description} ${verb} taking too long. Check your connection and try again.`;
    case "ThrottlingException":
      return `Too many requests. ${description} will be available again in a moment.`;
    case "ValidationException":
      return `${description} could not be completed — the request was not valid.`;
    default:
      break;
  }

  if (e.statusCode === 401 || e.statusCode === 403) {
    return `${description} ${verb} not available for this application. Check its configuration.`;
  }

  return `${description} ${verb} currently unavailable.`;
};

const handleApiError = (error: unknown, id: string, description: string) => {
  const message = describe(error, description);

  // Cancellation is not a failure; the caller moved on.
  if (!message) return;

  const { addNotification } = useNotificationStore.getState();
  const docsLink = "https://docs.chaosity.cloud/address-form";

  addNotification(
    {
      id: `${id}-error`,
      message,
      type: "error",
    },
    () => {
      console.error(`${description} failed. See ${docsLink} for troubleshooting.`, error);
    },
  );
  // NOTE: no throw here. This used to rethrow, and every caller rethrew again —
  // the second throw was unreachable and the flow read as if it were the path.
};
