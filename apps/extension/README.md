# Wording Lens Download Companion

This folder contains the unpacked Chromium Manifest V3 companion for Wording Lens.

## User flow

1. The user opens a link context menu and chooses **Capture download with Wording Lens**.
2. The extension opens the Start download surface with the proposed file, source, and destination.
3. The user confirms the request. Only then does the extension send the versioned native message.
4. The Downloading surface reports the state supplied by the local application, including progress, rate, ETA, pause, resume, cancel, and terminal status.

The extension does not install a CRX and does not use a signing key. Load the folder through the browser's developer extension screen. The native host name is fixed in `service-worker.js`, and the message shape is defined in `native-message-schema.json`.

When the native host is absent or rejects the schema, the extension keeps the request reviewable and leaves transfer controls disabled. It does not silently fall back to a web service or pretend that a transfer started.

The extension has no broad host permissions, content scripts, cookie access, history access, analytics, or background page inspection. A request can enter the flow only from the explicit link context-menu action.
