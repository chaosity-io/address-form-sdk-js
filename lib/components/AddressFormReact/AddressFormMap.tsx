import { FunctionComponent } from "react";
import { Map, MapProps } from "../Map";
import { MapMarker, MapMarkerProps } from "../MapMarker";
import { useAddressFormContext } from "./AddressFormContext";
import { parsePosition } from "./utils";
import { getColorScheme } from "../Map/utils";
import { useNotificationStore } from "../../stores/notificationStore";

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
        addNotification({
          id: "map-permission-error",
          type: "error",
          message: "Map rendering is currently unavailable. Please contact support for assistance.",
        });
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
