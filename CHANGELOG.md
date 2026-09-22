# Changelog

Repository history and prior documentation are the source for the entries below.

## 3.6.0 — Unreleased

- Replaced Google Sheets toast/DOM handoff detection with an explicit Apps Script dialog link.
- Removed Google Sheets content-script access, frame/polling logic, background tab launching, approved-sheet storage, and their obsolete tests.
- Removed the temporary PowerSchool settings-capture tool and its stored-capture UI.
- Retained PowerSchool hash processing, authentication resume, Demographics navigation, SCC/ECC preparation, configured dates and tags, note preservation, and manual submission.

## 3.5.2 — 2026-09-21

- Improved detection of missed Google Sheets handoff toasts and intentional retry handling.
- Added live-region fallback and short cross-frame duplicate-guard tests.

## 3.5.1 — 2026-09-21

- Prevented handoff replay after a Sheets reload.
- Deduplicated reports from multiple Google Sheets frames.

## 3.5.0 — 2026-09-21

- Applied configured Date & Time, Incident Date, and Action Date fields.
- Added SCC Attempt-number tag selection and tests.

## 3.4.2 — 2026-09-21

- Matched canonical Attempt labels to PowerSchool labels containing parenthetical codes.
- Added capture support and tests for coded Attempt options.

## 3.4.1 — 2026-09-21

- Added value-free date-field and Attempt-tag diagnostics to the temporary capture tool.

## 3.4.0 — 2026-09-21

- Read Type, Subtype, optional dropdown, date, and tag settings from roster handoffs.
- Added support for Sheets editor frames, including inherited `about:blank` frames.

## 3.3.6 — 2026-09-21

- Added explicit support and tests for Chrome `about:blank` Sheets handoff frames.

## 3.3.5 — 2026-09-21

- Persisted handoff deduplication across background-worker restarts.

## 3.3.4 — 2026-09-20

- Extended cross-frame deduplication for the lifetime of a visible handoff toast.

## 3.3.3 — 2026-09-20

- Added multi-frame and toast-region handoff detection with polling fallback tests.

## 3.3.2 — 2026-09-20

- Removed reliance on Google Sheets page DOM globals in the watcher.

## 3.3.1 — 2026-09-20

- Added the 6Roster workbook to the extension's then-current default approved sheets.

## 3.2.3 — 2026-09-19

- Preserved pending handoffs through PowerSchool sign-in and resumed them after authentication.
- Added Demographics navigation from Call Entry.

## 3.1.1 — 2026-09-18

- Improved ECC handoff status reporting and split-toast detection.
