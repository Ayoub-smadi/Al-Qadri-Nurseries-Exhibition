---
name: Admin record sync
description: Durable rule for records that should follow the admin across browsers and devices.
---

Admin-owned records must use authenticated central storage and have matching routes in both the local API server and the deployed serverless API entrypoint.

**Why:** the frontend uses the same relative API paths locally and in production, but the two backend entrypoints can drift; a route present only locally makes a feature appear to work in preview while failing on other devices.

**How to apply:** when adding a synced admin record type, add its table initialization, authenticated list/save/delete routes, and response envelope to both backend entrypoints. Keep localStorage as a cache or migration source, never as the cross-device source of truth.