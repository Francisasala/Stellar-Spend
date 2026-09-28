# Build and Deployment Scripts

This directory contains scripts used for development, testing, and production deployment.

## Active Scripts

### Development & Build

- **run-next.cjs** - Next.js application launcher (used by: `npm run dev`, `npm run build`, `npm run start`)

### Code Quality

- **audit-contracts.sh** - Audits Rust contracts (used by: `npm run audit:contracts`)
- **check-licenses.js** - Validates third-party license compliance (used by: `npm run license:check`, `npm run license:report`)
- **check-orphaned-stories.js** - Finds unused Storybook stories (used by: `npm run storybook:check-orphans`, `npm run storybook:fix-orphans`)
- **generate-openapi.cjs** - Generates OpenAPI specification from code (used by: `npm run openapi:generate`)
- **validate-openapi.cjs** - Validates OpenAPI specification (used by: `npm run openapi:validate`)
- **verify-tsconfig.sh** - Validates TypeScript configuration

### CI/CD Deployment

- **blue-green-deploy.sh** - Blue-green deployment orchestration
- **canary-deploy.sh** - Canary deployment with controlled rollout
- **canary-metrics-check.sh** - Monitors canary deployment health metrics
- **check-diagrams.sh** - Validates architecture and process diagrams
- **test-disaster-recovery.sh** - Tests disaster recovery procedures

### Database & Migrations

- **migrate.ts** - Database schema migration runner

### Performance Testing

- **performance/** - Load testing scenarios
  - `load-test.js` - Main load testing script
  - `scenarios/` - Test scenario definitions (normal, peak, soak)

## Deprecated/Legacy Scripts (Removed)

The following scripts were removed as they were superseded by newer tools or are no longer maintained:

- `audit-dependencies.sh` - Replaced by npm audit
- `audit-log-viewer.sh` - Replaced by log aggregation services
- `deploy-contract.sh` - Integrated into CI/CD pipeline
- `find-commented-code.sh` - Use IDE search instead
- `migrate-console.ps1` - Platform-specific, use migrate.ts
- `pin-dependencies.sh` - Use npm's built-in features
- `remove-commented-code.sh` - Manual code review process
- `restore-db.sh` - Use backup/restore services
- `rollback-drill.sh` - Integrated into CI/CD procedures
- `rollback.sh` - Integrated into CI/CD procedures
- `rotate-secret.sh` - Use secrets management service
- `rotation-schedule.sh` - Use scheduled cloud tasks
- `validate-secrets.sh` - Use secrets management validation
- `verify-backup.sh` - Use backup services

## Adding New Scripts

When adding new scripts:

1. Follow the naming convention: `verb-noun.ext` (e.g., `deploy-contract.sh`)
2. Add documentation to this README.md
3. If the script is referenced in package.json, update the entry
4. Ensure scripts are executable: `chmod +x script.sh`
5. Add error handling and logging for production scripts
