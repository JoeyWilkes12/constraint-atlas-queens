# Replit Deployment Specification — Constraint Atlas Queens

Status: implementation-ready

## Table of contents

- [Decision](#decision)
- [Source-of-truth contract](#source-of-truth-contract)
- [Build configuration](#build-configuration)
- [Release procedure](#release-procedure)
- [Acceptance criteria](#acceptance-criteria)
- [Operations and rollback](#operations-and-rollback)
- [References](#references)

## Decision

Deploy Constraint Atlas as a separate public **Replit Static Deployment** in
the existing Replit Core workspace.

The workbench needs no server: the generated page contains the styles, model
data, deterministic teaching checker, SMT-LIB generator, and interaction code.
Only `og.png` remains a separate asset. Static hosting is therefore sufficient
and avoids Autoscale or Reserved VM compute.

Initial production settings:

| Setting | Value |
|---|---|
| Deployment type | Static |
| Visibility | Public |
| Build command | `npm run build:pages` |
| Public directory | `dist/pages` |
| Database or storage | None |
| Secrets | None |
| Preferred subdomain | `constraint-atlas-queens` |

## Source-of-truth contract

GitHub repository
[`JoeyWilkes12/constraint-atlas-queens`](https://github.com/JoeyWilkes12/constraint-atlas-queens),
branch `main`, is the authoritative source for final deployments. GitHub source
control and repository visibility are already connected to Replit.

Every production publish must be built from a pushed commit on `main`. Replit
Agent may run builds and tests, configure Static Publishing, inspect logs, and
republish that commit. It must not generate a replacement app or publish
uncommitted Replit-only application changes.

## Build configuration

Build command:

```text
npm run build:pages
```

Public directory:

```text
dist/pages
```

Set the build environment variable `PAGES_URL` to the final Replit origin with
a trailing slash, for example:

```text
https://constraint-atlas-queens.replit.app/
```

Despite its historical name, `PAGES_URL` is the canonical-origin input used by
the existing static builder. It ensures Open Graph and Twitter image metadata
reference the deployed Replit `og.png`. The value is configuration, not a
secret.

The `.replit` Run command exists only for Preview. Static Publishing must serve
`dist/pages` directly and must not start the Preview HTTP server in production.

## Release procedure

1. Run `npm test` locally; it builds and validates both production targets.
2. Commit and push the reviewed state to GitHub `main`.
3. In Replit, import or open the repository through the connected GitHub
   repository picker.
4. Confirm Preview renders the generated `dist/pages` artifact.
5. Select Static Publishing, public visibility, `npm run build:pages`, and
   `dist/pages`.
6. Reserve the subdomain, set `PAGES_URL` to its HTTPS origin, and publish the
   exact GitHub commit.
7. Record the commit SHA and public URL after production acceptance.

## Acceptance criteria

- `npm test` passes without installing third-party packages.
- Static Publishing completes from the committed build command.
- `/` and `/index.html` render the complete workbench.
- `/og.png` returns the expected social image.
- Open Graph and Twitter metadata use the final Replit HTTPS origin.
- Board selection, rule toggles, deterministic run, trace, constraint
  inspection, copy, and SMT-LIB export work.
- Keyboard navigation and responsive layouts remain usable.
- Browser inspection shows no runtime API, database, authentication, or
  persistence dependency.
- No Autoscale or Reserved VM deployment exists for this project.

## Operations and rollback

Monitor deployment status, transfer usage, browser errors, and the public
artifact after each publish. Static Deployments consume no compute units; only
applicable outbound data transfer is billable beyond plan allowances.

Rollback means republishing the last known-good GitHub commit. GitHub Pages and
the existing Sites deployment remain independent fallbacks until the user
explicitly retires them.

## References

- [Replit Core](https://docs.replit.com/billing/plans/replit-core)
- [Static Deployments](https://docs.replit.com/cloud-services/deployments/static-deployments)
- [Publishing costs](https://docs.replit.com/billing/deployment-pricing)
- [Monitoring a deployment](https://docs.replit.com/references/publishing/monitoring-a-deployment)
- [Import from GitHub](https://docs.replit.com/build/import-from-providers)
