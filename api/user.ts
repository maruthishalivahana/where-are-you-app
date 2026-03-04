import apiClient from "./client";
import {
    BusLiveStatus,
    BusSearchResult,
    UserNotification,
    UserSubscription,
    UserSubscriptionRequest,
} from "./types";

const unwrap = <T>(data: T | { data?: T } | { result?: T }): T => {
  if (
    data &&
    typeof data === "object" &&
    "data" in (data as Record<string, unknown>)
  ) {
    return ((data as { data?: T }).data ?? data) as T;
  }

  if (
    data &&
    typeof data === "object" &&
    "result" in (data as Record<string, unknown>)
  ) {
    return ((data as { result?: T }).result ?? data) as T;
  }

  return data as T;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeSearchItem = (item: any): BusSearchResult | null => {
  const busId =
    item?.busId ??
    item?.id ??
    item?._id ??
    item?.bus?._id ??
    item?.bus?.id ??
    null;

  const numberPlate =
    item?.numberPlate ?? item?.plateNumber ?? item?.bus?.numberPlate ?? null;

  if (!busId || !numberPlate) {
    return null;
  }

  return {
    busId: String(busId),
    numberPlate: String(numberPlate),
    routeName: String(
      item?.routeName ?? item?.route?.name ?? item?.bus?.routeName ?? "Route",
    ),
    isActive: Boolean(item?.isActive ?? item?.active ?? item?.isLive),
  };
};

const normalizeLive = (payload: any): BusLiveStatus => {
  const currentLat =
    toNumber(payload?.currentLat) ??
    toNumber(payload?.lat) ??
    toNumber(payload?.currentLocation?.lat) ??
    toNumber(payload?.currentLocation?.latitude) ??
    null;

  const currentLng =
    toNumber(payload?.currentLng) ??
    toNumber(payload?.lng) ??
    toNumber(payload?.currentLocation?.lng) ??
    toNumber(payload?.currentLocation?.longitude) ??
    null;

  return {
    busId: String(
      payload?.busId ?? payload?.id ?? payload?._id ?? payload?.bus?._id ?? "",
    ),
    numberPlate: String(
      payload?.numberPlate ??
        payload?.plateNumber ??
        payload?.bus?.numberPlate ??
        "",
    ),
    routeName: String(
      payload?.routeName ??
        payload?.route?.name ??
        payload?.bus?.routeName ??
        "Route",
    ),
    encodedPolyline: String(
      payload?.encodedPolyline ?? payload?.route?.encodedPolyline ?? "",
    ),
    stops: Array.isArray(payload?.stops)
      ? payload.stops
      : Array.isArray(payload?.route?.stops)
        ? payload.route.stops
        : [],
    currentLat,
    currentLng,
    nextStop: payload?.nextStop ?? payload?.nextStopName ?? null,
    estimatedArrival: payload?.estimatedArrival ?? payload?.eta ?? null,
    isActive: Boolean(payload?.isActive ?? payload?.active ?? true),
  };
};

const pickArray = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const directKeys = ["buses", "items", "docs", "rows", "results", "list"];
  for (const key of directKeys) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value;
  }

  const nested = payload?.data ?? payload?.result ?? payload?.payload;
  if (nested && nested !== payload) {
    return pickArray(nested);
  }

  return [];
};

export const searchUserBuses = async (numberPlate: string) => {
  const normalized = numberPlate.trim().toUpperCase();

  const response = await apiClient.get<
    BusSearchResult[] | { data?: BusSearchResult[] }
  >("/api/user/buses/search", {
    params: {
      numberPlate: normalized,
      q: normalized,
      plate: normalized,
    },
  });

  const raw = response.data as any;
  const payload = unwrap<any>(raw);
  const list = pickArray(payload);

  const normalizedResults = list
    .map((item: any) => normalizeSearchItem(item))
    .filter((item: BusSearchResult | null): item is BusSearchResult =>
      Boolean(item),
    );

  return normalizedResults;
};

export const getUserBusLive = async (busId: string) => {
  const response = await apiClient.get<
    BusLiveStatus | { data?: BusLiveStatus }
  >(`/api/user/buses/${busId}/live`);

  const raw = response.data as any;
  const payload = unwrap<any>(raw);
  return normalizeLive(payload);
};

export const createUserSubscription = async (
  payload: UserSubscriptionRequest,
) => {
  const response = await apiClient.post<
    UserSubscription | { data?: UserSubscription }
  >("/api/user/subscriptions", payload);
  return unwrap<UserSubscription>(response.data as any);
};

export const getUserSubscriptions = async () => {
  const response = await apiClient.get<
    UserSubscription[] | { data?: UserSubscription[] }
  >("/api/user/subscriptions");
  const payload = unwrap<UserSubscription[]>(response.data as any);
  return Array.isArray(payload) ? payload : [];
};

export const deleteUserSubscription = async (subscriptionId: string) => {
  return apiClient.delete(`/api/user/subscriptions/${subscriptionId}`);
};

export const patchUserFcmToken = async (fcmToken: string) => {
  return apiClient.patch("/api/user/profile/fcm-token", { fcmToken });
};

export const getUserNotifications = async () => {
  const response = await apiClient.get<
    UserNotification[] | { data?: UserNotification[] }
  >("/api/user/notifications");
  const payload = unwrap<UserNotification[]>(response.data as any);
  return Array.isArray(payload) ? payload : [];
};

export const markUserNotificationRead = async (notificationId: string) => {
  return apiClient.patch(`/api/user/notifications/${notificationId}/read`);
};
