# Product overview

Wording Lens is planned as a local-first Windows operations cockpit for
projects, tasks, files, builds, releases, local services, and external tools.
The application should remain useful without a network connection for local
records and bundled documentation. Optional integrations must state their
connection, permissions, and failure state instead of turning an unavailable
service into an empty spinner.

## Front screen and provenance

The first screen will show the running version and the version's recorded
updated-at date and local time, including seconds and a timezone label. These
values come from build or release provenance attached to the running package.
Launch time and file timestamps are not acceptable substitutes. Missing or
invalid provenance is shown as unavailable. The values are visible before
authentication, settings, or navigation and remain accessible to assistive
technology.

## Operations cockpit

The cockpit will provide truthful empty states and guided paths for opening a
project, inspecting files, starting a build, reviewing a release, and handing
an export to an external editor. Long operations report progress where they
start, disable the submitting control, refuse re-entry in the handler, and
provide cancellation and recovery at the same surface. A failed operation
states the exact next action that is safe to try.

## Scheduled settings

Settings that can be changed by the application can also be scheduled. A rule
has a stable identifier, label, enabled state, optional date range, local-time
window, and either every weekday or an explicit weekday set. The editor shows
the configured timezone and daylight-saving behavior. Equal boundaries,
cross-midnight windows, partial input, and empty schedules have explicit
semantics.

Rules may read local data, a validated versioned HTTPS endpoint, or a boolean
Home Assistant entity. Network access is bounded, credentials are stored in
the operating-system credential store, redirects and embedded URL credentials
are rejected, and failed refreshes keep the last valid local state. A remote
value never silently becomes the permanent base setting. Schedule edits enter
local history.

## Dim sum surprise

At startup, when the person is not in first run, an error path, an update, or a
mid-task flow, the application may show one randomly selected dim sum dish and
its picture with a ten percent probability. The notice is non-blocking,
auto-dismisses, never steals focus, and respects reduced motion and quiet
settings. Dish names are factual in English and Traditional Chinese, and
images are local or resolved through the approved public catalog route. The
feature has no opt-out switch.

## Offline documentation

The desktop application will bundle every feature article at build time and
render it with the shared isolated markup renderer. Internal article links
resolve within the browser. The browser has its own plain-text-first search and
full regular-expression builder. A build check will compare the bundled
article list with the files on disk and fail if an article is missing.

## Provider-authored text

Release notes, issue bodies, pull request bodies, commit messages, and README
previews are rendered as their actual markup. A shared isolated renderer gets a
base reference for relative links, an emoji map, and an accessible label. An
empty provider-authored body is shown as an honest empty state. External text
never receives the application's privileged operations.

## Failure modes and security

The application must not claim that a local record was saved when its history
write failed, that a remote setting was applied when refresh failed, or that a
package is verified when only a source manifest was checked. Local state is
bounded and private. Credentials, personal wording, local paths, and user
derived evidence stay out of logs, exports, captures, source control, and
public documentation.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, none of these
flows has a runnable implementation, focused test, packaged interaction, or
real capture. The [inventory](../../../INVENTORY.md) must be updated with exact
evidence when each flow is implemented.

## Suggested articles

- [Language and personal vocabulary](language-and-personal-vocabulary.md)
- [Search, navigation, and tabs](search-navigation-and-tabs.md)
- [Status and notifications](status-updates-and-notifications.md)
