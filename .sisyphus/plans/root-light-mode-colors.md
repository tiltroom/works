## Goal

Improve the visual balance of the root route (`/`) in light mode while preserving the existing dark-mode appeal and keeping content/layout unchanged.

## Scope

- Inspect and adjust `src/app/page.tsx` homepage-specific color usage.
- Inspect and adjust light-mode variables/utilities in `src/app/globals.css` only if needed to support the homepage refresh.
- Keep `src/app/layout.tsx`, theme switching behavior, and homepage copy/structure unchanged unless a tiny styling hook is required.

## Constraints

- Dark mode should remain visually equivalent or improve only incidentally.
- No broad redesign of other routes.
- Reuse the light-surface treatment and contrast patterns from `src/app/login/page.tsx` and `src/app/signup/page.tsx` where reasonable.
- No new dependencies.

## Implementation Plan

1. Refine the homepage background treatment for light mode so it feels intentional rather than washed out.
2. Replace overly dark-mode-biased accents (heavy indigo/purple blobs, low-contrast glass surfaces) with light-mode-friendly hues/opacities.
3. Improve text and chip contrast in light mode while preserving the current layout and hierarchy.
4. If needed, add homepage-specific utility classes or light-mode-tuned CSS variables in `globals.css` instead of changing shared tokens broadly.
5. Verify changed files with diagnostics and run `npm run lint` as the required project validation command.

## Verification

- Run `lsp_diagnostics` on `src/app/page.tsx` and any additional changed file (expected result: no new errors or warnings caused by the change).
- Run `npm run lint` from the repository root (expected result: exit code 0).
- Manual QA scenario 1: start the app in light mode, open `/`, and confirm the hero background, glass card, CTA, and feature chips have stronger contrast, look more intentional on the pale background, and preserve the existing copy/layout.
- Manual QA scenario 2: switch to dark mode on `/` and confirm the page still preserves the current dark aesthetic, with no regressions in readability, glow treatment, or hierarchy.
- Manual QA scenario 3: confirm theme switching still works normally and the changes remain scoped to the homepage/light-mode presentation rather than altering unrelated routes.
