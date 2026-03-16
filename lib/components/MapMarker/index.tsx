import { useRef, useState } from "react";
import { Marker } from "react-map-gl/maplibre";
import { AdjustButton } from "./AdjustButton";
import { buttons } from "./styles.css.ts";
import { ColorScheme } from "../Map/index.tsx";

export interface MapMarkerProps {
  adjustablePosition?: boolean;
  markerPosition?: [number, number];
  onSaveMarkerPosition?: (position: [number, number]) => void;
  colorScheme?: ColorScheme;
}

export function MapMarker({
  adjustablePosition = true,
  markerPosition,
  onSaveMarkerPosition,
  colorScheme,
}: MapMarkerProps) {
  const markerRef = useRef<maplibregl.Marker>(null);
  const [isAdjustMode, setIsAdjustMode] = useState(false);

  const handleAdjustMarker = () => {
    setIsAdjustMode(true);
  };

  const handleSaveMarkerPosition = () => {
    if (onSaveMarkerPosition && markerRef.current) {
      const lngLat = markerRef.current.getLngLat();
      onSaveMarkerPosition([lngLat.lng, lngLat.lat]);
      setIsAdjustMode(false);
    }
  };

  const handleCancelAdjustMarker = () => {
    if (markerRef.current && markerPosition) {
      markerRef.current.setLngLat(markerPosition);
    }
    setIsAdjustMode(false);
  };

  if (markerPosition) {
    return (
      <>
        {adjustablePosition && (
          <div className={buttons}>
            {isAdjustMode ? (
              <>
                <AdjustButton onClick={handleSaveMarkerPosition}>Set location</AdjustButton>

                <AdjustButton onClick={handleCancelAdjustMarker}>Cancel</AdjustButton>
              </>
            ) : (
              <AdjustButton onClick={handleAdjustMarker}>Adjust marker</AdjustButton>
            )}
          </div>
        )}

        <Marker
          draggable={adjustablePosition && isAdjustMode}
          longitude={markerPosition[0]}
          latitude={markerPosition[1]}
          anchor="bottom"
          color={colorScheme === "Light" ? "#000" : "#ddd"}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={markerRef as any}
        />
      </>
    );
  }
}
