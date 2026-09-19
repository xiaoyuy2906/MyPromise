import { MyPromise } from './myPromise.ts'

// promise.js 原题，P 是要测的 Promise 实现，log 替代 console.log
function run(P: any): Promise<number[]> {
  const log: number[] = []
  P.resolve()
    .then(() => { log.push(0); return P.resolve(4) })
    .then((res: number) => { log.push(res) })
  P.resolve()
    .then(() => { log.push(1) })
    .then(() => { log.push(2) })
    .then(() => { log.push(3) })
    .then(() => { log.push(5) })
    .then(() => { log.push(6) })
  // 等微任务队列跑空
  return new Promise(r => setTimeout(() => r(log), 0))
}

const native = await run(Promise)
const mine = await run(MyPromise)
console.log('Promise   :', native.join(' '))
console.log('MyPromise :', mine.join(' '))
console.log(native.join() === mine.join() ? '✅ match' : '❌ mismatch')
