# Building the Android APK

The source archive has no `android/` folder; Flutter generates it. Easiest path: GitHub Actions (`.github/workflows/android-apk.yml`).

1. Push this project to a private GitHub repo. In `backend/`, run `npm install` once and **commit `package-lock.json`**.
2. Create a release keystore (keep it and its passwords backed up; losing it means you can never update the app):
   `keytool -genkeypair -v -keystore release.jks -alias ziarat -keyalg RSA -keysize 2048 -validity 10000`
   then `base64 -w0 release.jks` for the secret.
3. Repo secrets: `ZIARAT_API_URL` (must be **https**), `ZIARAT_PRIVY_APP_ID`, `ZIARAT_PRIVY_CLIENT_ID`,
   `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. In the Privy dashboard register the Android app id (`com.ziarat.ziarat` unless you changed `--org`) for the client id.
5. Run the workflow. It analyzes, tests, builds, signs and verifies; download `ziarat-release.apk` from the run's artifacts.

Local alternative: `flutter create --platforms=android --org com.ziarat --project-name ziarat .`, set `minSdk 26` in
`android/app/build.gradle*`, then `flutter build apk --release --dart-define=...` and sign with `apksigner`.
For the Play Store build an `.aab` (`flutter build appbundle`) instead.
Release builds refuse to start without the Privy defines (no unauthenticated demo shell).
