# MyPromise

A TypeScript implementation of the native `Promise` API, built to understand how Promises work under the hood.

## What Is Implemented

- `new MyPromise(executor)` — runs executor synchronously, catches thrown errors
- `.then(onFulfilled?, onRejected?)` — chains promises, handlers run via `queueMicrotask`
- `MyPromise.resolve(value)` — flattens `MyPromise` instances and thenables
- `MyPromise.reject(reason?)` — returns `MyPromise<never>`


## Known Limitations

- No cycle detection (self-resolving chain deadlocks silently)
- `catch`, `finally`, `Promise.all`, `Promise.race` not yet implemented
