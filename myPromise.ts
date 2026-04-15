
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

  static resolve<Type1>(result: Type1): MyPromise<Type1> {
    return new MyPromise((resolve, reject) => {
      resolve(result)
    })
  }

  static reject<Type2>(reason: Type2): MyPromise<Type2> {
    return new MyPromise((resolve, reject) => {
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
    const exefn = state === 'fulfilled' ? onFulfilled : onRejected
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
    } else {
      resolve(r)
    }
  }
}



// var p = new MyPromise((resolve, reject) => {
//   console.log(333)
//   setTimeout(() => {
//     reject(44)
//     resolve(33)
//   }, 1000)
// }).then(() => 3333, () => 999)


// var v = 99
// var p0 = MyPromise.resolve(1000).then((r) => {
//   v = r + v
//   return MyPromise.resolve(v)
// }, () => { })
// console.log(v)


