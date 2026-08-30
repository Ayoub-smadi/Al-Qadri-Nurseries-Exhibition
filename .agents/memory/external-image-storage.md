---
name: External image storage
description: Durable storage decision for quotation and document images.
---

Image bytes belong in Vercel Blob; Neon stores only the Blob URL, content hash, MIME type, and size metadata.

**Why:** quotation records can contain hundreds of images and may grow to thousands of records, so Base64 in PostgreSQL creates avoidable database-storage cost and makes cross-device reads inefficient.

**How to apply:** require `BLOB_READ_WRITE_TOKEN` for image writes, deduplicate by SHA-256, and fail closed rather than writing Base64 to Neon when Blob storage is unavailable. Migrate legacy `images.data` rows in bounded batches before clearing their Base64 payloads.

Private Blob stores require `access: "private"` for writes and server-side `get()` streaming for reads; return an application image endpoint to browsers rather than the private Blob URL.

**Why:** a private store rejects public uploads, and its URLs cannot be loaded directly by the browser without authenticated server access.

**How to apply:** keep Blob URLs in the database, stream private blobs through the authenticated API, preserve legacy public-URL redirects, and use `Cache-Control: private, no-cache`.