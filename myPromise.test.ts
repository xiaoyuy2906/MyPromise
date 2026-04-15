import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MyPromise } from './myPromise.ts'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Flush all pending microtasks then yield to the event loop */
const flushMicrotasks = () => new Promise<void>(r => setTimeout(r, 0))

// ── tests ────────────────────────────────────────────────────────────────────

describe('MyPromise – construction', () => {
  it('starts in pending state', () => {
    const p = new MyPromise(() => { })
    assert.equal(p._MyPromiseState, 'pending')
    assert.equal(p._MyPromiseResult, undefined)
  })

  it('transitions to fulfilled when resolve is called', () => {
    const p = new MyPromise<number>((resolve) => resolve(42))
    assert.equal(p._MyPromiseState, 'fulfilled')
    assert.equal(p._MyPromiseResult, 42)
  })

  it('transitions to rejected when reject is called', () => {
    const p = new MyPromise((_resolve, reject) => reject('oops'))
    assert.equal(p._MyPromiseState, 'rejected')
    assert.equal(p._MyPromiseResult, 'oops')
  })

  it('rejects when the executor throws', () => {
    const err = new Error('boom')
    const p = new MyPromise(() => { throw err })
    assert.equal(p._MyPromiseState, 'rejected')
    assert.equal(p._MyPromiseResult, err)
  })

  it('ignores a second state change (resolve then reject)', () => {
    const p = new MyPromise<number>((resolve, reject) => {
      resolve(1)
      reject('ignored')
    })
    assert.equal(p._MyPromiseState, 'fulfilled')
    assert.equal(p._MyPromiseResult, 1)
  })

  it('ignores a second state change (reject then resolve)', () => {
    const p = new MyPromise<number>((resolve, reject) => {
      reject('first')
      resolve(99)
    })
    assert.equal(p._MyPromiseState, 'rejected')
    assert.equal(p._MyPromiseResult, 'first')
  })
})

describe('MyPromise – then() on already-settled promise', () => {
  it('calls onFulfilled when promise is already fulfilled', async () => {
    let received: number | undefined
    const p = new MyPromise<number>((resolve) => resolve(7))
    p.then((v) => { received = v; return v }, () => -1)
    await flushMicrotasks()
    assert.equal(received, 7)
  })

  it('calls onRejected when promise is already rejected', async () => {
    let received: string | undefined
    const p = new MyPromise((_r, reject) => reject('bad'))
    p.then(() => 'ok', (reason) => { received = reason; return reason })
    await flushMicrotasks()
    assert.equal(received, 'bad')
  })

  it('then() returns a new promise resolved with onFulfilled return value', async () => {
    const p = new MyPromise<number>((resolve) => resolve(3))
    const p2 = p.then((v) => v * 10, () => -1)
    await flushMicrotasks()
    assert.equal(p2._MyPromiseState, 'fulfilled')
    assert.equal(p2._MyPromiseResult, 30)
  })

  it('rejects the chained promise when onFulfilled throws', async () => {
    const err = new Error('handler error')
    const p = new MyPromise<number>((resolve) => resolve(1))
    const p2 = p.then(() => { throw err }, () => 'ignored')
    await flushMicrotasks()
    assert.equal(p2._MyPromiseState, 'rejected')
    assert.equal(p2._MyPromiseResult, err)
  })
})

describe('MyPromise – then() with async resolve (pending at registration time)', () => {
  it('queues the callback and calls it after async resolve', async () => {
    let received: number | undefined
    const p = new MyPromise<number>((resolve) => {
      setTimeout(() => resolve(55), 10)
    })
    p.then((v) => { received = v; return v }, () => -1)

    assert.equal(received, undefined) // not called yet
    await new Promise(r => setTimeout(r, 20))
    await flushMicrotasks()
    assert.equal(received, 55)
  })

  it('queues multiple then callbacks on the same pending promise', async () => {
    const results: number[] = []
    const p = new MyPromise<number>((resolve) => {
      setTimeout(() => resolve(10), 10)
    })
    p.then((v) => { results.push(v); return v }, () => -1)
    p.then((v) => { results.push(v * 2); return v }, () => -1)

    await new Promise(r => setTimeout(r, 20))
    await flushMicrotasks()
    assert.deepEqual(results, [10, 20])
  })
})

describe('MyPromise – async resolve dispatch', () => {
  it('calls onFulfilled instead of onRejected after async resolve', async () => {
    let calledFulfilled = false
    let calledRejected = false

    const p = new MyPromise<number>((resolve) => {
      setTimeout(() => resolve(42), 10)
    })
    p.then(
      () => { calledFulfilled = true; return 1 },
      () => { calledRejected = true; return -1 }
    )

    await new Promise(r => setTimeout(r, 20))
    await flushMicrotasks()

    assert.equal(calledFulfilled, true)
    assert.equal(calledRejected, false)
  })
})
