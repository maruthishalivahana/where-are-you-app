type RouteMapProps = {
  coordinates: { latitude: number; longitude: number }[];
  stops?: { latitude: number; longitude: number; name?: string }[];
  currentLocation?: { latitude: number; longitude: number };
};

export default function RouteMap(_props: RouteMapProps) {
  return null;
}
