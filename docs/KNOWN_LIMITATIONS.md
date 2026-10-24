# Known Limitations

This document honestly records known architectural and feature limitations in the Brand Gate prototype.

1. **Simulated Role Authentication**: Roles (Creator, Manager, Reviewer) are switched via the UI top bar for demo purposes rather than enterprise SSO (OIDC/SAML).
2. **Stateless Serverless Execution**: Multi-step pipeline runs are orchestrated client-side in the browser via `usePipeline` to circumvent Vercel function timeout limits.
3. **Mock Social Publishing**: The "Publish to Instagram" action performs a high-fidelity client simulation and generates an immutable audit receipt rather than live Meta Graph API publishing (unless Phase 9 stretch is enabled).
4. **Client-Side Image Overlay Compositing**: Because Vercel serverless environments lack standardized system fonts, branding overlays and wordmarks are rendered onto images using client-side HTML5 canvas with web fonts instead of server-side `sharp`.
5. **Local Browser Storage Default**: In the absence of Supabase environment variables, all user drafts, audit logs, comments, and pipeline traces persist locally inside IndexedDB.
6. **Workflow enforcement is client-side**: Permissions are enforced in `src/workflow/actions.ts`, which every UI path calls. Because workflow records live in the browser, a user with devtools could edit IndexedDB directly; a server-backed store (e.g. the optional Supabase adapter) would be needed for tamper-resistant enforcement and a truly immutable audit log.
7. **Seeded Insights history is synthetic**: The ~120 seeded events mix real gate-engine findings on the sample posts with synthetic reviewer disputes, hallucinations and human decisions. They are labelled "sample data" in the UI and can be filtered out ("Live only").
8. **Policy pack hash ignores rule bodies**: `loadPolicyPack()` hashes rule IDs, not rule patterns, so a rule-pattern fix (such as the `R-TERM-005` fix in Phase 7) does not change the pack hash. Phase 2 behaviour, not changed.
9. **Major gate findings block**: `evaluatePost` lists major as well as critical findings in `gatesFailed`, and scoring treats any failed gate as BLOCKED, so a single major gate finding blocks (spec §11 blocks only on critical or score < 70). Phase 3/5 behaviour, kept unchanged so Workflow, Compare and the benchmark all use the same verdict logic.
