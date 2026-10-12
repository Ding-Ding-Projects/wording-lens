# Pages publication

The site is built with `SITE_BASE_PATH=/wording-lens` and
`NEXT_PUBLIC_SITE_URL=https://ding-ding-projects.github.io/wording-lens/`.
The pinned vinext exporter writes the homepage and its local resources under
`apps/site/dist/client/wording-lens/`. Uploading the containing client directory
would add the project path twice when GitHub mounts the artifact.

## Build and stage

Use the declared Node.js 22.22.2 toolchain. This shared-toolchain pin also
satisfies the desktop lockfile's `jsdom` 30.0.1 requirement of
`^22.22.2 || ^24.15.0 || >=26.0.0`; the former 22.14.0 pin was outside that
range. The pin correction is separate from the Pages output-layout defect.
The Windows archive SHA-256 is
`7c93e9d92bf68c07182b471aa187e35ee6cd08ef0f24ab060dfff605fcc1c57c`, checked
against [Node.js's official checksums](https://nodejs.org/dist/v22.22.2/SHASUMS256.txt).
The separately prepared Pages workflow update will run
`scripts/bootstrap-dependencies.ps1 -Silent -ToolchainOnly` on Windows; the
ordinary desktop bootstrap continues to install the application's full
dependencies. The source-preservation branch leaves existing workflows
unchanged until that update is reviewed and published.

From `apps/site`, with the environment above set, run:

```text
npm ci --no-audit --no-fund --ignore-scripts
npm test
npm run typecheck
npm run build
npm run stage:pages
```

Local tests and type checks stay outside GitHub Actions. The pending workflow
update builds and stages the static artifact, then uploads `apps/site/dist/pages`.

`scripts/stage-pages.mjs` promotes the configured base-path directory to the
artifact root without rewriting its published URLs. It keeps JavaScript, CSS,
the RSC payload, favicon, preview image, and generated 404 documents together.
It validates emitted HTML resource `src`/`href` references against that same project-path mount,
rejecting missing or empty resources and URLs outside the configured path.
It also rejects symbolic links and source/output overlap, clears obsolete
staging contents, and adds `.nojekyll` for underscore-prefixed assets.
CSS `url()` references, `srcset`, and browser execution require separate
verification; they are outside this HTML-resource staging check.

Neutral regression fixtures cover root and nested project mounts, missing
homepage/CSS/JavaScript files, the former origin-root favicon URL, obsolete
staging files, overlapping paths, symbolic links, and invalid base paths.

## Deployment acceptance

Local output is not evidence that Pages served it. After publication:

1. Verify the remote `main` commit and both build/deploy jobs for that exact SHA.
2. Fetch the anonymous HTTPS homepage at `/wording-lens/`, follow redirects,
   and fetch its referenced JavaScript chunk containing `SITE_PROVENANCE`.
   Verify that chunk's full source commit matches the deployment. The current
   interface shows version and timestamp; the source SHA is in the bundle.
3. Fetch every local JavaScript/CSS reference and the favicon at their emitted
   URLs. Verify HTTP success, expected content types, and nonempty bodies.
4. Fetch the social-preview URL from initial HTML and compare its bytes with
   the tracked public image. Verify canonical/Open Graph URLs use the project
   path and that the rendered site hydrates and its navigation works.
5. Record exact run and live-verification evidence before advertising the
   site as deployed. Installer, updater, packaged captures, and complete
   product acceptance remain separate requirements of issue #1.

## Current verification

The bounded repair passed its local base-path build and staging, 20 site
tests, site TypeScript, and changed-file lint on Node.js 22.22.2. Full site
lint still reports 19 errors that reproduce unchanged on clean `f42ffa8`.
The hosted Windows toolchain bootstrap and exact deployment have not yet
been verified. See [HANDOFF.md](../../../HANDOFF.md) for current root checks
and complete-release limitations.

The focused hash-path regression can be run locally on Windows with
`pwsh -NoProfile -File tests/build/bootstrap-hash.test.ps1`. It extracts the
exact committed hash function and digest guard without running bootstrap,
checks the known SHA-256 of a neutral `abc` file, rejects an incorrect digest,
and proves the file can be reopened exclusively after success and mismatch.
That PowerShell test has not run in the current Linux environment. Raw logs
retrieved on 2026-10-12 confirm the missing `Get-FileHash` command in
[historical release run 33910964111](https://github.com/Ding-Ding-Projects/wording-lens/actions/runs/33910964111/job/101147006164)
and [current-main release run 33916759742](https://github.com/Ding-Ding-Projects/wording-lens/actions/runs/33916759742/job/101165600540).
[Current-main Pages run 33916759691](https://github.com/Ding-Ding-Projects/wording-lens/actions/runs/33916759691/job/101165595401)
completed the static build and then failed the incorrect root `index.html`
check. It also reported the incompatible Node.js 22.14.0 engine warnings.
These logs verify existing failures; the repaired Windows bootstrap and
deployment still need their own exact-source successful run.
