
import {TRNG} from '../TRNG.browser.js'
import {log, css} from '../common.js'

// (44100 is one second of samples)
const trng = new TRNG({blockSize: 44100, outputLength: 16})

const start = document.createElement('button')
const stop = document.createElement('button')
start.textContent = 'Start experiment'
stop.textContent = 'Stop experiment'
document.body.append(start)

// log(await getVoices())

let running, stopping, wakeLock
const cfg = {
  weights: {
    noWord: 500, // for speed control
    biased: 5, // biased towards common words
    unbiased: 1, // without bias
  },
  visibleTime: 3000,
  volume: 1.0,
  utteranceSpeed: 1.0
}

start.onclick = async () => {
  // speak('starting')
  if (!running) {
    running = true
    start.remove()
    wakeLock = await navigator.wakeLock?.request()
    await trng.start()
    document.body.prepend(stop)
    const words = await loadWordlist()
    const weights = [
      cfg.weights.unbiased, // 0
      cfg.weights.biased,   // 1
      cfg.weights.noWord
      // todo: number
    ]
    while (!stopping) {
      const cmd = await trng.weightedInteger(weights)
      switch (cmd) {
        case 0: { // select without a bias
          const index = await trng.integer(words.length-1)
          speak(words[index], true)
        } break
        case 1: { // select with a bias towards common words
          const index = await trng.linearlyWeightedInteger(true, 0, words.length-1)
          speak(words[index])
        } break
      }
    }
    trng.stop()
    wakeLock?.release()
    running = false
    stopping = false
    document.body.prepend(start)
  }
}
stop.onclick = () => {
  if (!stopping) {
    stopping = true
    stop.remove()
  }
}

async function getVoices(timeout = 4000) {
  const start = Date.now()
  while (!speechSynthesis.getVoices().length) {
    if (Date.now() > start + timeout) return []
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  return speechSynthesis.getVoices()
}

function speak(text, unbiased = false) {
  log((unbiased ? 'unbiased: ' : '') + text)
  displayWord(text, {unbiased, visibleTime: cfg.visibleTime})
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.volume = cfg.volume
  utterance.rate = cfg.utteranceSpeed
  utterance.onstart = ({utterance}) => {
    // log('spoke: '+utterance)
    // this service is sometimes down...
  }
  speechSynthesis.speak(utterance)
}

async function loadWordlist() {
  const words = []
  try {
    const response = await fetch('en_50K.txt')
    if (!response.ok) throw response.status
    const lines = (await response.text()).split('\n')
    for (const line of lines) {
      const [word, frequency] = line.split(' ')
      if (word) words.push(word)
    }
  } catch (error) {
    throw `Error fetching wordlist: ${error}`
  }
  return words
}

css.fromFile('style.css')

const wordContainer = document.createElement('div')
wordContainer.id = 'word-container'
document.body.append(wordContainer)

function displayWord(word, {unbiased, visibleTime = 2000} = {}) {
  const span = document.createElement('span')
  wordContainer.append(span)
  span.className = 'word'
  span.textContent = word + '\u00A0'
  if (unbiased) {
    span.classList.add('unbiased')
  }
  setTimeout(() => {
    span.classList.add('fade')
    setTimeout(() => {
      span.remove()
    }, 2000) // fade time
  }, visibleTime)
}
