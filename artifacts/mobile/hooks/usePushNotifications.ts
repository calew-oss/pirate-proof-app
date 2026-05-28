import * as Notifications from "expo-notifications";
import { useRegisterPushToken } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter();
  const { mutate: registerToken } = useRegisterPushToken();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;

    let mounted = true;

    async function registerForPushNotifications() {
      try {
        const existing = await Notifications.getPermissionsAsync() as any;
        if (existing.status !== "granted") {
          const result = await Notifications.requestPermissionsAsync() as any;
          if (result.status !== "granted") return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_REPL_ID ?? undefined,
        });

        if (mounted) {
          registerToken({ data: { token: tokenData.data } });
        }
      } catch {
        // Non-fatal: push notifications unavailable (simulator, etc.)
      }
    }

    registerForPushNotifications();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notification banner is shown automatically via setNotificationHandler
      },
    );

    // Navigate when user taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        const screen = data?.screen as string | undefined;
        const deliveryId = data?.deliveryId as number | undefined;

        if (screen === "delivery" && deliveryId) {
          router.push(`/delivery/${deliveryId}` as any);
        } else if (screen === "lock") {
          router.push("/(tabs)/lock" as any);
        } else if (screen === "deliveries") {
          router.push("/(tabs)/deliveries" as any);
        }
      },
    );

    return () => {
      mounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);
}
