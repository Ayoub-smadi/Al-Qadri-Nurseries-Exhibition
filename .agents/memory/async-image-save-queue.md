---
name: Async image save ordering
description: Image replacement callbacks can finish out of order and overwrite newer site settings.
---

Persist site-data updates from a current state reference and serialize writes whenever image uploads resolve asynchronously.

**Why:** logo, ticker, gallery, and store image uploads can complete in a different order than the user selected them; parallel full-document writes can restore an older document over a newer edit.

**How to apply:** use functional/ref-based state composition and a save queue for site settings, and ensure re-uploads of legacy images write fresh bytes to Neon instead of reusing an old Blob reference.