import type { FunctionComponent } from "react";
import { useNotificationStore } from "../../stores/notificationStore";
import type { MapProps } from "../Map";
import { Map } from "../Map";
import { getColorScheme } from "../Map/utils";
import type { MapMarkerProps } from "../MapMarker";
import { MapMarker } from "../MapMarker";
import { useAddressFormContext } from "./AddressFormContext";
import { parsePosition } from "./utils";

export type AddressFormMapProps = MapProps & Pick<MapMarkerProps, "adjustablePosition">;

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

  const handleMapError = (error: unknown) => {
    if (error && typeof error === "object" && "error" in error) {
      const innerError = error.error as { status?: number };

      if (innerError?.status === 403) {
        addNotification(
          {
            id: "map-permission-error",
            type: "error",
            message: "Map rendering is currently unavailable.",
          },
          () => {
            console.error(
              "Map rendering failed: This is likely due to insufficient permissions. See https://docs.chaosity.cloud/address-form for setup instructions.",
              error,
            );
          },
        );
      }
    }
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
