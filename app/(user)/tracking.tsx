import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import polyline from "@mapbox/polyline";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../api/client";
import { BusLiveStatus, DriverStop } from "../../api/types";
import {
    createUserSubscription,
    getUserBusLive,
    getUserSubscriptions,
} from "../../api/user";
import RouteMap from "../../components/RouteMap";
import socketService from "../../sockets/socketService";
import authStore from "../../store/auth";

type Coord = {
  latitude: number;
  longitude: number;
};

export default function UserTrackingScreen() {
  const params = useLocalSearchParams<{
    busId: string | string[];
    plate?: string;
    route?: string;
  }>();

  const busId = Array.isArray(params.busId) ? params.busId[0] : params.busId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<BusLiveStatus | null>(null);
  const [path, setPath] = useState<Coord[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Coord | null>(null);
  const [submittingSubscription, setSubmittingSubscription] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const normalizedStops = useMemo(() => live?.stops ?? [], [live?.stops]);

  useEffect(() => {
    if (!busId) {
      setLoading(false);
      setError("Bus id is missing");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [liveData, subscriptions] = await Promise.all([
          getUserBusLive(String(busId)),
          getUserSubscriptions(),
        ]);

        setLive(liveData);
        setIsSubscribed(
          subscriptions.some((s) => String(s.busId) === String(busId)),
        );

        if (liveData.currentLat != null && liveData.currentLng != null) {
          setCurrentLocation({
            latitude: liveData.currentLat,
            longitude: liveData.currentLng,
          });
        }

        if (liveData.encodedPolyline) {
          const decoded = polyline.decode(liveData.encodedPolyline) as [
            number,
            number,
          ][];
          setPath(
            decoded.map(([latitude, longitude]) => ({ latitude, longitude })),
          );
        }
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            err?.message ??
            "Failed to load live bus",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [busId]);

  useEffect(() => {
    if (!busId) return;

    const token = authStore.token ?? undefined;
    socketService.connect(API_BASE_URL, token);

    socketService
      .waitUntilConnected(5000)
      .then((ok) => {
        if (!ok) return;
        socketService.emit("joinBusRoom", String(busId));
      })
      .catch(() => {
        // no-op
      });

    const onBusLocationUpdate = (payload: unknown) => {
      const event = payload as {
        busId?: string;
        bus?: { id?: string; _id?: string };
        location?: {
          latitude?: number;
          longitude?: number;
          lat?: number;
          lng?: number;
        };
        latitude?: number;
        longitude?: number;
        lat?: number;
        lng?: number;
        nextStop?: string;
        estimatedArrival?: string;
      };

      const eventBusId =
        event.busId ?? event.bus?.id ?? event.bus?._id ?? undefined;

      if (eventBusId && String(eventBusId) !== String(busId)) return;

      const latitude =
        event.latitude ??
        event.lat ??
        event.location?.latitude ??
        event.location?.lat;
      const longitude =
        event.longitude ??
        event.lng ??
        event.location?.longitude ??
        event.location?.lng;

      if (typeof latitude === "number" && typeof longitude === "number") {
        setCurrentLocation({ latitude, longitude });
      }

      setLive((prev) =>
        prev
          ? {
              ...prev,
              currentLat: latitude ?? prev.currentLat,
              currentLng: longitude ?? prev.currentLng,
              nextStop: event.nextStop ?? prev.nextStop,
              estimatedArrival: event.estimatedArrival ?? prev.estimatedArrival,
            }
          : prev,
      );
    };

    socketService.on("busLocationUpdate", onBusLocationUpdate);

    return () => {
      socketService.off("busLocationUpdate");
    };
  }, [busId]);

  const subscribeForAlerts = async () => {
    if (!busId || submittingSubscription || isSubscribed) return;

    setSubmittingSubscription(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      let userLatitude: number | undefined;
      let userLongitude: number | undefined;

      if (permission.granted) {
        const current = await Location.getCurrentPositionAsync({});
        userLatitude = current.coords.latitude;
        userLongitude = current.coords.longitude;
      }

      await createUserSubscription({
        busId,
        notifyOnBusStart: true,
        notifyOnNearStop: true,
        userLatitude: userLatitude ?? 17.4012,
        userLongitude: userLongitude ?? 78.5123,
        nearRadiusMeters: 120,
      });

      setIsSubscribed(true);
    } catch {
      // keep view usable even if subscription fails
    } finally {
      setSubmittingSubscription(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F2F4F8]">
        <ActivityIndicator size="large" color="#1847BA" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F2F4F8] px-8">
        <MaterialCommunityIcons name="bus-alert" size={56} color="#EF4444" />
        <Text className="mt-4 text-center text-[20px] font-semibold text-red-600">
          {error}
        </Text>
      </SafeAreaView>
    );
  }

  const nextStop = live?.nextStop ?? "Main Street & 5th Ave";
  const eta = live?.estimatedArrival ?? "3 mins away";
  const scheduled = live?.estimatedArrival ?? "08:42 AM";

  return (
    <SafeAreaView className="flex-1 bg-[#F2F4F8]">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>
        <Text
          className="flex-1 text-base font-extrabold text-slate-900"
          numberOfLines={1}
        >
          {params.plate
            ? `Bus ${params.plate} Live Tracking`
            : "Bus Live Tracking"}
        </Text>
        <Pressable
          onPress={() => router.push("/(user)/alerts" as any)}
          className="mr-2"
        >
          <Ionicons name="notifications-outline" size={22} color="#1847BA" />
        </Pressable>
        <Pressable>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#334155"
          />
        </Pressable>
      </View>

      {/* Map */}
      <View className="h-[280px] w-full">
        {path.length > 1 ? (
          <RouteMap
            coordinates={path}
            currentLocation={currentLocation ?? undefined}
            stops={normalizedStops
              .filter((stop) => stop.lat != null && stop.lng != null)
              .map((stop) => ({
                latitude: stop.lat!,
                longitude: stop.lng!,
                name: stop.name,
              }))}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-slate-200">
            <Text className="text-sm text-slate-500">Map unavailable</Text>
          </View>
        )}

        <View className="absolute right-3 top-20 gap-2">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <Feather name="crosshair" size={18} color="#334155" />
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <Ionicons name="add" size={20} color="#334155" />
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <Ionicons name="remove" size={20} color="#334155" />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 10,
        }}
      >
        {/* ETA card */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4">
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
              <Ionicons name="time" size={22} color="#1847BA" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs text-slate-500">Next Stop Arrival</Text>
              <Text className="mt-0.5 text-lg font-extrabold text-[#1847BA]">
                {eta}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-slate-500">Scheduled</Text>
              <Text className="text-base font-bold text-slate-900">
                {scheduled}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-xs text-slate-600">Next: {nextStop}</Text>
            <Pressable
              className={`rounded-full px-3 py-1.5 flex-row items-center gap-1.5 ${
                isSubscribed ? "bg-emerald-100" : "bg-[#E3EBFF]"
              }`}
              onPress={subscribeForAlerts}
              disabled={submittingSubscription || isSubscribed}
            >
              {submittingSubscription ? (
                <ActivityIndicator size="small" color="#1847BA" />
              ) : (
                <>
                  <Ionicons
                    name={
                      isSubscribed ? "notifications" : "notifications-outline"
                    }
                    size={14}
                    color={isSubscribed ? "#15803D" : "#1847BA"}
                  />
                  <Text
                    className={`text-[11px] font-bold ${
                      isSubscribed ? "text-emerald-700" : "text-[#1847BA]"
                    }`}
                  >
                    {isSubscribed ? "Subscribed" : "Subscribe"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Stop progress */}
        <View className="mt-3 rounded-2xl border border-slate-200 bg-white">
          <Text className="px-4 py-3 text-xs font-extrabold tracking-widest text-slate-900 border-b border-slate-200">
            CURRENT PROGRESS
          </Text>

          <View className="px-4 py-4">
            {normalizedStops.length === 0 ? (
              <Text className="text-sm text-slate-500">
                No stop data available
              </Text>
            ) : (
              normalizedStops.slice(0, 3).map((stop: DriverStop, index) => {
                const isNext = stop.name === live?.nextStop || index === 1;
                const isPassed = index === 0;

                return (
                  <View
                    key={stop.id ?? `${stop.name ?? "stop"}-${index}`}
                    className="flex-row mb-3"
                  >
                    <View className="mr-3 items-center" style={{ width: 16 }}>
                      <View
                        className={`h-3.5 w-3.5 rounded-full border-2 ${
                          isNext
                            ? "border-[#1847BA] bg-[#1847BA]"
                            : isPassed
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-slate-300 bg-white"
                        }`}
                      />
                      {index < Math.min(normalizedStops.length, 3) - 1 && (
                        <View className="mt-1 w-0.5 h-10 bg-slate-200" />
                      )}
                    </View>

                    <View className="flex-1">
                      <Text
                        className={`text-sm ${
                          isNext
                            ? "font-extrabold text-slate-900"
                            : "text-slate-600"
                        }`}
                      >
                        {stop.name ?? `Stop ${index + 1}`}
                      </Text>
                      <Text
                        className={`text-xs ${
                          isNext
                            ? "font-semibold text-[#1847BA]"
                            : isPassed
                              ? "text-slate-400"
                              : "text-slate-500"
                        }`}
                      >
                        {isNext
                          ? "Next Stop"
                          : isPassed
                            ? "Passed"
                            : "Upcoming"}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom navigation */}
      <View className="flex-row items-center justify-around border-t border-slate-200 bg-white py-2.5">
        <Pressable
          className="items-center"
          onPress={() => router.replace("/(user)/home" as any)}
        >
          <Ionicons name="home-outline" size={22} color="#94A3B8" />
          <Text className="mt-0.5 text-[11px] font-bold tracking-wide text-slate-400">
            HOME
          </Text>
        </Pressable>
        <Pressable
          className="items-center"
          onPress={() => router.push("/(user)/alerts" as any)}
        >
          <Ionicons name="notifications-outline" size={22} color="#94A3B8" />
          <Text className="mt-0.5 text-[11px] font-bold tracking-wide text-slate-400">
            ALERTS
          </Text>
        </Pressable>
        <Pressable
          className="items-center"
          onPress={() => router.push("/(user)/profile" as any)}
        >
          <Ionicons name="person-outline" size={22} color="#94A3B8" />
          <Text className="mt-0.5 text-[11px] font-bold tracking-wide text-slate-400">
            PROFILE
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
