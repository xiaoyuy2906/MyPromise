
type PromiseState = 'pending' | 'fulfilled' | 'rejected'
type PromiseResult = any
type PromiseResolver<T> = (result: T) => void
type PromiseRejecter = (reason: any) => void
type PromiseExecutor<T> = (resolve: PromiseResolver<T>, reject: PromiseRejecter) => void
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
  _MyMicroTasks: PromiseMicroTask[] = []
  constructor(executor: PromiseExecutor<T>) {
    const myResolve: PromiseResolver<T> = (result) => {
      this._changeState('fulfilled', result)
    }

    const myReject: PromiseRejecter = (reason) => {
      this._changeState('rejected', reason)
    }
    try {
      executor(myResolve, myReject)
    } catch (e) {
      myReject(e)
    }
  }

  then<U, V>(onFulfilled?: PromiseOnFulfilled<T, U>,
    onRejected?: PromiseOnRejected<V>): MyPromise<U | V | T> {
    return new MyPromise((resolve, reject) => {
      if (this._MyPromiseState == 'pending') {
        this._MyMicroTasks.push({
          resolve,
          reject,
          onFulfilled,
          onRejected,
        })
      } else {
        const task: PromiseMicroTask = {
          resolve,
          reject,
          onFulfilled,
          onRejected,
        }
        this._runMicroTask(this._MyPromiseState, task)
      }
    })
  }

  static resolve<Type1>(result: Type1): MyPromise<any> {
    if (result instanceof MyPromise) {
      return result
    } 
    return new MyPromise((resolve, reject) => {
      if (
        result !== null &&
        (typeof result === 'object' || typeof result === 'function') &&
        typeof (result as any).then === 'function'
      ) {
        try {
          (result as any).then(resolve, reject)
        } catch (e) {
          reject(e)
        }
      } else {
        resolve(result)
      }
    })
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
    queueMicrotask(() => {
      try {
        let r = exefn(this._MyPromiseResult)
        this._resolvePromise(r, resolve, reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  _resolvePromise(r: any, resolve: PromiseResolver<any>, reject: PromiseRejecter): void {
    if (r instanceof MyPromise) {
      r.then(resolve, reject)
      return
    } else if (
      r !== null && (typeof r === 'object' || typeof r === 'function') && typeof r.then === 'function'
    ) {
      try {
        r.then(resolve, reject)
      } catch (e) {
        reject(e)
      }
      return
    } else {
      resolve(r)
    }
    // The Promises/A+ spec (§2.3.3) requires any object or function with a callable `.then` method (a "thenable") to be assimilated.
  }
}



