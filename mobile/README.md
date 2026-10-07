# SANKALP BMS Mobile

Android-first mobile application for the SANKALP Business Management System.

## Baseline

- Expo SDK 57 / React Native 0.86
- Android application ID: `com.sankalgroup.bms`
- Existing Supabase backend: `tbfzxmbvzpszjldupycy`
- Existing web BMS remains the source of truth for business logic and permissions.
- Firebase configuration is intentionally not duplicated here until the existing Firebase project/app configuration is audited and the correct `google-services.json` is supplied.

## Development

1. Install Node.js 20.19+.
2. Copy `.env.example` to `.env`.
3. Add the existing Supabase anon key.
4. Install dependencies.
5. Run `npx expo start`.
6. Use an Android development build for native features such as biometrics and push notifications.

## Android APK

The `apk` EAS profile is configured for an installable Android APK.

```bash
eas build --platform android --profile apk
```

For Google Play distribution, use the production profile to create an Android App Bundle (AAB).

## Safety

Do not place Supabase service-role keys, Google OAuth client secrets, Firebase private keys, or other server credentials in this mobile project.

Do not modify the production database/schema as part of mobile UI work without a separate reviewed migration.
