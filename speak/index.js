
import {TRNG} from '../TRNG.browser.js'
import {log, pageSetup, e, tags, wrap, unwrap, consumeTags} from '../wrapped-elements/wrapped-elements.js'

pageSetup({
  title: 'Speak Experiment',
  favicon: 'speak.png',
  stylesheets: 'style.css'
})

document.body.append(...unwrap(
  e.h1('Speak Experiment'),
  e.p('A strong enough mind can influence the spoken words! Which could enable trans-dimensional communication...'),
  e.div.tagAndId('history'),
  e.div.tagAndId('spoken'),
  e.div(
    e.button('Start experiment').tag('start'),
    e.button('Stop experiment').tag('stop').hidden(true),
  )
))

/** Our tagged elements.
 * @info Here we use TypeScript type definitions so VSCode can know the contents of el.
 * @type {Record<'start'|'stop'|'history'|'spoken', HTMLElement>} 
*/
const el = consumeTags()

// (44100 is one second of samples)
const trng = new TRNG({blockSize: 44100, outputLength: 16})

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

el.start.onclick = async () => {
  if (!running) {
    running = true
    el.start.hidden = true
    if (!el.history.textContent) {
      el.history.textContent = 'History: '
    }
    wakeLock = await navigator.wakeLock?.request()
    await trng.start()
    el.stop.hidden = false
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
    el.start.hidden = false
  }
}
el.stop.onclick = () => {
  if (!stopping) {
    stopping = true
    el.stop.hidden = true
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
  displayWord(text, {unbiased, visibleTime: cfg.visibleTime})
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.volume = cfg.volume
  utterance.rate = cfg.utteranceSpeed
  utterance.onstart = ({utterance}) => {
    // this service is not enabled in every browser
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

function displayWord(word, {unbiased, visibleTime = 2000} = {}) {
  log((unbiased ? 'unbiased: ' : '') + word)
  const span = e.span(word + '\u00A0').className('word')
  if (unbiased) span.classList.add('unbiased')
  el.spoken.append(span.element)
  setTimeout(() => {
    span.classList.add('fade')
    setTimeout(() => {
      span.remove()
      el.history.textContent += word + ' '
    }, 1000) // fade time
  }, visibleTime)
}
