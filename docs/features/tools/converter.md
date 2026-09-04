# Local file converter

The converter package provides the domain engine behind a guided local file
conversion surface. It does not upload input, infer support from a file name,
or make an unbundled executable appear available.

## Adapter catalog and detection

`createDefaultAdapterRegistry()` registers the required categories:
Documents/PDF, Images, Audio, Video, Archives, Structured Data/Spreadsheets,
Code/Text, and Binary Encodings. Default entries are visible but disabled.
An adapter becomes enabled only when it is registered with `bundled: true`, a
`packagedProof.status` of `verified`, and every declared dependency both
bundled and available. The registry exposes disabled reasons and reports
missing categories, so a capability gap is visible rather than silently
omitted.

`detectSignature()` inspects bounded bytes and returns a format, MIME type,
confidence, category, and reason. It recognizes exact PDF, image, archive,
audio signatures and safe text heuristics. File extensions are not used as
evidence. Unknown, malformed, or unsupported input remains unknown.

## Safe conversion and loss disclosure

`lossDisclosure()` creates a reviewable description before a lossy,
metadata-changing, or cross-format conversion. The caller must record an
explicit acknowledgement before execution. Output bytes should be checked by
`validateOutput()` and written with `atomicWriteValidated()`. The writer uses a
unique temporary file, checks its size, retries only transient Windows rename
errors a bounded number of times, and removes the temporary file on failure.

## Streaming queue

`ResumableQueue` consumes an `AsyncIterable`, so an unlimited queue can be
discovered and processed without loading every path or byte into memory. Work
is bounded to a configurable concurrency of 1 through 64. Records are written
through `QueueStore`, making pause, resume, cancellation, retry attempts, and
partial converted/skipped/cancelled/failed outcomes durable for an application
that supplies a disk-backed store. Cancellation aborts active workers and
marks queued entries cancelled.

## PDF contract

`validatePdfOperation()` covers inspect, split, merge, extract, reorder, rotate,
and metadata operations. `executePdfOperation()` requires a PDF signature,
validates page arguments, delegates bytes to an injected `PdfEngine`, and
validates every byte output as PDF before it can be offered to the user.
`inspectPdfBytes()` reports page count where the source exposes it and marks
encrypted or signed documents as opaque capabilities that the engine must
handle explicitly.

## Verification notes

The package exports pure contracts and injected boundaries so focused tests can
exercise signature mismatches, disabled adapters, malformed output, transient
rename handling, bounded concurrency, pause/resume, cancellation, and partial
results without a network service. A complete product build must additionally
prove every enabled adapter and PDF operation from the packaged application.

Suggested articles: [Ollama manager](ollama.md), the application's offline
documentation article, and the release packaging guide.
