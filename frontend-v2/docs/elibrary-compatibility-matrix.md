# E-Library Compatibility Matrix

Supported environments for the catalog, readers, scanner input, wallet
payment, and keyboard/screen-reader journeys.

| Area | Supported | Target breakpoint | Fallback |
| --- | --- | --- | --- |
| Browsers | Latest 2 versions of Chrome, Firefox, Safari, Edge | Desktop 1280px+ | Show unsupported-browser banner |
| Mobile devices | iOS Safari, Android Chrome (last 2 major OS versions) | 360px – 767px | Responsive stacked layout |
| Tablet | iPadOS Safari, Android Chrome | 768px – 1024px | Responsive grid layout |
| E-reader/EPUB viewer | Chromium-based only | N/A | Redirect to PDF fallback |
| Wallet payment | Freighter, Albedo (Stellar) | N/A | Show "wallet unsupported" state with manual payment link |
| Barcode/scanner input | USB HID scanners emulating keyboard input | N/A | Manual ISBN entry field |
| Keyboard navigation | Full tab/enter/escape support on catalog, reader, circulation desk | N/A | N/A — required, no fallback |
| Screen readers | NVDA + Chrome, VoiceOver + Safari | N/A | ARIA live regions for async state changes |

Known exceptions are tracked as follow-up issues linked from this file as
they're discovered; none are currently open.
