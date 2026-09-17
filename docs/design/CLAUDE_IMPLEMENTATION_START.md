# Claude Code — ProfitRig design-system audit

Read `docs/design/PROFITRIG_DESIGN_SYSTEM.md` completely. Read `docs/design/README.md` for the available assets and their approval status. This is the authoritative visual and UX specification for ProfitRig.

Do not modify application code yet. Audit the existing frontend and identify:

1. Frontend framework and styling architecture.
2. Global CSS/theme files.
3. Existing fonts.
4. Reusable components.
5. Duplicated styling.
6. Current color variables.
7. Navigation architecture.
8. Responsive/mobile architecture.
9. Every major page that needs visual migration.
10. Risks to business logic and financial calculations during a UI refactor.

Propose a phased implementation plan and identify missing assets. Stop for review before implementing the redesign.

Preserve calculations, authentication, database logic, routes, APIs, validation, permissions, user data and working functionality. Build the approved system through reusable components and tokens once the plan is approved.

Start with fonts, design tokens, global surfaces, shared components and navigation; migrate individual product pages afterward. Follow the repository's existing engineering instructions.
