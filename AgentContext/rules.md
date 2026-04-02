# Communication Rules

- Always respond in Spanish.
- Do not remove existing comments from the codebase.
- Ask clarifying questions instead of making assumptions when requirements are ambiguous.
- Do not change anything unrelated to the user request.

## Scope and Change Safety

- Read and understand impacted files before editing.
- Keep changes strictly scoped to the requested feature/fix.
- If business logic changes, tests must be added or updated.
- If fixing a bug, reproduce it with a test first, then implement the fix.
- Do not perform commits unless explicitly requested by the user.

## Architecture and Code Quality

- Prefer small, reusable components over large monolithic files.
- Avoid oversized files with mixed responsibilities.
- Extract helpers/services when complexity grows.
- Follow existing project layering and patterns (UI / service API / backend service boundaries).
- Preserve current conventions unless the user asks for a refactor.

## Frontend — Component structure (Liga 360)

- **`src/components/ui/`**: shared primitives (Button, Card, Modal, etc.); keep domain-specific flows out.
- **`src/components/layout/`**: app shell (header, sidebar, layout).
- **`src/components/<feature>/`**: feature UI shared across routes (e.g. tournament schedule, team blocks).
- **`src/modules/<module>/components/`**: module-only UI; use `atoms/` (or similar) for small building blocks inside the module.
- Prefer composition over monolithic screens; mirror unit tests under `src/test/unit/` when adding component tests.

## Frontend — Color palette (Liga 360)

- Canonical colors live in **`tailwind.config.js`** under `theme.extend.colors.brand` (`brand-dark`, `brand-bg`, `brand-green`, `brand-greenDark`, `brand-greenAccent`, `brand-white`, etc.).
- Prefer Tailwind classes such as `text-brand-dark`, `bg-brand-bg`, `bg-brand-green`, `hover:bg-brand-greenDark` instead of introducing new arbitrary hex values in JSX.
- Global base styles and shared button/card utilities are in **`src/index.css`** (`body`, `@layer components`); keep them aligned with `brand` tokens when changing the look and feel.
- Use existing neutral patterns (`slate-*` for borders/secondary surfaces) unless new brand neutrals are added to the theme.

## Testing Rules (Mandatory)

- Before closing a task, run at least:
  - `npm run test:ci`
- If critical user flow is touched, also run:
  - `npm run test:e2e:smoke`
  - or `npm run test:e2e:critical`
- Respect local push guard:
  - `npm run test:changed:guard`
- Emergency bypass exists but should be exceptional:
  - `git push --no-verify`

## PR and Merge Discipline

- PRs that modify business logic should include regression tests.
- Do not merge with failing tests.
- Prefer branch protection with required pipeline checks:
  - build
  - unit/integration
  - e2e smoke

## REQUIRED OUTPUT FORMAT FOR EXTRA CHANGES

If any change is introduced that was **not explicitly requested**, it must always be reported under this exact visible section:

## UNREQUESTED CHANGES

- Explain what was changed.
- Explain why it was necessary.
- Explain impact/risk.
- State whether it can be reverted safely.

This section must be present whenever out-of-scope adjustments happen (even if small).
