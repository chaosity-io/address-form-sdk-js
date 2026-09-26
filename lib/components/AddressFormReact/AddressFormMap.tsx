import type { FunctionComponent } from "react";
import { useNotificationStore } from "../../stores/notificationStore";
import { DOCS } from "../../utils/docs";
import type { MapProps } from "../Map";
import { Map } from "../Map";
import { getColorScheme, getMapStyleType } from "../Map/utils";
import type { MapMarkerProps } from "../MapMarker";
import { MapMarker } from "../MapMarker";
import { useAddressFormContext } from "./AddressFormContext";
import { parsePosition } from "./utils";

export type AddressFormMapProps = MapProps & Pick<MapMarkerProps, "adjustablePosition">;

/**
 * The code the service answers a map option outside the application's plan
 * with (#22). A literal rather than `@chaosity/location-client`'s
 * `FEATURE_NOT_ENTITLED`: the peer range admits clients that predate that
 * export, and an `undefined` would never match.
 */
const FEATURE_NOT_ENTITLED = "FeatureNotEntitledException";

/**
 * The `{ code, message }` a refused map request carries, or nothing.
 *
 * MapLibre fetches the style and tiles itself, so a refusal arrives as its
 * `AJAXError`, whose `body` is the response as a Blob. The service's body is
 * `{ message, code, requestId }`; anything else — an empty body, HTML from a
 * proxy — is treated as saying nothing.
 */
const readRefusal = async (error: { body?: unknown }): Promise<{ code?: string; message?: string }> => {
  const body = error.body as Blob | undefined;
  if (typeof body?.text !== "function") return {};
  try {
    const data = JSON.parse(await body.text()) as { code?: unknown; message?: unknown };
    return {
      code: typeof data.code === "string" ? data.code : undefined,
      message: typeof data.message === "string" ? data.message : undefined,
    };
  } catch {
    return {};
  }
};

export const AddressFormMap: FunctionComponent<AddressFormMapProps> = ({
  adjustablePosition,
  children,
  ...mapProps
}) => {
  const { data, setData, mapViewState, setMapViewState } = useAddressFormContext();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const handleSaveMarkerPosition = (markerPosition: [number, number]) => {
    setData({ adjustedPosition: markerPosition.join(",") });
  };

  /**
   * What to add when the one gated thing this map asks for is known. The
   * service's message names the refused feature either way; this says what to
   * change. Worked out from the props, never from the message's wording, which
   * is the service's to change.
   */
  const refusalHint = (): string => {
    const style = getMapStyleType(mapProps.mapStyle);
    const asksSatellite = style === "Hybrid" || style === "Satellite";
    if (asksSatellite && !mapProps.politicalView) {
      return " The Standard and Monochrome styles need no plan feature.";
    }
    if (mapProps.politicalView && !asksSatellite) {
      return " The map's politicalView is the plan feature; the form's politicalView, for suggestions, is not.";
    }
    return "";
  };

  const handleMapError = (error: unknown) => {
    if (!error || typeof error !== "object" || !("error" in error)) return;
    const innerError = error.error as { status?: number; body?: unknown };

    // The service did not accept the token the map was sent with (#25). The map
    // waits for the provider's token, so this is one the service refuses: a
    // token for another API, or not a token at all. MapLibre does not ask
    // again, and this used to return here like any other status, leaving a
    // blank map and nothing said.
    if (innerError?.status === 401) {
      addNotification(
        { id: "map-token-error", type: "error", message: "Map rendering is currently unavailable." },
        () => {
          console.error(
            `Map rendering failed: the service refused the map's token (401). Check the token and apiUrl your getConfig returns. See ${DOCS} for setup instructions.`,
            error,
          );
        },
      );
      return;
    }

    if (innerError?.status !== 403) return;

    // A 403 is one of three things with three fixes: an Origin the application
    // does not allow, a plan without the map routes, or a plan without an
    // option this map asks for. Only the last says so in its body, so read it
    // before choosing the words (#22). There is deliberately no fallback style:
    // a Satellite map quietly drawn as Standard is not the map its integrator
    // chose, and they would never learn why.
    void readRefusal(innerError).then(({ code, message }) => {
      if (code === FEATURE_NOT_ENTITLED) {
        const explanation =
          (message ?? "This application's plan does not include an option this map asks for.") + refusalHint();
        addNotification({ id: "map-feature-error", type: "error", message: `Map unavailable: ${explanation}` }, () => {
          console.error(`Map rendering failed: ${explanation} See ${DOCS} for the map options.`, error);
        });
        return;
      }

      addNotification(
        {
          id: "map-permission-error",
          type: "error",
          message: "Map rendering is currently unavailable.",
        },
        () => {
          console.error(
            `Map rendering failed: This is likely due to insufficient permissions. See ${DOCS} for setup instructions.`,
            error,
          );
        },
      );
    });
  };

  return (
    <Map
      {...mapViewState}
      onMove={({ viewState }) => setMapViewState(viewState)}
      onError={handleMapError}
      {...mapProps}
    >
      <MapMarker
        adjustablePosition={adjustablePosition}
        markerPosition={parsePosition(data.adjustedPosition ?? data.originalPosition ?? "")}
        onSaveMarkerPosition={handleSaveMarkerPosition}
        colorScheme={getColorScheme(mapProps.mapStyle)}
      />
      {children}
    </Map>
  );
};
