# KYC/Compliance Decision Boundaries

This document describes the jurisdiction-specific business rules and legal compliance frameworks encoded in `src/lib/kyc-limits.ts`, `src/lib/kyc-provider.ts`, and `src/lib/compliance-screening.ts`.

## Jurisdiction Tiers

Stellar-Spend categorizes jurisdictions into three compliance tiers, each with distinct restrictions and verification requirements.

### Restricted Jurisdictions (Fully Blocked)

**ISO 3166-1 alpha-2 codes:** KP, IR, SY, CU

- **Status:** No service available; no override possible
- **Reference:** OFAC Specially Designated Nationals (SDN) List; UN sanctions comprehensive embargoes
- **Decision Boundary:** Any user claiming residency or connection to these jurisdictions is rejected at onboarding with a hard error
- **Legal Sign-off:** Treasury/Compliance review on annual OFAC list updates

### Warning Jurisdictions (Elevated Compliance Monitoring)

**ISO 3166-1 alpha-2 codes:** RU, BY, VE

- **Status:** Served with heightened AML screening and mandatory warning disclosure
- **Rationale:** Heightened sanctions risk, limited payment corridors, or regulatory complexity
- **User Experience:** Onboarding presents explicit compliance warning; users must acknowledge before proceeding
- **Limit Overrides:** May be restricted via corridor config based on payment partner risk appetite
- **Legal Sign-off:** Compliance review for each new warning jurisdiction

### Allowed Jurisdictions (Standard KYC Path)

All other jurisdictions fall into this category and follow standard KYC verification tiers.

---

## KYC Verification Levels & Limit Tiers

Each user may access one of three limit tiers after passing corresponding verification.

### Tier 1: Basic Verification (Default)

- **Verification Level:** `basic` (email & phone)
- **Daily Limit:** $1,000
- **Monthly Limit:** $10,000
- **Per-Transaction Limit:** $500
- **Expiry:** No expiry (basic verification is perpetual)
- **Upgrade Path:** Users can request tier 2 or tier 3 after completing advanced/enhanced verification

### Tier 2: Advanced Verification (Government ID)

- **Verification Level:** `advanced` (government ID upload + liveness check)
- **Daily Limit:** $5,000
- **Monthly Limit:** $50,000
- **Per-Transaction Limit:** $2,500
- **Expiry:** 1 year from verification date (re-verification required after expiry)
- **Upgrade Path:** Request tier 3 after completing enhanced verification

### Tier 3: Enhanced Verification (In-Person or Biometric)

- **Verification Level:** `enhanced` (in-person identity verification or advanced biometric check)
- **Daily Limit:** $50,000
- **Monthly Limit:** $500,000
- **Per-Transaction Limit:** $25,000
- **Expiry:** 180 days from verification date (expedited re-verification cycle for higher-value access)
- **Upgrade Path:** Terminal tier; no further upgrades available
- **Compliance Note:** Tier 3 access is reviewed quarterly by the Compliance team for high-volume users

### Corridor-Specific Limit Overrides

Payment corridors (e.g., NGN <-> USDC) may have different limit structures based on regulatory, partner, or operational constraints.

**Example:** Nigeria (NGN) corridor tier 2:
- Daily Limit: $10,000 (vs. global $5,000)
- Monthly Limit: $100,000 (vs. global $50,000)
- Per-Transaction Limit: $5,000 (vs. global $2,500)

**Configuration Source:** `corridor-config` (server-side) synced into KYC limits at startup via `setCorridorOverrides()`.

---

## KYC Provider Fallback Behavior

Stellar-Spend abstracts verification provider logic to support multiple external services.

### Current Providers

#### SandboxKycProvider (Default)

- **Use Case:** Development, testing, CI pipelines
- **Behavior:** Immediately approves all verification requests; simulates realistic expiry dates
- **Expiry Configuration:**
  - `basic`: No expiry
  - `advanced`: 1 year
  - `enhanced`: 180 days

#### Production Providers (Future/Extensible)

The provider interface (`KycProviderInterface`) supports additional implementations (e.g., Jumio, IDology, Onfido). Each must implement:

- `submitVerification(userId, level, identityData)` — Submit identity documents for verification
- `checkStatus(verificationId)` — Poll verification result
- `requestReverification(userId, reason)` — Trigger re-verification when tier changes

### Provider Selection Logic

```typescript
getKycProvider(name?: string): KycProviderInterface
```

- If `name` is omitted or `"sandbox"`: returns `SandboxKycProvider`
- If `name` is unknown: throws error (fail-fast for configuration errors)
- Production deploys override via environment variable (e.g., `KYC_PROVIDER=jumio`)

### Fallback on Verification Failure

If a provider fails (network error, service down):

1. **For high-value transactions** (≥$10,000): Fail closed — deny transaction with `screening_error_fail_closed` flag
2. **For standard transactions**: Fail open — allow transaction with `screening_error_fail_open` flag (logged for manual review)

**Rationale:** Prevent false negatives on high-value AML events; maintain UX for low-risk flows.

---

## AML Screening Rules

AML screening assigns a risk score (0–100) based on user and transaction attributes. Scores determine verdict: allow | review | deny.

### Risk Score Components

#### User Verification Status
- Unverified user: +30 points
- Pending KYC: +30 points
- Verified user: 0 points

#### Transaction Amount
- ≥$10,000: +20 points
- ≥$50,000: +30 points (additional)

#### Limit Proximity
- Transaction >90% of tier daily/monthly/per-txn limit: +15 points

### Risk Level Determination

| Score | Level   | Verdict | Action |
|-------|---------|---------|--------|
| 0–19  | Low     | Allow   | Process immediately |
| 20–44 | Medium  | Allow   | Flag for manual review; add to compliance report |
| 45–69 | High    | Review  | Hold transaction; require manual Compliance approval |
| 70+   | Blocked | Deny    | Reject transaction; log incident |

**Legal Context:** This scoring model aligns with FinCEN guidance on transaction monitoring and OFAC compliance thresholds.

---

## Compliance Screening & Overrides

Transaction screening checks recipient addresses against external watchlists and internal override rules.

### Screening Verdicts

- **allow:** Address passed risk checks; transaction proceeds
- **review:** Address flagged for compliance review; manual approval required (business tier)
- **deny:** Address blocked (SDN, sanctioned entity); transaction rejected with no override option

### Override Behavior

Compliance operations can create manual overrides for known-good addresses or business partnerships.

**Override Attributes:**
- `address` (Stellar/EVM/bank account)
- `verdict` (allow | review | deny)
- `reason` (audit trail; e.g., "Bank partner verified Q4 2025")
- `createdBy` (ops user identifier)
- `expiresAt` (optional; null = perpetual)

**Use Case Example:** Partner exchange address pre-approved for high-volume flows.

### Fail-Safe Defaults

If screening provider is down or unreachable:

- **High-value transactions:** Fail closed (deny) — prevents compliance blind spots
- **Standard transactions:** Fail open (allow) — maintains UX; logged for investigation

**Cache Duration:** Results cached for 15 minutes (configurable per provider).

---

## Compliance Reporting

The `KYCLimitService.generateComplianceReport(from, to)` method produces periodic reports for Compliance/Legal review.

### Report Fields

```typescript
{
  generatedAt: number;
  period: { from: number; to: number };
  
  // KYC metrics
  totalUsers: number;
  verifiedUsers: number;
  pendingVerifications: number;
  rejectedVerifications: number;
  
  // AML/Risk metrics
  highRiskUsers: number;
  blockedUsers: number;
  
  // Transaction metrics
  totalTransactionVolume: number;
  flaggedTransactions: number;
}
```

**Generation Frequency:** Monthly (triggered by scheduled job at start of each month).

**Distribution:** Sent to Compliance Lead and General Counsel for review and regulatory filing.

---

## Re-verification Triggers

Users may be required to re-verify if:

1. **KYC Expiry:** Verification period (1 year for tier 2, 180 days for tier 3) has elapsed
2. **Tier Upgrade:** User requests limit increase requiring higher verification level
3. **AML Alert:** High-risk screening flag raises re-verification requirement (manual Compliance decision)
4. **Regulatory Update:** New jurisdiction or provider rules trigger bulk re-verification (rare; compliance-driven)

**Expiry Grace Period:** 30-day courtesy reminder before hard expiry; transactions blocked 1 day after expiry unless re-verification completed.

---

## Audit Trail

All KYC and limit-related events are recorded in the audit trail for regulatory evidence and dispute resolution.

### Auditable Events

- `kyc_submitted` — User submits identity documents
- `kyc_verified` — Verification provider approves identity
- `kyc_rejected` — Verification provider rejects documents
- `kyc_expired` — User's verification period expires
- `tier_changed` — User's limit tier upgraded or downgraded
- `limit_increase_requested` — User requests higher tier
- `limit_increase_approved` / `limit_increase_rejected` — Compliance decision on tier request
- `reverification_triggered` — Re-verification required (e.g., expiry or AML alert)
- `provider_verified` — External verification provider confirms identity

**Storage:** Browser localStorage (development); production deploys use secure server-side audit log.

**Retention:** Minimum 7 years (per AML/KYC regulatory requirements).

---

## Integrations & Cross-References

### corridor-config (Server)
Defines payment corridor rules (limits, fees, corridors, verification requirements). Syncs to KYC limits on startup.

**Cross-Reference:** `kyc-limits.ts:setCorridorOverrides()` → loads corridor config at boot time.

### compliance-screening.ts
Performs real-time transaction recipient screening (SDN lists, watchlists). Complements KYC with per-transaction safeguards.

**Cross-Reference:** Before transaction approval, `screenAddress()` checks recipient against screening providers and compliance overrides.

### Compliance Dashboard (Future)
Exposes real-time KYC and AML metrics to Compliance team for monitoring and manual overrides.

**Planned Integrations:**
- Real-time high-risk user alerts
- Bulk KYC renewal management
- Screening override creation/revocation
- Compliance report generation and export

---

## Legal & Regulatory Sign-Offs

All compliance rules in this system are reviewed and approved by:

- **Compliance Lead** — Day-to-day KYC/AML policy
- **General Counsel** — Legal risk & liability review
- **Finance/Treasury** — OFAC and sanctions compliance
- **Audit Firm (Annual)** — Third-party validation of controls

**Policy Review Cadence:** Quarterly (or upon regulatory guidance update).

**Last Reviewed:** [To be filled by Compliance team]

**Next Review:** [To be filled by Compliance team]

---

## Questions & Escalations

For questions about KYC, AML, or compliance boundaries:

1. **Product/Engineering:** Reach out to Compliance Lead
2. **Business/Legal Questions:** General Counsel
3. **Urgent Compliance Issues:** Escalate to CFO

All KYC/compliance changes require Compliance Lead and General Counsel sign-off before deployment.
