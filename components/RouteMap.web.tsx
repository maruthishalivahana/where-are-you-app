import polyline from "@mapbox/polyline";
import React, { useMemo, useState } from "react";
import { Image, View } from "react-native";
import Svg, { Circle, Polyline as SvgPolyline } from "react-native-svg";

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

  const [imageFailed, setImageFailed] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  const encodedPath = polyline.encode(
    coordinates.map((point) => [point.latitude, point.longitude]),
  );

  const staticMapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?size=1200x700&scale=2` +
    `&path=weight:6|color:0x1d4ed8ff|enc:${encodeURIComponent(encodedPath)}` +
    `&markers=color:green|${start.latitude},${start.longitude}` +
    `&markers=color:red|${end.latitude},${end.longitude}` +
    (currentLocation
      ? `&markers=color:blue|${currentLocation.latitude},${currentLocation.longitude}`
      : "") +
    `&key=${GOOGLE_MAPS_API_KEY || ""}`;

  const waypoints = stops
    .slice(0, 8)
    .map((stop) => `${stop.latitude},${stop.longitude}`)
    .join("|");

  const embedMapUrl =
    `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY || ""}` +
    `&origin=${start.latitude},${start.longitude}` +
    `&destination=${end.latitude},${end.longitude}` +
    `&mode=driving` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "");

  const projection = useMemo(() => {
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

    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);

    const width = 1000;
    const height = 500;
    const padding = 28;

    const toScreen = (point: { latitude: number; longitude: number }) => ({
      x:
        padding +
        ((point.longitude - minLng) / lngRange) * (width - padding * 2),
      y:
        height -
        padding -
        ((point.latitude - minLat) / latRange) * (height - padding * 2),
    });

    return {
      routePoints: coordinates.map(toScreen),
      stopPoints: stops.map((stop) => ({
        ...toScreen(stop),
        name: stop.name,
      })),
      currentPoint: currentLocation ? toScreen(currentLocation) : null,
    };
  }, [coordinates, currentLocation, stops]);

  if (!GOOGLE_MAPS_API_KEY || imageFailed) {
    return (
      <View className="flex-1 bg-slate-100">
        <Svg width="100%" height="100%" viewBox="0 0 1000 500">
          <SvgPolyline
            points={projection.routePoints
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {projection.routePoints[0] && (
            <Circle
              cx={projection.routePoints[0].x}
              cy={projection.routePoints[0].y}
              r={10}
              fill="#22c55e"
            />
          )}
          {projection.routePoints[projection.routePoints.length - 1] && (
            <Circle
              cx={projection.routePoints[projection.routePoints.length - 1].x}
              cy={projection.routePoints[projection.routePoints.length - 1].y}
              r={10}
              fill="#ef4444"
            />
          )}
          {projection.stopPoints.map((stopPoint, index) => (
            <Circle
              key={`stop-${index}`}
              cx={stopPoint.x}
              cy={stopPoint.y}
              r={6}
              fill="#f59e0b"
            />
          ))}
          {projection.currentPoint ? (
            <Circle
              cx={projection.currentPoint.x}
              cy={projection.currentPoint.y}
              r={8}
              fill="#2563eb"
            />
          ) : null}
        </Svg>
      </View>
    );
  }

  if (GOOGLE_MAPS_API_KEY && !embedFailed) {
    return (
      <View className="flex-1 bg-slate-100">
        {React.createElement("iframe", {
          src: embedMapUrl,
          style: {
            width: "100%",
            height: "100%",
            border: 0,
          },
          allowFullScreen: true,
          loading: "lazy",
          referrerPolicy: "no-referrer-when-downgrade",
          onError: () => setEmbedFailed(true),
        })}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-100">
      <Image
        source={{ uri: staticMapUrl }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
        onError={() => setImageFailed(true)}
      />
    </View>
  );
}
