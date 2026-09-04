---
name: Vercel workspace install
description: Deployment install behavior for this pnpm monorepo when unrelated workspace packages cannot be downloaded.
---

Vercel builds should install only the dependency graphs required by the deployed website and API, rather than every package in the workspace.

**Why:** unrelated workspace tooling can be blocked or unavailable in the package registry even when the website and API dependencies are healthy; a full workspace install then fails before the production build starts.

**How to apply:** keep the lockfile complete and valid, and use filtered frozen installs for `@workspace/nursery-showcase...` and `@workspace/api-server...` in the deployment build command.