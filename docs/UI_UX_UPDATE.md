# UI/UX update — Ziarat Pro

The app is being aligned to the supplied 12-screen Ziarat Pro visual reference: dark evergreen surfaces, emerald primary actions, premium gradient balance cards, rounded panels, clean typography, and the Home / Assets / Pay / Cards / Profile navigation.

The latest code pass updates the global palette, applies the branded theme at the auth entry point, polishes login branding, and adds styled preview sheets for the main money actions. Existing authentication, crypto-flow, API client, and backend integration files are preserved.

See `DEVELOPER_UI_HANDOFF.md` for the detailed screen-by-screen status, design tokens, safeguards, and acceptance checklist.

Important: the supplied reference image contains illustrative balances and card details. Do not copy those values into live UI. Show connected account data or explicitly labelled demo data only. The money-action sheets are previews, not live payment processing.

## Premium fintech refinement pass (2026-10-12)

- Added a balance-visibility toggle to the Home dashboard, a standard privacy affordance in consumer finance apps.
- The toggle masks the total, fiat, and crypto summary values together; it does not alter account data or backend state.
- Kept Ziarat's established deep-green/emerald identity, rounded surfaces, and five-tab navigation. No new brand direction was introduced.
- Money movement remains preview-only unless a real provider-backed flow is implemented, tested, and explicitly enabled.
