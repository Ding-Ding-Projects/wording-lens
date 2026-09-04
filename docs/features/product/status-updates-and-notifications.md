# Status and notifications

Wording Lens will provide a live status surface for the current task and a
notification center for application events. Status is evidence-backed, not a
summary of intent. Every state carries a text label, a meaningful emoji, a
last-updated time, the current baseline, active work, evidence links, and next
checks.

## Live status

When the shared status service is reachable, it is the primary status record.
The page shows real commits, test results, build or release links, captures,
and whether each item is running, waiting, blocked, failed, or verified. It is
interactive, keyboard and touch accessible, responsive from about 320 pixels,
and usable from a phone. A fresh project record is created for each session.

If the shared service is unreachable, the application publishes a local
interactive fallback and states the exact limitation. A loopback or local file
is not described as phone-accessible. Questions use a real reply route when
available. A fallback card never pretends to deliver an answer.

The Discord bridge is another window onto the same status record. It writes
answers into the shared session inbox and the application confirms delivery by
polling that inbox. It never becomes a second record, reads credentials, or
acts with application authority.

## Notifications

Informational, progress, success, and non-decision error messages appear as
non-blocking toasts or snackbars in a screen corner. They stack without
overlap. Informational messages auto-dismiss; errors and warnings remain until
dismissed. Optional actions include retry, undo, open, and view details.
Blocking dialogs are reserved for decisions such as destructive confirmation,
unsaved changes, credentials, or consent.

Dismissed notifications remain in the reviewable notification center. The
center has search, date and state filters, multi-select, scoped select-all,
inverse selection, bulk dismiss, destructive bulk delete, and export. The
current filter is preserved in the export. Every row keeps an accessible name,
state, timestamp, and action result.

## Failure modes and security

Pending is not verified, and no emoji upgrades it. A failed destination does
not suppress later status destinations. Credentials, private wording, prompt
content, environment values, and unrelated paths never enter status payloads,
notifications, captures, exports, or public records. A question control is not
shown as delivered until the session inbox confirms it.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, the status
surface, bridge, notification store, and review center are not implemented and
have no focused tests or packaged captures. Future work must prove current
state, delivery, fallback honesty, filtering, bulk actions, accessibility,
responsive layout, and privacy.

## Suggested articles

- [Product overview](overview.md)
- [Search, navigation, and tabs](search-navigation-and-tabs.md)
- [Release surface](../release/build-package-and-publish.md)
