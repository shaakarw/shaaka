# Mobile push notifications

Shaaka uses Expo Push Service with `expo-notifications`. The Expo project ID is already configured in `frontend/app.json`; the backend sends only to authenticated Expo push tokens registered by the app. No Firebase Admin service-account key or APNs key belongs in the backend or frontend source.

## Production credentials

Before creating production builds:

1. Confirm the iOS bundle identifier in `frontend/app.json` matches the identifier intended for App Store distribution.
2. Configure Android FCM v1 credentials and an iOS APNs authentication key for the Shaaka EAS project using EAS Credentials. Expo Push Service uses those credentials to deliver the notifications.
3. Configure the matching Firebase Android application for `com.anonymous.shaaka` and provide its `google-services.json` as a secure EAS file environment variable named `GOOGLE_SERVICES_JSON`. `frontend/app.config.js` passes that file to Expo's native configuration.
4. If Expo push security is enabled for the project, set the Expo access token as the backend-only `EXPO_ACCESS_TOKEN` environment variable. It is optional otherwise.
5. Rebuild the native app after adding or changing notification configuration. Expo Go is not a production push target; use an EAS development or production build on physical devices.

Do not add Firebase service-account JSON, APNs keys, or the Expo access token to the frontend bundle, `app.json`, or version control. The backend retries transient deliveries from the Turso notification queue and deactivates tokens reported as unregistered by Expo.

## Device and delivery behavior

Authenticated Android/iOS clients request notification permission, obtain an Expo push token, register it against their account and stable device ID, and refresh it when Expo reports a token change, connectivity returns, or the app resumes. Logout deactivates only that account's registration on the current device. Android channels are created for messages, social activity, marketplace, orders, and account notifications, with sound/vibration variants following user preferences. On iOS, notification sound/vibration behavior remains subject to iOS notification settings.

Message push bodies intentionally omit message contents so lock-screen previews do not expose private text or media. Notification data carries the destination and IDs needed to open the corresponding conversation or item. Socket.IO remains responsible for live in-app updates.
