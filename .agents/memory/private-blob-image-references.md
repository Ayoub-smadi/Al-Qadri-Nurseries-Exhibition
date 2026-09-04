---
name: Private Blob image references
description: How browser-facing site data should handle legacy Vercel Blob URLs.
---

When site data contains a legacy private Vercel Blob URL, rewrite it to the corresponding `/api/images/...` endpoint before rendering; do not expose the private Blob URL directly to browsers.

**Why:** private Blob URLs are not browser-readable without authorization, and older records may still contain them even when the image metadata lookup is unavailable or incomplete.

**How to apply:** derive the image record reference from the stored Blob pathname when possible, and keep an on-error visual fallback for public image cards so one missing object cannot create a blank layout.