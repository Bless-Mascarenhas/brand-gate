# Round 3 Product Plan

## Objective

Finish Brand Gate as a self-serve product a judge can use without team assistance. Keep the existing product direction and consolidate the primary journey into exactly three user-facing sections:

1. **Company Documents**: review the active company policy and facts.
2. **Create**: generate, govern, revise, and illustrate a social post.
3. **Evaluate**: upload an existing post and image, then review policy-grounded findings.

The work is organized into five phases. A phase is complete only when its acceptance checks pass and its evidence is recorded. Do not claim that every possible input is covered; define and pass the test matrix below, and disclose any remaining provider or deployment limitations.

## Current Codebase Baseline

- The app is a Next.js App Router project. `npm run check` runs TypeScript, ESLint, Vitest, and a production build.
- The current sidebar exposes eight sections. Company, Build, and Verify are the closest existing surfaces for the requested three-section experience.
- Create now runs a governed generation loop with two parallel draft candidates selected by deterministic policy score. `/api/llm/image` calls a configured Cloudflare Worker and sanitizes its raw image bytes; live provider behavior still requires a separate smoke test.
- Verify has text fields and a review pipeline, but no image file picker. An image-perception API and image sanitation utilities already exist and can be reused after their behavior is verified.
- Shared API request validation, request-size limits, access checks, image MIME restrictions, EXIF removal, and security tests already exist. Extend these controls instead of creating parallel validation paths.
- The repository documents browser-local storage and external model dependencies. A live provider test is only valid when the required provider credentials and model IDs are configured on the server.

## Round 2 Commitment Tracker

Round 3 awards points for the three improvements named in the Round 2 submission. Their exact wording was not provided with this request, so fill these rows from the submitted commitment before implementation. Do not replace a difficult commitment with a more convenient feature. If one cannot be completed, record the reason and impact for the final PDF.

| Round 2 commitment (copy exact wording) | Implementation / evidence | Status |
|---|---|---|
| 1. `[ADD EXACT COMMITMENT]` | `[ADD FILES, TESTS, DEMO EVIDENCE]` | Not started |
| 2. `[ADD EXACT COMMITMENT]` | `[ADD FILES, TESTS, DEMO EVIDENCE]` | Not started |
| 3. `[ADD EXACT COMMITMENT]` | `[ADD FILES, TESTS, DEMO EVIDENCE]` | Not started |

## Phase 1: Product Shell and Journey

**Goal:** A first-time judge can find the three core sections and complete the intended journey without being routed through the former eight-section tour.

**Work**

- [x] Make the primary desktop and mobile navigation contain only **Company Documents**, **Create**, and **Evaluate**. Keep the current Company page as the document view; combine or route the existing Build and Verify experiences into Create and Evaluate.
- [x] Select a clear default route and ensure direct links, refreshes, browser back/forward, and unknown legacy routes behave predictably. Preserve useful backend/domain code even when a page is no longer in primary navigation.
- [x] Remove or update obsolete navigation labels, guided-tour steps, links, empty-state prompts, and explanatory copy that still sends users to the eight-section flow.
- [x] On Company Documents, show the currently active documents and make clear which policy version/facts are used by generation and evaluation. Do not imply browser-local policy edits affect server decisions unless that integration is implemented.
- [x] Add a concise first-use path: choose Create to draft, or Evaluate to inspect an existing post.

**Acceptance checks**

- [x] Desktop and mobile show exactly three primary destinations, with an accurate active state and keyboard-operable navigation.
- [x] Each destination loads directly and survives refresh; no primary action links to a removed or misleading page.
- [x] Company Documents lists the existing documents and accurately labels the active policy source/version.
- [x] A first-time user can identify Create and Evaluate without opening a guided tour.
- [x] Update/add focused navigation and route tests; manually check one desktop viewport and one narrow mobile viewport.

## Phase 2: Create Flow and Text-to-Image Generation

**Goal:** A user can submit a sufficiently detailed brief, receive a policy-governed post and a real generated image, request changes, and repeat without losing the last valid result.

**Work**

- [x] Define the brief contract: required topic, minimum useful context, optional audience/offer/tone/language, and supported output format. Reject blank or too-short input before spending model calls. Show a short suggested format and an example brief beside the error.
- [x] Use one server-side orchestrator for the flow. Send the same validated brief and only the relevant policy context to the two configured text models in parallel. Require structured outputs, validate them with Zod, and label which providers actually responded.
- [x] Reuse the existing policy gates, citation verification, and score/verdict logic to inspect generated candidates. Make disagreements visible and traceable; do not let an LLM silently invent company policy or decide compliance by itself. If the intended two-model behavior cannot be supported because a provider is unavailable, state that clearly rather than claiming a two-model result.
- [x] After a candidate is selected, create and validate a typed image-prompt JSON object. Include the prompt, negative constraints, aspect ratio, and any necessary brand-safe composition fields. Do not let model-generated JSON directly control arbitrary server behavior.
- [x] Replace the current procedural-SVG-only success path with a server-side text-to-image provider adapter. First verify a provider's current free-tier availability, limits, image rights, and API requirements. Treat free access as a provider constraint, not a guarantee. Keep API keys server-side; never expose keys in browser code, logs, or responses.
- [x] Return clear, recoverable states for missing configuration, unsupported models, timeout, quota exhaustion, invalid provider output, and image-generation failure. If a labeled fallback is offered, do not present it as a generated image.
- [x] Preserve the current draft when a revision fails. A user change should rerun the governed text and image-prompt flow; prevent duplicate submissions while a run is active and make progress/failure visible.

**Acceptance checks**

- [x] Blank, whitespace-only, and insufficient-context briefs are rejected with a suggested format and no model call.
- [x] Mocked tests prove both configured text providers receive the intended validated context; malformed output and one/both provider failures produce honest, bounded results.
- [x] Generated JSON is schema-validated; invalid fields, oversized prompts, and unsupported aspect ratios are rejected.
- [x] Provider adapter tests cover successful image response, invalid/non-image response, timeout, quota/error status, missing key, and no secret leakage.
- [x] A revision preserves the prior successful draft if the new run fails; repeated clicks do not create overlapping runs.
- [ ] A configured Worker smoke test confirms an actual image response. If credentials or quota are unavailable, mark this check blocked and do not claim live image generation is verified.

**Progress (2026-10-30):**

- [x] The Phase 2 implementation is in place. LangChain Core orchestrates parallel draft and reviewer calls; thorough review reciprocally cross-examines each reviewer's citation-verified findings.
- [x] Brief/schema validation, deterministic candidate selection, image prompt JSON, the Cloudflare Worker adapter, generated-image sanitation, provider-failure handling, weighted call budgeting, and best-draft retention are covered by mocked tests.
- [ ] The live Worker smoke test remains unverified and must not be reported as passed until deployed and configured.

## Phase 3: Evaluate Uploaded Posts and Images

**Goal:** A user can upload an existing post image and provide its caption/context, then receive explainable, source-grounded inconsistencies and suggested changes.

**Work**

- [x] Add an Evaluate upload flow for supported image formats and the associated post text. Text-only evaluation is allowed; when image evaluation is requested, a real, non-empty image is required.
- [x] Validate on both client and server: file presence, byte limit, allowed JPEG/PNG/WebP formats, decodability, dimensions, and empty/transparent/blank-image handling. Do not trust filename extensions or client-provided MIME metadata. Reuse the existing image sanitizer and analyze only the re-encoded image where it is sent to a provider.
- [x] Use a model that genuinely supports image input for visual analysis. Do not silently send an image-analysis prompt to a text-only model or return default perception values as if the image was inspected. A live call remains unverified until `VISION_API_KEY`, `VISION_MODEL`, and `VISION_BASE_URL` are configured.
- [x] Extract relevant visible text and visual claims, then compare them against the active company facts, assets, and policy clauses. Return each finding with the exact source document/clause, the relevant observed text or visual detail, reasoning, and a suggested correction. If evidence is uncertain or no source supports a conclusion, label it uncertain instead of fabricating a citation.
- [x] Reuse the existing deterministic gates, citation verifier, consensus, and scoring where their contracts fit. Make clear which findings are deterministic and which are model-assisted. Keep human judgment as the final decision.
- [x] Provide upload progress, preview/removal/retry, and actionable errors. The flow states that uploads are not retained; no persistence behavior changed.

**Acceptance checks**

- [x] Valid JPEG, PNG, and WebP files reach the expected pipeline; zero-byte, blank, malformed, corrupted, unsupported, oversized, and misleading-extension files fail safely with useful messages. Mocked coverage is in `src/llm/__tests__/phase3.test.ts`; the broad test suite also covers MIME and EXIF controls.
- [x] Image analysis tests use a mocked vision-capable provider and verify that the sanitized image, not the original metadata-bearing bytes, is sent.
- [x] Findings cite an existing clause/fact and include evidence; invented clause IDs and quotes are dropped or surfaced as unverifiable.
- [x] No image, missing caption/context, and insufficient context follow the explicitly selected product rules and never hang. Text-only evaluation is allowed; the form requires at least three caption/context characters before a run.
- [ ] A user can complete Evaluate using a representative sample and a locally uploaded image; refresh and retry states remain usable. Requires manual browser verification and a configured vision provider.

**Progress (2026-10-30):**

- [x] Evaluate supports local JPEG, PNG, and WebP previews; removal; actionable validation errors; and text-only evaluation.
- [x] Uploaded images are server-decoded, bounded to 3 MB, checked for dimensions and blank/transparent content, re-encoded as JPEG without metadata, and only then forwarded to the configured vision endpoint.
- [x] The pipeline uses the sanitized asset for downstream policy gates and model-assisted review. Visible text and visual claims are accepted as citation evidence only when the cited clause and evidence can be verified.
- [x] Mocked Phase 3 provider/security coverage passes, along with `npm run check` (244 tests and production build).
- [ ] A real vision-provider smoke test is blocked until a vision-capable provider endpoint and the `VISION_*` environment variables are configured. Image-generation credentials alone are not evidence that image perception works.

## Phase 4: Reliability, Security, and Usability Hardening

**Goal:** Normal mistakes, retries, hostile inputs, and provider failures do not break or misrepresent the product.

**Work**

 - [ ] Define a compact threat model for the brief, uploaded image/OCR text, policy documents, generated model output, and API boundary. Treat all user/model-provided content as untrusted data, separate it from system instructions, and never rely on prompt wording as the only security control.
 - [ ] Add prompt-injection regression cases (including instructions embedded in the brief, image text/OCR, and quoted content). Confirm they cannot change system rules, reveal secrets, suppress required citations, or trigger unintended tools/actions. Keep model outputs schema-validated and escaped in the UI.
 - [ ] Verify access checks, rate limits, body/file-size limits, provider timeouts, error redaction, and server-only secret handling on every new route. Do not log full prompts, uploaded image data, access codes, or provider credentials.
 - [ ] Cover duplicate actions, refresh during/after a run, browser storage failure, missing policy pack, offline state, partial provider outage, and quota exhaustion with deliberate UI states. Use idempotency or request guards where repeat requests could duplicate durable records or cost.
 - [ ] Polish labels, field-level help, focus order, keyboard use, responsive layouts, and result readability. Keep the main action obvious and distinguish draft, evaluated result, uncertain finding, and human-approved result.
 - [x] Update known limitations and privacy/data-flow statements when actual behavior changes.

**Acceptance checks**

- [ ] Security tests cover malformed JSON, schema bounds, request/file size, MIME/decode checks, missing/invalid access, injection corpus, output escaping, rate limiting, and secret non-disclosure.
- [ ] Failure-path tests confirm every network/model operation terminates or times out with a visible recovery action; no indefinite spinner remains.
- [ ] Repeat-click, browser refresh, storage failure, and provider partial-failure tests preserve usable state and do not create misleading duplicate results.
- [ ] Keyboard-only and narrow-screen manual checks complete both main journeys without clipped text, inaccessible controls, or horizontal page overflow.
- [ ] No new known limitation is hidden; anything not verifiable is explicitly recorded for the final submission.

**Progress (2026-10-30):**

- [x] User-provided post content and generation briefs are serialized as escaped untrusted data before they are placed in provider prompts; a regression test covers an attempt to close the post envelope and override instructions.
- [x] Provider failures now return stable recovery messages rather than upstream error details; raw provider failures and API keys are not exposed in route responses.
- [x] Browser preference storage is wrapped in a safe fallback, so blocked or failing `localStorage` does not prevent application startup or a theme/role change.
- [x] The evaluation pipeline has an in-flight guard to prevent overlapping runs from duplicate actions; image/provider errors are surfaced in the Evaluate view with a retry action.
- [x] Fresh `npm run check` passes: TypeScript, ESLint, all 245 tests, and production build. ESLint reports one non-blocking `<img>` optimization warning in the Evaluate page.
- [ ] Threat-model documentation, the complete injection corpus, and the remaining manual responsive/keyboard/refresh checks still require completion before Phase 4 can be marked complete.

## Phase 5: End-to-End Verification and Submission Package

**Goal:** Freeze a reproducible build, test the actual judge journeys, and submit every required artifact before the deadline.

**Work**

- [ ] Run the repository's complete check: `npm run check` (TypeScript, ESLint, Vitest, and production build). Fix regressions in the touched scope and rerun the same check until it passes.
- [ ] Test two end-to-end journeys on the deployed build: (1) Company Documents → Create brief → two-model governed result → generated image → request revision; (2) Evaluate → upload image and caption → inspect findings and source evidence. Include refresh, empty input, repeated action, and at least one provider failure.
- [ ] Use mocked provider tests for deterministic CI coverage and a clearly labeled live smoke test for providers actually configured. Record provider/model IDs, date, and whether each call was live or mocked; do not fabricate results or claim unavailable providers passed.
- [ ] Clone the final repository into a clean directory and follow the README from prerequisites through local startup. Verify environment-variable names without printing or committing secret values. Confirm the deployed URL opens without team assistance and is not blocked by a demo access-code setup that judges do not have.
- [ ] Prepare the final product PDF, complete feature list, technical architecture and implementation summary, exact Round 2 improvement evidence (including any honest non-completion reason), testing details, and product roadmap/future development plan.
- [ ] Verify repository and deployed links, then submit once for the team through the Round 3 form: https://forms.gle/FxhT5Z1NupvGTGSw6. Submission closes 30 October at 11:59 pm; there is no late window.

**Acceptance checks**

- [ ] `npm run check` exits successfully on the final source state.
- [ ] Both end-to-end journeys pass on the deployed app, including the listed empty/error/retry checks; retain concise evidence (screenshots or a test record) for the team PDF.
- [ ] A clean clone can be installed and run using only README instructions and documented environment setup.
- [ ] All required submission items are present, links work, and the Round 2 commitment tracker contains exact commitment wording and evidence/status for all three rows.
- [ ] No unverified live provider, feature, metric, or deployment behavior is described as verified.

## Iteration Rule

For each failed check: capture the failing input and expected behavior, fix the smallest owning code path, rerun the same focused check, then rerun the full `npm run check` at the Phase 5 gate. Keep a short record of failures and resolutions. A blocked external provider check must be reported as blocked with the tested fallback behavior; it must not be marked passed merely because a mock passed.

## Scope Guardrails

- Keep the requested three-section experience. Do not add a new product direction or rebuild existing governance logic without a failing acceptance check that requires it.
- Prioritize the exact three Round 2 commitments alongside this plan; do not let uncommitted polish displace them.
- Do not promise that prompt injection or all vulnerabilities are eliminated. Implement layered controls and test defined attack cases.
- Do not make automatic publishing part of this round. A generated or evaluated result remains a human-reviewed draft unless the existing product contract explicitly says otherwise.
- Favor a reliable, explainable flow over extra features. Any feature left incomplete must be clearly disclosed in the final PDF.
