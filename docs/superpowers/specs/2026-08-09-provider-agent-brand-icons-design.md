# Provider and Agent Brand Icons

## Outcome

Use the same locally vendored SVG artwork as Paseo for AI providers and coding-agent CLIs. The Settings model surfaces, AI model picker, workspace setup, and terminal pane header must resolve icons through shared components.

## Design

- Vendor only the Paseo SVGs needed by cmdSpace; never fetch brand artwork at runtime.
- Render vendored SVGs as CSS masks so monochrome artwork follows the surrounding text color in light and dark themes.
- Keep one brand asset catalog, one provider resolver, and one CLI-agent resolver.
- Preserve existing Hugeicons as explicit fallbacks for brands Paseo does not provide.
- Reduce terminal/workspace badges from 24/28 px to 20/24 px and their artwork to 12/14 px.

## Verification

- Unit-test provider and CLI-agent brand resolution.
- Source tests must prove all affected UI surfaces use the shared components.
- Run focused Vitest coverage and `pnpm build`.
