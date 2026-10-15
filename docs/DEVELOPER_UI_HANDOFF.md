# Ziarat Pro — UI/UX Developer Handoff

## Objective
Polish the existing Flutter application to follow the supplied 12-screen Ziarat reference: premium dark fintech UI, near-black green backgrounds, emerald highlights, soft green gradients, rounded cards, compact typography, and clear five-item bottom navigation.

## Visual system
- App background: `#03100C`
- Surface / cards: `#0A1D16`
- Secondary surface: `#102A20`
- Primary emerald: `#18E6A4`
- Soft mint: `#70F4C5`
- Border: `#194B39`
- Main text: white; secondary text: white at 54–65% opacity
- Cards: 16–26 px corner radii, subtle 1 px green border, restrained shadow
- Primary buttons: emerald fill, dark-green label, bold text, 52 px minimum height
- Navigation: Home, Assets, Pay, Cards, Profile; persistent dark bottom bar

## Changes made in this pass
- Applied the Ziarat dark/emerald theme to the app entry point as well as the app theme. Previously, the auth entry could bypass the `ZiaratApp` theme.
- Refined the login branding and email field hints/autofill.
- Updated the palette to a more consistent deep-green / emerald system.
- Replaced the Home quick-action alert-only taps with a styled action sheet for Add Money, Send, Receive, and Exchange.
- Kept these payment actions clearly marked as preview-only; they must not imply that money movement is live.
- Preserved the existing authentication, crypto wallet, API client, models, and backend code.

## Screen map vs reference
1. Splash / Login — branded login is present; a dedicated animated globe splash is still a design task.
2. Home Dashboard — present; current balances intentionally remain zero until connected data is available.
3. Fiat Assets — present.
4. Crypto Assets — existing API-backed crypto page is preserved.
5. Add Money — current styled action sheet; build the dedicated screen before production.
6. Send Money — current styled action sheet; build recipient, amount, review, and confirmation screens.
7. Receive Money — current styled action sheet; connect bank details / QR generation to verified backend data.
8. Exchange / Convert — current selection sheet; connect FX quote, expiry, fee, and confirmation states.
9. Crypto Swap — existing backend/API contract must be extended for quote, slippage, approval, and swap status UI.
10. Cards — visual card preview exists; issuance and card controls need an issuer integration.
11. Payments Hub — service grid exists; connect each service to a real flow or label it unavailable.
12. Profile & Settings — profile/settings list exists; each row needs its own real screen and account-backed status.

## Non-negotiable product safeguards
- Do not use reference-image sample balances as real customer data. Use actual API balances or explicit demo-mode labels.
- Do not hardcode card numbers, bank account details, wallet addresses, exchange rates, fees, or transaction history as live data.
- Do not show “Verified” or KYC-complete states unless the backend confirms them.
- Payment, FX, card, crypto, and payout actions must stay disabled or preview-only until provider, compliance, risk, and settlement workflows are configured and tested.
- Never put provider secrets in Flutter source. Keep them on the backend.
- Validate crypto network and asset before allowing send/withdrawal; show fees, final amount, and a review/confirmation step.

## Developer acceptance checklist
- [ ] Run `flutter pub get` and `flutter analyze` on the team's target Flutter SDK.
- [ ] Test small Android screens, larger Android screens, keyboard-open states, and safe areas.
- [ ] Compare all 12 screens against the supplied reference image at the same viewport size.
- [ ] Ensure each tappable control has a real destination or is clearly disabled.
- [ ] Add loading, empty, error, offline, and retry states to all API-backed screens.
- [ ] Use accessible contrast and minimum 44–48 px touch targets.
- [ ] Add screenshot/golden tests for login, home, fiat assets, crypto assets, cards, payments, and profile.
- [ ] Verify auth gate, logout, expired sessions, and backend-unavailable behavior.
- [ ] Complete security review, provider certification, compliance review, and end-to-end sandbox tests before production release.

## Current limitation
This pass is a UI polish and handoff update, not a production certification. The environment used to prepare the files did not have Flutter/Dart installed, so the project could not be run through `flutter analyze` or on-device rendering here. The developer should run those checks before merging.


## UI polish update (2026-10-09)

### Theme tokens
- App background: `#03100C`
- Surface/card: `#0A1D16`
- Raised surface: `#102A20`
- Primary emerald: `#18E6A4`
- Soft mint highlight: `#70F4C5`
- Border: `#194B39`

### Interaction update
- Dashboard quick actions open a dedicated full-screen money-flow interface.
- Payments hub tiles open relevant flow previews instead of remaining inert.
- Flow screens include method selection, currency selection, amount validation, recipient validation for send flows, and a review sheet.
- All money flows explicitly state that they are demo previews and do not submit transactions or move funds.

### Reference alignment checklist
- Keep dark emerald surfaces, restrained gradients, rounded 16–26 px cards, and bright emerald primary actions.
- Test on a 390 × 844 logical-pixel phone and a smaller Android device.
- Compare all 12 reference screens side-by-side with emulator screenshots.
- Replace demo balance values only with authenticated, server-derived balances.
- Replace demo receiving details with account/provider-issued details; never manufacture QR codes, account numbers, or deposit addresses.
- Add loading, empty, validation-error, network-error, and success states before production.
- Run `flutter pub get`, `dart format lib`, `flutter analyze`, and `flutter test` on a machine with Flutter installed.
- Complete payment-provider, KYC/AML, security, reconciliation, and legal reviews before enabling real money movement.

### Current limitation
This package improves the Flutter UI and prototype interactions, but a pixel-perfect screenshot match and successful Flutter build cannot be certified in this environment because Flutter/Dart SDK and emulator testing are unavailable here. Provider-dependent money movement remains intentionally disabled.
