# Known Limitations

This document honestly records known architectural and feature limitations in the Brand Gate prototype.

1. **Simulated Role Authentication**: Roles (Creator, Manager, Reviewer) are switched via the UI top bar for demo purposes rather than enterprise SSO (OIDC/SAML).
2. **Stateless Serverless Execution**: Multi-step pipeline runs are orchestrated client-side in the browser via `usePipeline` to circumvent Vercel function timeout limits.
3. **Mock Social Publishing**: The "Publish to Instagram" action performs a high-fidelity client simulation and generates an immutable audit receipt rather than live Meta Graph API publishing (unless Phase 9 stretch is enabled).
4. **Client-Side Image Overlay Compositing**: Because Vercel serverless environments lack standardized system fonts, branding overlays and wordmarks are rendered onto images using client-side HTML5 canvas with web fonts instead of server-side `sharp`.
5. **Local Browser Storage Default**: In the absence of Supabase environment variables, all user drafts, audit logs, comments, and pipeline traces persist locally inside IndexedDB.
