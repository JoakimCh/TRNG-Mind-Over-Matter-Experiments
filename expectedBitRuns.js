
// https://math.stackexchange.com/questions/4705148/estimate-the-average-difference-from-the-expected-amount-of-bit-runs-in-true-ran

function create2dArray(rows, cols, initialValue) {
  const array = Array(rows)
  for (let i=0; i<rows; i++) {
    array[i] = Array(cols).fill(initialValue)
  }
  return array
}

function copy2dArray(array) {
  const copy = Array(array.length)
  for (let i=0; i<array.length; i++) {
    copy[i] = array[i].slice()
  }
  return copy
}

function getDist(rl, bs) {
  const u = Math.floor(bs / rl)
  const dist = Array(u+2).fill(0)
  let old = create2dArray(rl+2, u+2, 0)
  let cur = create2dArray(rl+2, u+2, 0)

  old[1][1] = 1

  for (let block=1; block < bs; block++) {
    for (let j=1; j <= u+1; j++) {
      for (let r=1; r < rl; r++) {
        cur[1][j] += old[r][j] / 2
        if (r > 1) cur[r][j] = old[r-1][j] / 2
      }
      if (rl > 1) cur[rl][j] = old[rl-1][j] / 2
      cur[1][j] += old[rl+1][j] / 2
      if (j > 1) cur[1][j] += old[rl][j-1] / 2
      cur[rl+1][j] = (old[rl][j] + old[rl+1][j]) / 2
    }
    old = copy2dArray(cur)
    cur = create2dArray(rl+2, u+2, 0)
  }

  for (let j=1; j <= u+1; j++) {
    for (let i=1; i < rl; i++) {
      dist[j] += old[i][j]
    }
    dist[j] += old[rl+1][j]
    if (j > 1) dist[j] += old[rl][j-1]
  }

  return dist
}

/** Calculates the expected average/mean run count for the blockSize and runLength. */
export function expectedAverageRunCount(blockSize, runLength) {
  if (runLength > blockSize) return 0
  if (runLength == blockSize) {
    return (blockSize-(runLength-2)) / 2**(runLength)
  }
  return (blockSize-(runLength-3)) / 2**(runLength+1)
}

/** Calculates the expected average run counts for the blockSize up to maxRunLength. */
export function expectedRunCounts(blockSize, maxRunLength = blockSize) {
  const result = [{}] // (run length 0)
  for (let runLength=1; runLength <= maxRunLength; runLength++) {
    const dist = getDist(runLength, blockSize).slice(1)
    // let expAvg = 0
    // for (let i=0; i < dist.length; i++) {
    //   expAvg += i * dist[i]
    // }
    const expAvg = expectedAverageRunCount(blockSize, runLength) // should be same as expAvg
    let expAvgDiff = 0
    for (let i=0; i < dist.length; i++) {
      expAvgDiff += Math.abs(i - expAvg) * dist[i]
    }
    result.push({
      average: expAvg,
      averageDeviation: expAvgDiff
    })
  }
  return result
}
