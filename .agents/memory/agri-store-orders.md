---
name: Agricultural store orders
description: Durable rules for product pricing, images, and delivery fees in the agricultural store.
---

Product image references and the selected delivery area are part of the customer order data. Product images should be stored as server URLs rather than stripped from submitted order items, and shipping must remain zero until the customer selects a configured delivery area.

**Why:** The admin needs to identify ordered products visually, while showing a shipping fee before an area is chosen creates misleading totals.

**How to apply:** Keep product price/image fields editable by admins, derive the fee from the selected shipping zone, and validate that the zone is selected before accepting delivery orders.