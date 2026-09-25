# Scholarship security abuse suite

`npm run test:security` is the CI evidence gate for the scholarship abuse cases. It runs in the frontend-v2 job after the full Vitest suite and covers security decisions plus the accessible page-shell permission state.

| Case                              | Control and remediation mapping                                                                               | Owner                    | Privacy and operational impact                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Cross-tenant object authorization | RBAC returns `CROSS_TENANT_DENIED`; API resource scoping is the remediation.                                  | Platform API             | Prevents disclosure across sponsor tenants; audit denials without application content.                 |
| Invitation replay                 | Acceptance requires the intended recipient, an unexpired token, and an unused record. Consume atomically.     | Identity + Platform API  | Invitation and recipient IDs are security events; repeated attempts should alert operations.           |
| File attacks                      | MIME, size, empty-file, private-storage, and scan-session checks run before completion.                       | Storage + Trust & Safety | Evidence is sensitive; retain only the private object, scan result, and access log required by policy. |
| Stored content                    | Applicant text is rendered as text and cannot create DOM nodes.                                               | Frontend                 | Preserve original text in the application record; never inject it as HTML or log it unsafely.          |
| Webhook forgery/replay            | HMAC, timestamp tolerance, constant-time comparison, and delivery IDs reject forged or stale deliveries.      | Integrations             | Secret references stay out of the client; failures use bounded retry and operational alerting.         |
| Wallet substitution               | A verified wallet must match both the recipient and the disbursement address.                                 | Payments                 | Address changes can place payments on hold and require auditable re-verification.                      |
| Payment retries                   | Idempotency binds actor, operation, resource, and payload; retries replay one outcome and mutations conflict. | Payments                 | Records live for 24 hours and are pruned; duplicate provider charges require reconciliation.           |

## Coverage expectations

Scholarship journeys expose loading, empty, error, success, and permission states with `role="status"`/`role="alert"`, labelled controls, keyboard-focusable links and buttons, and responsive grid layouts. Component tests cover the permission boundary; the abuse suite covers the security decisions. Playwright remains the browser-level check for responsive and keyboard journeys.

## Ownership and release handling

Findings are tracked against the owners above. A failing security test blocks CI, and the release checklist stays unsigned until remediation is merged, reviewed, and rerun. Migration and rollback work must preserve invitation consumption, idempotency records, wallet verification history, webhook delivery history, and document access logs.
