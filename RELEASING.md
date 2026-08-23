# Releasing `@chaosity/address-form`

```bash
git switch -c release/0.2.4
npm version patch                              # or minor / major
git push -u origin release/0.2.4 --follow-tags
```

Then open a PR for that branch and merge it. Merging is what publishes:
`.github/workflows/publish.yml` sees the changed version on `main` and publishes
to npm with provenance.

`npm version` does the whole bump in one step — edits `package.json`, makes the
commit, and tags it `v0.2.4` — so the tag and the published version cannot
disagree. Do it on a **branch**, never on `main`: the commit then goes through
review like everything else, and `main branch protection` is never bypassed.

> **`npm version` has no `--dry-run`.** It is not in its option list and npm
> **silently ignores it** — on 2026-08-23 `npm version patch --dry-run`, run to
> preview a number, instead bumped, committed and tagged. Compute the next
> version yourself if you need to know it in advance.

If the PR is closed without merging, delete the tag — it points at a commit that
never landed:

```bash
git push --delete origin v0.2.4 && git tag -d v0.2.4
```

## This package releases LAST

`@chaosity/location-client` → `@chaosity/location-client-react` → this package.

The reason here is **not** the caret trap that governs the two client repos. Both
clients are declared as **peer** dependencies with a deliberately wide range:

```json
"peerDependencies": {
  "@chaosity/location-client": ">=0.1.0",
  "@chaosity/location-client-react": ">=0.1.0"
}
```

So a client minor does not strand this package's range, and releasing here does
not require a dependency bump. What it does require is that the code still
_works_ against the new client — a wide peer range is a promise, and nothing
enforces it but this repo's tests. When client-react 0.3.0 changed the context
type and removed `refreshBuffer`, `lib/utils/api.ts` needed a structural
`LocationClientLike` type to accept both majors. That is the kind of breakage the
order exists to catch.

So: release the clients, wait for them to appear on npm, install them here, run
the suite, and only then release this package.

## The tag records the release; it does not cause it

Publishing triggers on the **version change**, not on the tag. That separation is
what keeps a release reviewable:

- A tag pushed from your machine uses **your SSH key**, not a token. Tag pushes
  also fall outside the `main branch protection` ruleset, which targets
  `refs/heads/main`.
- A stray or mistaken tag cannot publish anything.
- Equally, if a tag is ever missed, nothing breaks — the package is already out.

This repo learned that the hard way. Until 2026-08-23 `publish.yml` triggered on
`push: tags: ['v*']`, and 0.2.3 was published the moment its release branch was
pushed — **before the pull request had been reviewed or merged**. The artefact
happened to be correct, because the branch was `main` plus a version bump, but
nothing guaranteed it. A tag exists before a PR merges, so a tag can never be the
gate.

To spot a release that never got tagged:

```bash
npm view @chaosity/address-form versions --json    # compare against:
git tag -l 'v*'
```

## Why there is no release workflow

`release.yml` ran `npm version` on a runner and pushed with
`secrets.GITHUB_TOKEN`, needing `contents: write`. It was removed on 2026-08-23,
after the two client repos, for the same two reasons:

- **Nothing here should hold a credential that can write to the repository.**
- **It had never run once, and could not have.** The `main branch protection`
  ruleset requires a pull request and its only bypass actor is the repository
  **admin** role, which a workflow's `GITHUB_TOKEN` is not — it acts as
  `github-actions[bot]`, which has write permission but is not an admin.

Running `npm version` yourself, on a branch, has neither problem.

## The trigger, precisely

`publish.yml` is triggered by **`build.yml` completing**, not by the push:

```yaml
on:
  workflow_run:
    workflows: [build]
    types: [completed]
    branches: [main]
```

and the job only runs when that build actually passed
(`github.event.workflow_run.conclusion == 'success'`). So a publish can never
overtake its own validation.

Because of that ordering, nothing is re-run here: no lint, no tests, no matrix.
`build.yml` did all of it on this exact commit, and this workflow only exists
because it passed.

Two consequences worth knowing:

- **The checkout is pinned to `workflow_run.head_sha`.** A `workflow_run` job
  otherwise checks out the default branch tip, not the commit that was built —
  which would quietly release something other than what passed.
- **`workflow_run` supports no `paths` filter**, so the "is this version already
  on npm?" check in the job is what decides. Without it, every successful build
  on `main` would attempt a publish and fail red on the commits that are not
  releases.

`npm publish` runs `prepublishOnly`, which runs `npm run build` — both the
library and the standalone UMD bundle — so the tarball is produced whether or not
a step names it.

## What ships in the tarball

`"files": ["dist"]`, so the package contains `dist/`, `LICENSE`, `package.json`
and `README.md` — 54 entries, and **no `.github/`**. Changing a workflow in this
repo is invisible to consumers and does not warrant a version bump.

## What publish.yml uses

`contents: read` and `id-token: write`. The id-token is an **OIDC** exchange —
short-lived, scoped to this repository and workflow — and it is what produces the
SLSA provenance attestation on the published package. There is no npm token in
this repository, and there should never be one.

`actions/checkout` still uses the implicit, read-only `GITHUB_TOKEN` to clone.
That cannot write and cannot be removed.

## Verifying a published package

```bash
npm view @chaosity/address-form version
npm audit signatures
curl -s "https://registry.npmjs.org/-/npm/v1/attestations/$(node -p \
  "encodeURIComponent('@chaosity/address-form')")@<version>" | jq
```

The attestation records the repository, workflow path, ref and exact source
revision the tarball was built from. A published package whose provenance names
a repository you do not recognise is a supply-chain incident, not a bad release.
