# macOS release signing

Public macOS downloads must be signed with an Apple `Developer ID Application`
certificate and notarized. A development certificate, ad-hoc signature, or an
unsigned DMG still triggers Gatekeeper and is not suitable for public releases.

## One-time GitHub setup

Use the Apple Developer account holder to create and download a `Developer ID
Application` certificate, export its private key as a password-protected `.p12`,
then encode it on a trusted Mac:

```sh
openssl base64 -A -in /path/to/cmdSpace-developer-id.p12 -out certificate-base64.txt
```

Add these repository secrets in GitHub at
`Settings -> Secrets and variables -> Actions`:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Contents of `certificate-base64.txt` |
| `APPLE_CERTIFICATE_PASSWORD` | Password used to export the `.p12` |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: <name> (<team-id>)` |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_PASSWORD` | Apple app-specific password, not the Apple ID password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

The release workflow intentionally fails macOS jobs when any of these are
missing. This prevents publishing another Gatekeeper-blocked DMG.

## Releasing a notarized build

After the secrets are present, create and push the next `v*` tag. The macOS
matrix jobs sign, notarize, staple, and upload the Intel and Apple Silicon
DMGs. Confirm the release job is green and download a DMG before announcing it.

`v0.7.1` predates this gate and remains unsigned; replace it only after the
Apple credentials are configured.
