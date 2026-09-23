---
name: RTL viewport overflow
description: Why a visually responsive RTL page may appear horizontally shifted in preview
---

On a right-to-left page, an absolutely positioned decoration extending outside the page can enlarge the document's scrollable width. The browser then aligns the expanded document to the right, pushing otherwise correctly sized content offscreen.

**Why:** This was observed in the desktop preview of the Eltizam public page: its header and hero were clipped even though the page's grid dimensions were valid.

**How to apply:** When an RTL preview looks horizontally shifted, check document overflow and decorative pseudo-elements before changing grid track sizes. Bound decorative overflow within its section and verify both desktop and mobile screenshots.