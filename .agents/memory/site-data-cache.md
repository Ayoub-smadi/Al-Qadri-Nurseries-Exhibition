---
name: Site data cache
description: Cache behavior for the public site configuration response.
---

The public site-data response must be fetched without browser revalidation and should not advertise a reusable cache.

**Why:** the frontend expects JSON to rebuild defaults and image references; a 304 response has no JSON body and can leave a stale local cache with blank or broken product images.

**How to apply:** keep the client request no-store and return no-store from both API entrypoints when changing site-data caching behavior.