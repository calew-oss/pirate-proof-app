const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export async function sendPushNotification(
  expoPushToken: string | null | undefined,
  message: PushMessage,
): Promise<void> {
  if (!expoPushToken) return;
  if (!expoPushToken.startsWith("ExponentPushToken[")) return;

  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: expoPushToken,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: message.sound ?? "default",
        badge: message.badge,
      }),
    });
  } catch (err) {
    // Non-fatal — push failures shouldn't crash the server
  }
}

export async function sendPushToUsers(
  tokens: (string | null | undefined)[],
  message: PushMessage,
): Promise<void> {
  const valid = tokens.filter(
    (t): t is string => !!t && t.startsWith("ExponentPushToken["),
  );
  if (valid.length === 0) return;

  // Batch up to 100 per Expo recommendation
  const chunks: string[][] = [];
  for (let i = 0; i < valid.length; i += 100) {
    chunks.push(valid.slice(i, i + 100));
  }

  await Promise.all(
    chunks.map((chunk) =>
      fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(
          chunk.map((to) => ({
            to,
            title: message.title,
            body: message.body,
            data: message.data ?? {},
            sound: message.sound ?? "default",
            badge: message.badge,
          })),
        ),
      }).catch(() => {}),
    ),
  );
}
