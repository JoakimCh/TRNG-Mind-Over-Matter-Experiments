
import {TRNG} from '../TRNG.browser.js'
const log = console.log

// (44100 is one second of samples)
const trng = new TRNG({blockSize: 44100, outputLength: 16})

const start = document.createElement('button')
const stop = document.createElement('button')
start.textContent = 'Access microphone'
stop.textContent = 'Stop'
document.body.append(start)

const cfg = {
  weights: {
    noWord: 500, // for speed control
    biased: 5, // biased towards common words
    unbiased: 1, // without bias
  },
  visibleTime: 3000,
  volume: 1.0,
  utteranceSpeed: 0.7
}

start.onclick = async () => {
  if (trng.start()) {
    start.remove()
    const words = await loadWordlist()
    const weights = [
      cfg.weights.unbiased, // 0
      cfg.weights.biased,   // 1
      cfg.weights.noWord
    ]
    while (true) {
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
  }
}
stop.onclick = () => {
  trng.stop()
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
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.volume = cfg.volume
  utterance.rate = cfg.utteranceSpeed
  utterance.onstart = ({utterance}) => {
    displayWord(text, {unbiased, visibleTime: cfg.visibleTime})
    log((unbiased ? 'unbiased: ' : '') + utterance.text)
  }
  speechSynthesis.speak(utterance)
}

async function loadWordlist() {
  const words = []
  try {
    const response = await fetch('./en_50K.txt')
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


function loadCSSfile(url) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.append(link)
}

function loadCSS(cssString) {
  const style = document.createElement('style')
  style.textContent = cssString
  document.head.append(style)
}

loadCSSfile('./style.css')

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
