import { FEATURE_NOT_ENTITLED } from "@chaosity/location-client";
import { useLocationClient } from "@chaosity/location-client-react";
import type { FunctionComponent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNotificationStore } from "../../stores/notificationStore";
import { DOCS } from "../../utils/docs";
import type { MapProps } from "../Map";
import { Map } from "../Map";
import { tokenLedger } from "../Map/tokenLedger";
import { getColorScheme, getMapStyleType } from "../Map/utils";
import type { MapMarkerProps } from "../MapMarker";
import { MapMarker } from "../MapMarker";
import { useAddressFormContext } from "./AddressFormContext";
import { parsePosition } from "./utils";

export type AddressFormMapProps = MapProps & Pick<MapMarkerProps, "adjustablePosition">;

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
  const { getToken, refreshToken } = useLocationClient();
  // The map's ledger: which token each request carried, and what each refresh
  // brought (location-service-client#72).
  const ledger = useMemo(() => tokenLedger(getToken, refreshToken), [getToken, refreshToken]);
  // The last refused request, which the log names. Never the event: it reaches
  // the map's state, and a dev server that relays the console prints the
  // bearer token with it.
  const lastRefused = useRef<{ status?: number; url?: string }>(undefined);

  const showTokenError = useCallback(() => {
    addNotification(
      { id: "map-token-error", type: "error", message: "Map rendering is currently unavailable." },
      () => {
        console.error(
          `Map rendering failed: the service refused the map's token (401), and the provider has none it accepts. Check the token and apiUrl your getConfig returns. See ${DOCS} for setup instructions.`,
          lastRefused.current,
        );
      },
    );
  }, [addNotification]);
  // A refresh the map asked for that brought no other token, or failed. Heard
  // only while this map is mounted: one gone by the time it settles says nothing.
  useEffect(() => ledger.onUnrecoverable(showTokenError), [ledger, showTokenError]);

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
    const innerError = error.error as { status?: number; url?: string; body?: unknown };
    // Never the event: see lastRefused.
    const refusedRequest = { status: innerError?.status, url: innerError?.url };

    // The service did not accept the token the map was sent with (#25). The map
    // asks the provider for a new one and reloads what was refused
    // (location-service-client#72), and this says the map is unavailable only
    // when it cannot recover: the provider's refresh brought no other token (a
    // token route that hands the refused one back), which the ledger reports,
    // or the token that refresh brought was refused too (a token for another
    // API), which this request's own token says. A request sent with a token
    // since replaced says nothing: the map sends it again. Before #25 a 401
    // returned here like any other status, leaving a blank map and nothing said.
    if (innerError?.status === 401) {
      lastRefused.current = refusedRequest;
      if (ledger.refusal(innerError.url) === "again") showTokenError();
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
          console.error(`Map rendering failed: ${explanation} See ${DOCS} for the map options.`, refusedRequest);
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
            refusedRequest,
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
