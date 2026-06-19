import webpush from "web-push";

webpush.setVapidDetails(
  `mailto:${process.env.RESEND_FROM_EMAIL ?? "admin@shakasaves.finance"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<void> {
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}

export { webpush };
