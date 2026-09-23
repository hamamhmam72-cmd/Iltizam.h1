---
name: Generated client DOM iterable
description: TypeScript library settings needed by generated browser clients.
---

Generated API clients can use `Headers.entries()`, so composite client-library TypeScript configs need both `dom` and `dom.iterable` in their `lib` list.

**Why:** The generated fetch helper typechecks against the iterable Headers API, which is not included by `dom` alone.

**How to apply:** When codegen succeeds but the shared API client fails on `Headers.entries`, inspect the client library `tsconfig` before changing generated files.