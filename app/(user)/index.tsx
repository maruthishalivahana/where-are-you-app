import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";

export default function UserIndexRedirect() {
  const { isAuthenticated, isHydrated, user } = useAuth();

  if (!isHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(driver)/login" />;
  }

  return (
    <Redirect
      href={user?.role === "user" ? "/(user)/home" : "/(driver)/home"}
    />
  );
}
