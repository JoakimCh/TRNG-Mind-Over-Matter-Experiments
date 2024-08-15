
import {expectedRunCounts} from './expectedBitRuns.js'
// export function expAvgRunCount(blockSize, runLength) {
//   if (runLength > blockSize) return 0
//   if (runLength == blockSize) {
//     return (blockSize-(runLength-2)) / 2**(runLength)
//   }
//   return (blockSize-(runLength-3)) / 2**(runLength+1)
// }

export class RunCountAnalyzer {
  #maxLength; #blockSize; #prevBit; #onRunCount; #bitRun; #bitIndex
  #runLength; //#totalRunLength = 0; #totalAbsDeviation = 0
  #blockNumber = 0; #expected; #sum
  #lastPrint = 0
  #bytesSinceLastPrint = 0
  /**
   * @param {object} options 
   * @param {number} options.blockSize Block size in bits.
   * @param {number} options.maxLength Max bit run length to monitor.
   */
  constructor({blockSize, onBlockDone, maxLength = 100}) {
    if (maxLength > blockSize) {
      maxLength = blockSize
    }
    // get the expected average run count per run length (and the expected average absolute difference)
    this.#expected = expectedRunCounts(blockSize, maxLength) //Array(maxLength + 1)
    this.#sum = Array(maxLength + 1)
    for (let runLength=1; runLength <= maxLength; runLength++) {
      this.#sum[runLength] = {runCount: 0, deviation: 0}
    }

    this.#blockSize = blockSize
    this.#maxLength = maxLength
    this.#onRunCount = onBlockDone

    this.reset()
  }

  reset() {
    this.#bitRun = Array(this.#maxLength + 1).fill(0)
    this.#bitIndex = 0
    this.#runLength = 0
  }

  processData(input) {
    if (input instanceof ArrayBuffer) {
      input = new Uint8Array(input)
    } else {
      if (!ArrayBuffer.isView(input)) throw Error(`Input must be an ArrayBuffer or an ArrayBuffer view. Not ${input}.`)
      input = new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    }
    for (const byte of input) {
      this.processByte(byte)
    }
  }

  processByte(byte) {
    this.#bytesSinceLastPrint ++
    for (let i=0; i<8; i++) {
      const bit = (byte >> i) & 1
      if (this.#runLength === 0) { // first
        this.#runLength = 1
        this.#prevBit = bit
      } else if (bit === this.#prevBit) { // same
        this.#runLength ++
      } else { // different (end of sequence)
        if (this.#runLength <= this.#maxLength) {
          this.#bitRun[this.#runLength] ++ // count it
        }
        this.#runLength = 1
        this.#prevBit = bit
      }
      if (++this.#bitIndex === this.#blockSize) {
        if (this.#runLength <= this.#maxLength) {
          this.#bitRun[this.#runLength] ++ // count last
        }
        this.#blockNumber ++
        this.#analyzeBlock(this.#bitRun)
        this.#onRunCount(this.#bitRun)
        this.reset()
      }
    }
  }

  #analyzeBlock(bitRuns) {
    const average = Array(this.#maxLength + 1)
    for (let runLength=1; runLength <= this.#maxLength; runLength++) {
      const avg = average[runLength] = {}
      const sum = this.#sum[runLength]
      const expected = this.#expected[runLength]
      // const expectedTotalRunLength = expected.average * this.#blockNumber
      sum.runCount += bitRuns[runLength]
      sum.deviation += Math.abs(expected.average - bitRuns[runLength])
      avg.totalRunCount = sum.runCount
      avg.avgRunCount = sum.runCount / this.#blockNumber
      avg.avgRunCountDiff = Math.abs(diffP(expected.average, avg.avgRunCount)) // current avgRunLength deviation
      avg.avgDeviation = sum.deviation / this.#blockNumber // avg abs deviation
      avg.avgDeviationDiff = Math.abs(diffP(expected.averageDeviation, avg.avgDeviation))
      // avg.totalDeviation = Math.abs(diffP(expectedTotalRunLength, sum.runCount)) // abs total dev (same as above)
      // avgRunCountDiff is useful for checking that the run lengths counted are within the normal
      // avgDeviationDiff is useful for checking that they're not TOO normal, because lack of deviation would be abnormal
      for (const key in avg) {
        avg[key] = avg[key].toFixed(4)
      }
    }
    const now = Date.now()
    if (now >= this.#lastPrint + 1000) {
      this.#lastPrint = now
      // console.log('bytes last second:', this.#bytesSinceLastPrint)
      console.table(average)
      this.#bytesSinceLastPrint = 0
    }
  }

}

function diffP(control, value) {
  return (value / control) * 100 - 100
}
