# MyPromise

A TypeScript implementation of the native `Promise` API, built to understand how Promises work under the hood.

Primary reference: [剖析Promise内部结构，一步一步实现一个完整的、能通过所有Test case的Promise类](https://github.com/xieranmaya/blog/issues/3) — the thenable handling and the "first call wins" flag follow its `resolvePromise`. Spec references are to [Promises/A+](https://promisesaplus.com/) and the ECMAScript spec.

## What Is Implemented

- `new MyPromise(executor)` — runs executor synchronously, catches thrown errors
- `.then(onFulfilled?, onRejected?)` — chains promises, handlers run via `queueMicrotask`; omitted handlers pass the value / reason through
- `MyPromise.resolve(value)` — returns the same instance for a `MyPromise`, otherwise resolves through the standard resolution procedure
- `MyPromise.reject(reason?)` — returns `MyPromise<never>`

## How Resolution Works

The Promise Resolution Procedure (Promises/A+ §2.3) lives inside the constructor's `resolve`, the same way the ES spec does it (`CreateResolvingFunctions`), so `resolve(x)` in an executor and a value returned from a `.then` handler go through identical logic:

- `resolve(promiseItself)` → rejects with `TypeError` (chaining cycle)
- `resolve(thenable)` → reads `.then` once, then adopts its state in a microtask (`NewPromiseResolveThenableJob`); nested thenables are unwrapped recursively
- `resolve(anythingElse)` → fulfills

Both `resolve`/`reject` pairs — the one handed to the executor and the one handed to a thenable — only honor the first call. A later `reject` after `resolve(pendingPromise)`, or a thenable calling both callbacks, is ignored (§2.3.3.3.3, ES `alreadyResolved`).

Microtask ordering matches V8: `resolve(promise)` settles two ticks later than `resolve(value)`. `pnpm play` runs the classic 0–6 ordering puzzle against both `Promise` and `MyPromise`.

## Scripts

```sh
pnpm test   # node --test myPromise.test.ts
pnpm dev    # same, in watch mode
pnpm play   # eventloop.ts — compare microtask ordering with native Promise
```

## Known Limitations

- Non-function arguments to `.then` are not ignored (the chained promise rejects with a `TypeError`); handlers are assumed to be functions
- Return types don't unwrap: a handler returning `MyPromise<X>` types the chain as `MyPromise<MyPromise<X>>`
- `catch`, `finally`, `Promise.all`, `Promise.race` not yet implemented
