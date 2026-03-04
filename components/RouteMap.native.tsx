import React from "react";
import MapView, { Marker, Polyline } from "react-native-maps";

type RouteMapProps = {
  coordinates: { latitude: number; longitude: number }[];
  stops?: { latitude: number; longitude: number; name?: string }[];
  currentLocation?: { latitude: number; longitude: number };
};

export default function RouteMap({
  coordinates,
  stops = [],
  currentLocation,
}: RouteMapProps) {
  if (!coordinates.length) {
    return null;
  }

  const allPoints = [
    ...coordinates,
    ...stops.map((stop) => ({
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    ...(currentLocation ? [currentLocation] : []),
  ];

  const latitudes = allPoints.map((point) => point.latitude);
  const longitudes = allPoints.map((point) => point.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * 1.6, 0.01);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.6, 0.01);

  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta,
        longitudeDelta,
      }}
    >
      <Marker coordinate={coordinates[0]} title="Start" />
      {stops.map((stop, index) => (
        <Marker
          key={`stop-${index}`}
          coordinate={stop}
          title={stop.name || `Stop ${index + 1}`}
          pinColor="#f59e0b"
        />
      ))}
      <Marker
        coordinate={coordinates[coordinates.length - 1]}
        title="Destination"
      />
      <Polyline
        coordinates={coordinates}
        strokeColor="#1d4ed8"
        strokeWidth={4}
      />
      {currentLocation ? (
        <Marker
          coordinate={currentLocation}
          title="Driver"
          pinColor="#2563eb"
        />
      ) : null}
    </MapView>
  );
}
