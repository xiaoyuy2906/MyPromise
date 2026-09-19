
type PromiseState = 'pending' | 'fulfilled' | 'rejected'
type PromiseResult = any
type PromiseResolver<T> = (result: T) => void
type PromiseRejecter = (reason: any) => void
type PromiseExecutor<T> = (resolve: PromiseResolver<T>, reject: PromiseRejecter) => void

// 根据标准，如果then的参数不是function，则我们需要忽略它，但是在这里我们只考虑then的参数都是函数
type PromiseOnFulfilled<T, U> = (result: T) => U
type PromiseOnRejected<T> = (reason: any) => T

interface PromiseMicroTask {
  resolve: PromiseResolver<any>
  reject: PromiseRejecter
  onFulfilled?: PromiseOnFulfilled<any, any>
  onRejected?: PromiseOnRejected<any>
}

export class MyPromise<T> {
  _MyPromiseState: PromiseState = 'pending'
  _MyPromiseResult: PromiseResult = undefined

  //一个 promise 还在 pending 时，记录所有已经通过 .then 注册、但还没法执行的回调。
  //是"同一个 promise 对象上调多次 .then"
  _MyMicroTasks: PromiseMicroTask[] = []

  constructor(executor: PromiseExecutor<T>) {
    // resolve 不是简单地把状态改成 fulfilled，而是先看 result 是什么，这就是 Promises/A+ §2.3 的 "Promise Resolution Procedure"。
    // 参见 https://github.com/xieranmaya/blog/issues/3 里的 resolvePromise，这里把它合并进了 resolve 本身（ES 规范也是这么做的），
    // 所以 .then 里回调的返回值、executor 里 resolve() 的参数，走的都是同一套逻辑。处理了三种情况：
    //   1. result 就是自己        → 死循环，reject TypeError
    //   2. result 是 thenable     → 跟着它的状态走（MyPromise、原生 Promise、任何带 .then 方法的对象/函数）
    //   3. 其他普通值             → 直接 fulfilled
    let executorResolvedOrRejected = false
    const myResolve: PromiseResolver<T> = (result: any) => {

      // 1. 自己 resolve 自己：p = x.then(() => p)，p 永远等不到结果，直接 reject
      if (this === (result as any)) {
        return myReject(new TypeError('Chaining cycle detected for promise!'))
      }
      if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
        // 2. thenable：.then 只读一次（§2.3.3.1），它可能是个会抛错的 getter，抛了就 reject
        let then
        let thenCalledOrThrow = false
        try {
          then = result.then
        } catch (e) {
          return myReject(e)
        }
        if (typeof then === 'function') {
          // 把自己的 resolve/reject 交给 thenable，等它 settled 后再回来 resolve 自己；
          // 如果它给回来的还是 thenable，会再进一次 myResolve 继续拆，直到拆出普通值。
          // 放进微任务是按 ES 规范来的（NewPromiseResolveThenableJob），
          // 这就是为什么 resolve(一个 promise) 比 resolve(普通值) 要多等两个 tick。
          queueMicrotask(() => {
            try {
              then.call(result, (res: any) => { // 2.3.3.3.1
                if (thenCalledOrThrow) return // 2.3.3.3.3 即这三处谁选执行就以谁的结果为准
                thenCalledOrThrow = true
                return myResolve(res) // 2.3.3.3.1
              }, (rea: any) => { // 2.3.3.3.2
                if (thenCalledOrThrow) return // 2.3.3.3.3 即这三处谁选执行就以谁的结果为准
                thenCalledOrThrow = true
                return myReject(rea)
              })
            } catch (e) {
              if (thenCalledOrThrow) return
              thenCalledOrThrow = true
              myReject(e)
            }
          })
          return
        }
      }

      // 3. 普通值（包括没有 .then 的对象/函数）：直接 fulfilled
      this._changeState('fulfilled', result)
    }

    const myReject: PromiseRejecter = (reason) => {
      this._changeState('rejected', reason)
    }
    try {
      executor((res: any) => {
        if (executorResolvedOrRejected) return
        executorResolvedOrRejected = true
        myResolve(res)
      }, (rea: any) => {
        if (executorResolvedOrRejected) return
        executorResolvedOrRejected = true
        myReject(rea)
      })
    } catch (e) {
      if (executorResolvedOrRejected) return
      executorResolvedOrRejected = true
      myReject(e)
    }
  }

  then<U, V>(onFulfilled?: PromiseOnFulfilled<T, U>,
    onRejected?: PromiseOnRejected<V>): MyPromise<U | V | T> {

    // 根据标准，如果then的参数不是function，则我们需要忽略它，这里的ts做了更加严格的类型限制

    return new MyPromise((resolve, reject) => {
      const task: PromiseMicroTask = { resolve, reject, onFulfilled, onRejected }
      if (this._MyPromiseState == 'pending') {
        this._MyMicroTasks.push(task)
      } else {
        this._runMicroTask(this._MyPromiseState, task)
      }
    })
  }

  static resolve<Type1>(result: Type1): MyPromise<any> {
    if (result instanceof MyPromise) {
      return result
    }
    return new MyPromise((resolve) => resolve(result))
  }

  static reject(reason?: any): MyPromise<never> {
    return new MyPromise<never>((_, reject) => {
      reject(reason)
    })
  }

  _changeState(newState: 'fulfilled' | 'rejected', r: any): void {
    if (this._MyPromiseState == 'pending') {
      this._MyPromiseState = newState
      this._MyPromiseResult = r
      const pendingTasks = this._MyMicroTasks
      this._MyMicroTasks = []
      for (const task of pendingTasks) {
        this._runMicroTask(newState, task)
      }
    }
    return
  }

  _runMicroTask(state: 'fulfilled' | 'rejected', microTask: PromiseMicroTask): void {
    const { resolve, reject, onFulfilled, onRejected } = microTask
    const exefn = state === 'fulfilled'
      ? (onFulfilled ?? ((value: any) => value))
      : (onRejected ?? ((reason: any) => { throw reason }))
    // 可以实现了值的穿越
    queueMicrotask(() => {
      try {
        // resolve 是 promise2 的 myResolve，自身循环 / thenable / 普通值都由它处理
        resolve(exefn(this._MyPromiseResult))
      } catch (e) {
        reject(e)
      }
    })
  }
}



