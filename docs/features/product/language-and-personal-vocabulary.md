# Language and personal vocabulary

Wording Lens will provide three language modes: English, playful Hong Kong
Cantonese, and bilingual. English and Cantonese have separate persisted funny
levels from 1, fully serious, through 5, maximum playfulness. Both controls
default to 5, explain that they style all messages including warnings and
errors, and can be reset independently. Humor changes presentation only. The
affected file, action, option, and result remain factual.

## School mode

School mode is a shared, user-renamable mode. Turning it on from any running
surface propagates live to the other surfaces. It forces English and removes
the Cantonese, bilingual, funny-level, personal-vocabulary, and dim sum
capabilities from user-facing discovery. The user's prior choices remain
stored and return when the mode is turned off. Turning it off requires the
shared locally verified credential. This is a user-experience setting, not a
security boundary, and the reset route explains that deleting the shared local
application-data record clears it.

## Personal vocabulary file

Settings always expose a local JSON file picker, including before a file has
been selected. The picker reports no-file, loaded, invalid, replace, and clear
states. It accepts one documented, versioned, bounded schema. The loader
validates the complete byte payload before applying anything and rejects
malformed JSON, duplicate keys, unknown schema versions, unsafe object keys,
unexpected fields, excessive nesting, excessive entries, oversized strings,
and oversized files. A rejected file applies no partial changes.

Only a user-selected valid file or a revalidated private local cache can affect
the wording overlay. Clearing the file removes the cache immediately and
restores the shipped wording. The file path is not persisted. Parsing,
replacement, and caching make no network request. The file contents and real
replacement values never enter source, logs, exports, history, captures,
telemetry, prompts, or public records.

## Failure modes and security

If a cache is corrupt, stale, unsupported, or absent, the application falls
back to its original wording and reports the state. If the shared mode record
cannot be read or watched, the setting says so rather than pretending that the
mode is off. School mode never reveals the hidden feature names in labels,
search results, notifications, or accessible names.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, the language
controls, School mode, and loader are not implemented and have no focused tests
or built-application captures. Later work must cover all language modes, both
funny-level extremes, restart persistence, invalid input, clear and replace,
no-network behavior, keyboard use, screen-reader names, narrow layouts, and
the School mode suppression and restoration paths.

## Suggested articles

- [Product overview](overview.md)
- [Appearance and accessibility](appearance-and-accessibility.md)
- [Locks, history, and authenticator](locks-history-and-authenticator.md)
