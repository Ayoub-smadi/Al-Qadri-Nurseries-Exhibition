---
name: Imported pnpm workspace setup
description: Environment-specific setup behavior for imported multi-package pnpm workspaces.
---

Imported pnpm workspaces can contain a valid lockfile but no installed node_modules, so configured workflows may fail with missing Vite or esbuild binaries until dependencies are installed.

**Why:** Importing source and lockfiles does not guarantee that workspace package dependencies have been materialized in the environment.

**How to apply:** When an imported pnpm workspace reports missing local binaries, install from the existing lockfile before investigating application code or changing workflow commands.

If a full frozen install is blocked by an unrelated workspace-only package, install the target artifact with its recursive workspace dependencies instead of changing the lockfile or bypassing the package firewall.

**Why:** Imported monorepos can include tooling packages that are not needed by the app being previewed and may fail independently of the target artifact.

**How to apply:** Prefer a filtered frozen install such as the target web artifact plus its workspace dependency graph when validating a focused UI change.