---
name: Git synchronization
description: Workspace behavior to account for when finishing changes and pushing to GitHub
---

Automatic workspace synchronization may leave the checkout in an in-progress rebase with unresolved files, even when the target commit is already present on the configured GitHub branch.

**Why:** A normal commit/push flow can be misleading in this state: conflict markers may remain in the working tree, while the remote is already up to date after the synchronization.

**How to apply:** Check `git status`, resolve and stage any unmerged files, complete the rebase, compare local and remote commit IDs, and run a normal push so Git confirms whether anything remains to publish.