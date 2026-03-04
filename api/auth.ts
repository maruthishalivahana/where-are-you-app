import apiClient from "./client";
import { LoginRequest, LoginResponse } from "./types";

export interface RefreshRequest {
  refreshToken?: string;
}

export const loginMember = async (payload: LoginRequest) => {
  return apiClient.post<LoginResponse | Record<string, any>>(
    "/api/auth/member/login",
    payload,
  );
};

export const logoutUser = async () => {
  return apiClient.post("/api/auth/logout/user");
};

export const logoutGeneric = async () => {
  return apiClient.post("/api/auth/logout");
};

export const refreshAuth = async (payload?: RefreshRequest) => {
  return apiClient.post("/api/auth/refresh", payload ?? {});
};
