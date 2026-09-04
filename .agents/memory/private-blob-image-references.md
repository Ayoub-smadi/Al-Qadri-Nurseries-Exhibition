---
name: Legacy image references
description: How browser-facing site data should handle old external image URLs after Neon became the source of truth.
---

When site data contains a legacy external/private image URL, rewrite it to the corresponding `/api/images/...` endpoint only when the matching image bytes are present in Neon; do not expose a private Blob URL directly to browsers.

**Why:** old records can retain external URLs after an image is re-uploaded, while the browser should use the Neon-backed endpoint consistently.

**How to apply:** derive the SHA-256 from a legacy pathname when possible, map it only to a Neon-backed row, and keep an on-error visual fallback for public image cards.