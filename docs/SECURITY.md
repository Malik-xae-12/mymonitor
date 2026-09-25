# Microsoft Fabric Monitoring Hub — Security Architecture & Threat Model

**Document Version:** 3.0  
**Updated:** 2026-09-26  
**Status:** Approved & Enforced  

---

## 1. Authentication Architecture

The platform integrates enterprise single sign-on (SSO) with **Microsoft Entra ID (Azure Active Directory)**:

```
[Browser Client] 
       │ (1) Authenticate with Entra ID via MSAL (PKCE Flow)
       ▼
[Microsoft Entra ID] ──> Returns ID Token & Access Token
       │
       │ (2) HTTP Request with 'Authorization: Bearer <token>'
       ▼
[FastAPI Backend]
       │ (3) Local JWT Signature Verification
       ▼
[In-Memory JWKS Cache] (Microsoft Public Keys, 24h TTL)
```

### Security Controls:
1. **No Shared Passwords**: User passwords are never entered or stored in the application. Authentication delegates entirely to Microsoft Entra ID.
2. **Stateless JWT Verification**: The backend validates tokens using Microsoft's JSON Web Key Set (`jwks_uri`). Keys are cached in memory for 24 hours to prevent network bottlenecks.
3. **Audience & Tenant Scoping**: Tokens are verified against `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` to prevent cross-tenant token replay attacks.

---

## 2. Authorization & Role-Based Access Control (RBAC)

The platform enforces the principle of least privilege across three roles:
- **`admin` (Administrator)**: Unrestricted access to tenant workspaces, user directory, role assignment, and Delta table column mappings.
- **`l1` (L1 Support Lead)**: Access strictly scoped to assigned workspaces and pipelines where designated as L1 contact. Administrative consoles and configuration modals are masked.
- **`l2` (L2 Escalation Owner)**: Access strictly scoped to assigned workspaces and pipelines where designated as L2 escalation owner. Administrative controls are masked.

### Server-Side Enforcement:
Frontend visual masking is backed by server-side verification:
- `users_service.resolve_access()` computes accessible workspace and pipeline IDs.
- API route guards reject unpermitted workspace access with HTTP 403 Forbidden.

---

## 3. Database Security & SQL Injection Prevention

### Zero Raw SQL Policy:
- 100% of internal application persistence operates through **SQLAlchemy 2.0 Async ORM**.
- All queries utilize SQLAlchemy expression constructs (`select()`, `update()`, `delete()`, `sqlite_upsert()`).
- Direct string formatting or concatenation (`cursor.execute(f"SELECT * FROM ...")`) is **strictly prohibited**.
- Parameter binding is automatically enforced by the underlying SQLite driver.

---

## 4. Network & Transport Security

1. **Transport Layer Security (TLS)**: All production client-to-backend communication MUST use HTTPS and secure WebSockets (`wss://`).
2. **SMTP Transport Security**: Automated incident alerts dispatch over SMTP using **STARTTLS** encryption on port 587 with credential authentication.
3. **CORS Restrictions**: Cross-Origin Resource Sharing is locked down to designated frontend origin URLs in `app.core.config.settings.CORS_ORIGINS`.

---

## 5. Secret Management & Audit Logging

1. **Environment Segregation**: Secrets (client secrets, SMTP passwords, Gemini API keys) are injected exclusively through environment variables and validated via Pydantic Settings.
2. **Secret Redaction in Logs**: Log formatters redact Bearer tokens, passwords, and sensitive connection strings to prevent credential exposure in application traces.
3. **Incident Audit Trail**: All incident resolutions log the resolver's identity (`resolved_by`) and timestamp (`resolved_at`) for compliance audits.
