# A8b — Citation field verification (F-M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close F-M3 by making `verifyCitations` check the numeric value at the _referenced field path_, not anywhere in the payload. A claim that carries `value` must also carry `field`; the verifier extracts the value at that exact dot-notation path and checks equality.

**Architecture:** A minimal schema + algorithm change: (1) `claimSchema` gains a required `field` property (when `value` is present), (2) `verifyCitations` replaces the recursive `containsNumber` scan with a targeted `getValueAtPath` read, (3) the model-facing prompt and scripted model are updated to emit `field`, (4) a regression test proves the old spoofing vector is closed.

**Tech Stack:** TypeScript (strict ESM, `.js` specifiers), Vitest, Zod.

---

## File Structure

- `packages/core/src/grounding/citations.ts` — `claimSchema` gains `field`; `verifyCitations` uses path extraction; `containsNumber` removed
- `packages/core/src/grounding/eleven.ts` — `groundingInstruction` prompt includes `field` guidance
- `packages/core/src/eval/scenarios.ts` — scripted model claims include `"field": "freeBytes"`
- `packages/core/test/grounding/citations.test.ts` — existing claims gain `field`; new regression test
- `packages/core/test/grounding/eleven.test.ts` — existing cited-answer claims gain `field`

---

### Task 1: Add `field` to `claimSchema` and close the spoofing vector in `verifyCitations`

**Files:**

- Modify: `packages/core/src/grounding/citations.ts`
- Test: `packages/core/test/grounding/citations.test.ts`

- [ ] **Step 1: Write the failing test (RED)**

Add to `packages/core/test/grounding/citations.test.ts`:

```ts
it("rejects a value that exists elsewhere in the payload but not at the claimed field (spoofing vector)", () => {
  const results = [toolResult("t1", true, { usedBytes: 999, freeBytes: 123 })];
  const answer: CitedAnswer = {
    text: "999 bytes free",
    claims: [
      {
        statement: "999 bytes free",
        citesToolResultId: "t1",
        value: 999,
        field: "freeBytes", // the field claims 999, but freeBytes is 123
      },
    ],
  };
  const issues = verifyCitations(answer, results);
  expect(issues).toHaveLength(1);
  expect(issues[0].reason).toBe("value-mismatch");
});

it("accepts a value when it matches exactly at the claimed field path", () => {
  const results = [toolResult("t1", true, { nested: { size: 42 } })];
  const answer: CitedAnswer = {
    text: "42",
    claims: [
      {
        statement: "42",
        citesToolResultId: "t1",
        value: 42,
        field: "nested.size",
      },
    ],
  };
  expect(verifyCitations(answer, results)).toEqual([]);
});
```

Also update the existing `passes when the cited id exists...` test to include `field: "freeBytes"`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/core/test/grounding/citations.test.ts`

Expected: FAIL — `field` does not exist on the schema (Zod rejects), or if the schema passes, `containsNumber` still returns `true` for the spoofed case (matching `999` in `usedBytes`).

- [ ] **Step 3: Add `field` to `claimSchema` and replace `containsNumber` with `getValueAtPath`**

In `packages/core/src/grounding/citations.ts`:

1. Update `claimSchema` to add `field`:

```ts
export const claimSchema = z.object({
  statement: z.string().min(1),
  citesToolResultId: z.string().min(1),
  value: z.number().optional(),
  field: z.string().min(1).optional(), // the referenced path when value is present
});
```

2. Add a `getValueAtPath` helper (replaces `containsNumber`):

```ts
/** Extract a value from a nested object by dot-notation path (e.g. "freeBytes" or "data.freeBytes"). */
function getValueAtPath(data: unknown, path: string): unknown {
  let current: unknown = data;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
```

3. Update `verifyCitations` to use `getValueAtPath`:

```ts
if (claim.value !== undefined) {
  const actual = getValueAtPath(successfulData.get(claim.citesToolResultId), claim.field ?? "");
  if (actual !== claim.value) {
    issues.push({
      statement: claim.statement,
      reason: "value-mismatch",
      detail: `tool result "${claim.citesToolResultId}" field "${claim.field}" expected ${claim.value}, got ${actual}`,
    });
  }
}
```

4. Remove the old `containsNumber` function.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/core/test/grounding/citations.test.ts`

Expected: PASS (the new cases + all existing citation cases).

- [ ] **Step 5: Build + Prettier**

Run: `npm run build && npx prettier --check packages/core/src/grounding/citations.ts packages/core/test/grounding/citations.test.ts`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/grounding/citations.ts packages/core/test/grounding/citations.test.ts
git commit -m "feat(core): verify cited numbers at referenced field path, not anywhere in payload (F-M3)"
```

---

### Task 2: Update the model-facing prompt and scripted model to emit `field`

**Files:**

- Modify: `packages/core/src/grounding/eleven.ts`
- Modify: `packages/core/src/eval/scenarios.ts`
- Test: `packages/core/test/grounding/eleven.test.ts`

- [ ] **Step 1: Update `groundingInstruction` to tell the model about `field`**

In `packages/core/src/grounding/eleven.ts`, update the `cited` case of `groundingInstruction`:

```ts
    case "cited":
      return (
        `You MUST call ${names} first, then answer ONLY as JSON: ` +
        `{"text": "...", "claims": [{"statement": "...", ` +
        `"citesToolResultId": "<tool-result id>", "value": <number, optional>, "field": "<dot-notation path, optional>"}]}. ` +
        `"field" is the exact path in the tool result where the number came from (e.g. "freeBytes" or "data.freeBytes"). ` +
        `Every factual claim must cite the tool-result id it came from. Do not guess; ` +
        `if you cannot ground the answer, reply ONLY with {"unknown": true, "reason": "..."}.`
      );
```

- [ ] **Step 2: Update the scripted model to emit `"field": "freeBytes"`**

In `packages/core/src/eval/scenarios.ts`, line 75:

```ts
              { statement: `${free} bytes are free`, citesToolResultId: "oc-1", value: free, field: "freeBytes" },
```

- [ ] **Step 3: Update existing tests to include `field`**

In `packages/core/test/grounding/eleven.test.ts`, update the cited-answer test cases (lines 73-103) to include `field: "freeBytes"` in their claim payloads:

- Line 75: `{ statement: "x", citesToolResultId: "oc-1" }` — no value, so no field needed
- Line 89: `{ statement: "999 bytes free", citesToolResultId: "oc-1", value: 999 }` → add `field: "freeBytes"`
- Line 99: `{ statement: "12345 bytes free", citesToolResultId: "oc-1", value: 12345 }` → add `field: "freeBytes"`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/core/test/grounding/eleven.test.ts packages/core/test/eval/grounding.test.ts`

Expected: PASS.

- [ ] **Step 5: Build + Prettier**

Run:

```bash
npm run build && npx prettier --check packages/core/src/grounding/eleven.ts packages/core/src/eval/scenarios.ts packages/core/test/grounding/eleven.test.ts
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/grounding/eleven.ts packages/core/src/eval/scenarios.ts packages/core/test/grounding/eleven.test.ts
git commit -m "feat(core): model prompt + scripted model emit field path for cited numbers (F-M3)"
```

---

### Task 3: Roadmap + full gate

**Files:**

- Modify: `docs/reviews/2026-06-09-production-readiness-review.md`

- [ ] **Step 1: Update the A8 roadmap line**

In `docs/reviews/2026-06-09-production-readiness-review.md`, replace the A8 line (item 8) with:

```md
8. **A8 — Input hardening (F-M2) + citation fix (F-M3) ✅ DONE (PR pending).** F-M2 closed: CSV column width via `reduce`; `ConverterRegistry` `maxInputChars` ceiling; XML depth cap. F-M3 closed: `verifyCitations` extracts the value at the exact `field` path (dot-notation) instead of recursively searching the whole payload; `field` is optional on the schema but the prompt and scripted model always emit it for numeric claims; a regression test proves the spoofing vector (value present elsewhere in payload but not at the claimed field) is rejected.
```

- [ ] **Step 2: Full repo gate**

Run:

```bash
npm run build && npm run lint && npm run format:check && npm run coverage && npm run test:functional
```

Expected: all green, coverage 100%.

- [ ] **Step 3: Docker gate**

Run: `docker build -f Dockerfile.test -t openhawkins-test . && docker run --rm openhawkins-test`

Expected: `✅ ALL GATES PASSED`

- [ ] **Step 4: Commit**

```bash
git add docs/reviews/2026-06-09-production-readiness-review.md
git commit -m "docs(review): A8 fully closed (F-M2 + F-M3); Track A correctness hardening complete"
```
