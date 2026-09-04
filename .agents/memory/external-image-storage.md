---
name: External image storage
description: Durable storage decision for quotation and document images.
---

Image bytes belong in Neon PostgreSQL (`BYTEA`); the API stores the content hash, MIME type, and size alongside each image and serves it through `/api/images/:id`.

**Why:** the product owner explicitly requires one storage system and does not want Blob; Neon is the source of truth for image persistence.

**How to apply:** deduplicate by SHA-256, write the binary buffer to `images.data_bytes`, keep bounded legacy Base64 backfill support, and return the application image endpoint to browsers. Do not add a Blob dependency or require a Blob token.