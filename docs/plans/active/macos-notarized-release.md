# Execution Plan: notarized macOS public release

Date: 2026-08-01

## Status

Blocked

## Outcome

Public cmdSpace macOS downloads install through Gatekeeper without the
unverified-malware warning.

## Context

- `.github/workflows/release.yml` publishes macOS, Windows, and Linux bundles.
- `v0.7.1` is public but unsigned and is correctly blocked by macOS Gatekeeper.
- Tauri requires a paid Apple Developer `Developer ID Application` certificate
  and notarization credentials for public macOS distribution.

## Scope

In scope:

- Prevent unsigned macOS artifacts from being published by CI.
- Document the required Apple and GitHub secret setup.
- Publish a signed/notarized replacement release after credentials exist.

Out of scope:

- Apple Developer account enrollment or certificate issuance.
- Changing Windows or Linux signing policy.

## Approach

1. Require the Tauri signing and notarization environment in macOS CI jobs.
2. Pass the credentials to Tauri only on the runner.
3. After secrets are configured, create a release tag and verify notarization
   by installing a downloaded DMG on a clean macOS profile.

## Risks And Recovery

- Apple credentials are external secrets and cannot be generated safely by the
  repository. The workflow exits before upload if they are missing.
- If notarization fails, keep the previous release available and inspect the
  Apple notarization log; do not publish replacement macOS assets.

## Progress

- [x] Verify the existing GitHub repository has no Apple signing secrets.
- [x] Confirm the local identity is `Apple Development`, not distributable
      `Developer ID Application`.
- [x] Add a CI signing/notarization gate and setup runbook.
- [ ] Add Apple secrets and publish the notarized release.
- [ ] Verify a downloaded DMG on macOS.

## Decisions

- 2026-08-01: Fail closed for macOS public releases rather than publishing an
  unsigned fallback; the requested install experience requires notarization.

## Validation

- Focused proof: validate GitHub Actions YAML and inspect the secret gate.
- Integration proof: successful macOS signing/notarization release run after
  Apple secrets are available.
- Repository-required checks: frontend build and Rust checks are unaffected by
  this workflow-only change.

## Result

CI is prepared but the public-installable macOS release remains blocked on the
Apple Developer credentials listed in `docs/MACOS_RELEASE_SIGNING.md`.
