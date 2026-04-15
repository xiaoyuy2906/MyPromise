
type PromiseState = 'pending' | 'fulfilled' | 'rejected'
type PromiseResult = any
type PromiseResolver<T> = (result: T) => void
type PromiseRejecter = (reason: any) => void
type PromiseExecutor<T> = (resolve: PromiseResolver<T>, reject: PromiseRejecter) => void
type PromiseOnFulfiled<T, U> = (result: T) => U
type PromiseOnRejected<T> = (reason: any) => T
interface PromiseMicroTask {
  resolve: PromiseResolver<any>
  reject: PromiseRejecter
  onFulfilled: PromiseOnFulfiled<any, any>
  onRejected: PromiseOnRejected<any>
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

  then<U, V>(onFulfilled: PromiseOnFulfiled<T, U>, onRejected: PromiseOnRejected<V>): MyPromise<U | V> {
    return new MyPromise((resolve, reject) => {
      if (this._MyPromiseState == 'pending') {
        this._MyMicroTasks.push({
          resolve,
          reject,
          onFulfilled,
          onRejected
        })
      } else {
        const task: PromiseMicroTask = {
          resolve, reject, onFulfilled, onRejected
        }
        this._runMicroTask(this._MyPromiseState, task)
      }
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
    const exefn = state === 'fulfilled' ? onFulfilled : onRejected
    queueMicrotask(() => {
      try {
        resolve(exefn(this._MyPromiseResult))
      } catch (e) {
        reject(e)
      }
    })
  }
}



// let p = new Promise((resolve, reject) => {
//   console.log(333)
//   setTimeout(() => {
//     reject(44)
//     resolve(33)
//   }, 1000)
// }).then(() => 3333, () => 999)


