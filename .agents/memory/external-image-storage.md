---
name: Neon image storage
description: Current project decision for persistent site and quotation images.
---

Image bytes are stored in the Neon `images` table; site and quotation JSON stores only short `/api/images/:id` references.

**Why:** the owner explicitly chose the paid Neon PostgreSQL database as the source of truth and wants image records to survive across devices without browser/localStorage dependence.

**How to apply:** deduplicate uploads by SHA-256, keep Base64 payloads out of `site_config`, serve image bytes through the API, and use the matching legacy Blob token only for the one-time migration of old private Blob rows.