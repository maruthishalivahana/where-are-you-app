import { autorun } from "mobx";
import { useEffect, useState } from "react";
import { loginMember } from "../api/auth";
import { API_BASE_URL } from "../api/client";
import { LoginRequest } from "../api/types";
import authStore from "../store/auth";

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirror MobX observables into React state so components re-render
  const [isHydrated, setIsHydrated] = useState(authStore.isHydrated);
  const [user, setUser] = useState(authStore.user);
  const [token, setToken] = useState(authStore.token);
  const [isAuthenticated, setIsAuthenticated] = useState(
    authStore.isAuthenticated,
  );

  useEffect(() => {
    authStore.initializeAuth();
  }, []);

  useEffect(() => {
    const dispose = autorun(() => {
      setIsHydrated(authStore.isHydrated);
      setUser(authStore.user);
      setToken(authStore.token);
      setIsAuthenticated(authStore.isAuthenticated);
    });
    return dispose;
  }, []);

  const login = async (credentials: LoginRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await loginMember(credentials);

      const body = response.data as Record<string, any>;
      const nested =
        (body?.data as Record<string, any> | undefined) ??
        (body?.result as Record<string, any> | undefined) ??
        {};

      const tokenFromBody =
        body?.token ??
        body?.accessToken ??
        body?.authToken ??
        nested?.token ??
        nested?.accessToken ??
        nested?.authToken;

      const authHeader =
        (response.headers?.authorization as string | undefined) ??
        (response.headers?.Authorization as string | undefined);
      const tokenFromHeader = authHeader?.startsWith("Bearer ")
        ? authHeader.replace("Bearer ", "")
        : authHeader;

      const token = tokenFromBody ?? tokenFromHeader ?? null;

      const userSource =
        body?.user ??
        body?.member ??
        body?.driver ??
        body?.profile ??
        nested?.user ??
        nested?.member ??
        nested?.driver ??
        nested?.profile ??
        null;

      const normalizedUser = {
        id:
          userSource?.id ??
          userSource?.memberId ??
          userSource?._id ??
          credentials.memberId,
        name:
          userSource?.name ??
          userSource?.fullName ??
          userSource?.memberName ??
          credentials.memberId,
        role: userSource?.role ?? credentials.role,
      };

      if (!normalizedUser.id || !normalizedUser.role) {
        const message = "Invalid login response from server";
        setError(message);
        return { success: false as const, error: message };
      }

      if (token) {
        await authStore.setToken(token);
      }
      await authStore.setUser(normalizedUser);
      return { success: true as const, data: response.data };
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        (err.request && !err.response
          ? `Cannot reach backend server at ${API_BASE_URL}. Ensure backend listens on 0.0.0.0:3000 and phone + laptop are on same Wi-Fi.`
          : "Login failed");
      setError(message);
      return { success: false as const, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authStore.clearAuth();
  };

  return {
    login,
    logout,
    loading,
    error,
    user,
    token,
    isAuthenticated,
    isHydrated,
  };
};
