# Code Review: `myPromise.ts`

## What Is Implemented

| Part | Description |
|------|-------------|
| Constructor | Runs the executor synchronously, catches thrown errors and rejects |
| `_changeState` | Guards state transitions — a promise can only move from `pending` once |
| `then` | Returns a new `MyPromise`, schedules handlers via `queueMicrotask` |
| `_runMicroTask` | Picks the right handler, schedules it asynchronously, pipes return value through `_resolvePromise` |
| `_resolvePromise` | Chains the next promise if the handler returned a `MyPromise`, otherwise resolves directly |
| `static resolve` | Wraps a value in an immediately-resolved `MyPromise` |
| `static reject` | Wraps a reason in an immediately-rejected `MyPromise` |

## What Works Correctly

- State is immutable once settled — `_changeState` checks `== 'pending'` before acting
- Executor runs synchronously inside the constructor
- Executor exceptions are caught and forwarded to `reject`
- `then` handlers are always scheduled asynchronously via `queueMicrotask`
- `then` returns a new `MyPromise` — basic chaining works
- Pending tasks are flushed when the promise settles

---

## Bugs and How to Fix Them

### ~~BUG 1 (Critical) — `then` handlers are not optional — lines 35, 12–13~~ ✅ FIXED

~~**Problem**~~

~~Both `onFulfilled` and `onRejected` were required by their TypeScript types. The Promises/A+ spec (§2.2.1) says both are optional. When a handler was omitted, `_runMicroTask` called `exefn(...)` where `exefn` was `undefined`, throwing a `TypeError` inside the microtask.~~

**How it was fixed**

- `then` parameters are now optional (`?`) on line 35
- `_runMicroTask` applies `??` fallbacks at lines 99–101 so `exefn` is always a valid function:

```ts
const exefn = state === 'fulfilled'
  ? (onFulfilled ?? ((value: any) => value))
  : (onRejected  ?? ((reason: any) => { throw reason }))
```

---

### ~~BUG 2 (Critical) — `_resolvePromise` ignores generic thenables — line 92~~ ✅ FIXED

~~**Problem**~~

~~`_resolvePromise` only checked `r instanceof MyPromise`, missing native `Promise`, third-party libraries, and plain objects with a `.then` method.~~

**How it was fixed**

Lines 112–129 now handle all thenables — `instanceof MyPromise` is a fast path, followed by a generic thenable check:

```ts
} else if (
  r !== null && (typeof r === 'object' || typeof r === 'function') && typeof r.then === 'function'
) {
  try {
    r.then(resolve, reject)
  } catch (e) {
    reject(e)
  }
```

---

### ~~BUG 3 (High) — `static resolve` does not flatten thenables — lines 53–57~~ ✅ FIXED

~~**Problem**~~

~~`MyPromise.resolve(value)` always called `resolve(result)` directly, wrapping native Promises or thenables as plain values.~~

**How it was fixed**

Lines 57–76 now short-circuit for `MyPromise` instances and assimilate any other thenable:

```ts
static resolve<Type1>(result: Type1): MyPromise<any> {
  if (result instanceof MyPromise) return result
  return new MyPromise((resolve, reject) => {
    if (...typeof (result as any).then === 'function') {
      (result as any).then(resolve, reject)
    } else {
      resolve(result)
    }
  })
}
```

---

### BUG 4 (High) — No self-resolution cycle check — `_resolvePromise`

**Problem**

The Promises/A+ spec (§2.3.1) requires that if the promise returned by `then` and the resolved value `r` are the same object, the promise must be rejected with a `TypeError`. Without this check, a self-referential chain silently deadlocks.

**How to fix**

Pass the chained promise reference into `_resolvePromise` and check for cycles at the top:

```ts
// In then(), capture the new promise reference and pass it in:
_resolvePromise(r: any, self: MyPromise<any>, resolve: PromiseResolver<any>, reject: PromiseRejecter): void {
  if (r === self) {
    reject(new TypeError('Chaining cycle detected for promise'))
    return
  }
  // ... rest of existing logic
}
```

---

### ~~BUG 5 (Medium) — `PromiseMicroTask` interface fields are non-optional — lines 9–14~~ ✅ FIXED

~~**Problem**~~

~~`onFulfilled` and `onRejected` were required in the interface, causing TypeScript errors when handlers were omitted.~~

**How it was fixed**

Lines 12–13 now use `?` to make both fields optional:

```ts
onFulfilled?: PromiseOnFulfiled<any, any>
onRejected?: PromiseOnRejected<any>
```

---

### ~~MINOR 6 (Low) — Typo: `PromiseOnFulfiled` — line 7 and all usages~~ ✅ FIXED

~~**Problem**~~

~~`PromiseOnFulfiled` was missing a letter.~~

**How it was fixed**

Renamed `PromiseOnFulfiled` → `PromiseOnFulfilled` on lines 7, 12, and 35.

---

### ~~MINOR 7 (Low) — `static reject` return type should be `MyPromise<never>` — line 78~~ ✅ FIXED

~~**Problem**~~

~~`static reject<Type2>(reason: Type2): MyPromise<Type2>` used the rejection reason type as the fulfillment type, which is misleading.~~

**How it was fixed**

```ts
static reject(reason?: any): MyPromise<never> {
  return new MyPromise<never>((_, reject) => {
    reject(reason)
  })
}
```

---

## Priority Summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | Critical | `then` handlers not optional — passthrough broken and runtime crash when omitted | ✅ Fixed |
| 2 | Critical | `_resolvePromise` ignores generic thenables (only `instanceof MyPromise`) | ✅ Fixed |
| 3 | High | `static resolve` does not flatten thenables | ✅ Fixed |
| 4 | High | No self-resolution cycle detection | ❌ Open |
| 5 | Medium | `PromiseMicroTask` interface fields must be made optional | ✅ Fixed |
| 6 | Low | Typo: `PromiseOnFulfiled` → `PromiseOnFulfilled` | ✅ Fixed |
| 7 | Low | `static reject` return type should be `MyPromise<never>` | ✅ Fixed |

## Remaining Fix Order

1. Add cycle detection in `_resolvePromise` (BUG 4)

## Tests Worth Adding After Fixes

- `then()` with no fulfilled handler — value passes through
- `then()` with no rejected handler — reason re-throws
- Handler returns a native `Promise` — chain adopts its state
- Handler returns a foreign thenable — chain adopts its state
- `MyPromise.resolve()` with a thenable argument — flattened correctly
- Self-resolution rejects with `TypeError`
