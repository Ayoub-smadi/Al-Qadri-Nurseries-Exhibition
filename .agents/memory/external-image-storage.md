---
name: External image storage
description: Durable storage decision for quotation and document images.
---

Image bytes belong in Vercel Blob; Neon stores only the Blob URL, content hash, MIME type, and size metadata.

**Why:** quotation records can contain hundreds of images and may grow to thousands of records, so Base64 in PostgreSQL creates avoidable database-storage cost and makes cross-device reads inefficient.

**How to apply:** require `BLOB_READ_WRITE_TOKEN` for image writes, deduplicate by SHA-256, and fail closed rather than writing Base64 to Neon when Blob storage is unavailable. Migrate legacy `images.data` rows in bounded batches before clearing their Base64 payloads.