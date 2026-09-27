import { Marker } from "react-map-gl/maplibre";
import { describeAccuracy, type UserPosition } from "@/lib/map/geolocate";

export const UserPositionMarker = ({
  position,
}: {
  position: UserPosition;
}) => (
  <Marker
    longitude={position.lon}
    latitude={position.lat}
    anchor="center"
    style={{ pointerEvents: "none" }}
  >
    <span
      role="img"
      aria-label={describeAccuracy(position.accuracy)}
      className="block size-3.5 rounded-full border-2 border-white bg-brand shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_25%,transparent),0_1px_4px_rgba(0,0,0,0.35)]"
    />
  </Marker>
);
