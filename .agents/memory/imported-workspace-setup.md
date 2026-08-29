---
name: Imported pnpm workspace setup
description: Environment-specific setup behavior for imported multi-package pnpm workspaces.
---

Imported pnpm workspaces can contain a valid lockfile but no installed node_modules, so configured workflows may fail with missing Vite or esbuild binaries until dependencies are installed.

**Why:** Importing source and lockfiles does not guarantee that workspace package dependencies have been materialized in the environment.

**How to apply:** When an imported pnpm workspace reports missing local binaries, install from the existing lockfile before investigating application code or changing workflow commands.