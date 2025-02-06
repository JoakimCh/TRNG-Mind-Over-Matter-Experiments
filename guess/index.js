
import {RTCPerfectNegotiator} from 'rtc-perfect-negotiator'
import {PeerServerSignalingClient, peerjsIceConfig, ensureClientReady} from 'tiny-peerserver-client'
import {debug, pageSetup, e, tags, wrap, unwrap, consumeTags} from 'wrapped-elements'

pageSetup({
  title: 'Guess Experiment',
  allowDarkTheme: false, // skip the style injection for this
  stylesheets: 'style.css',
  favicon: false // set to a blank one
})

/* todo 
on connection hide table and display side selector,
radio for which peer is remote viewer:
remote viewer: you (), peer (), alternate (*)
whenever someone clicks it changes for both... so they can fight
then ready checkbox and a text indicating if peer is ready, ready is deselected on each switch
when both ready it starts, first with text on which side you are:
"A random card is shown to your peer, to score see if you can guess which!
     (remote view it or use your telepathic ability)"
[show cards] (then shows the cards and you can make selection)
other side:
header below cards: "this is the card your peer must guess to score
        (either through remote viewing or telepathic ability)
          you can help by transmitting it telepathically"

stats are stored in the browser and can be downloaded as a csv
then stats for each peer and session and total stats, etc
a stat viewer is WIP...

if alternating then total and last10 lines can include stats for both e.g. 10 / 10 (me) 10 / 10 (peer)
*/

document.body.append(...unwrap(
  e.div(
    e.h1('The Guess Experiment'),
    e.p('Connect to a peer and try to guess the randomly selected card shown on their screen. This can be done using remote viewing (extra sensory perception) or telepathy with the peer who can see the card. Version: 0.2.'),
    e.div(
      e.label('My ID:',
        e.input().type('text').tagAndId('input_myId')
        .value(localStorage.getItem('myId'))
        .autocapitalize('none')
      ),
      e.label('Peer ID:', 
        e.input().type('text').tagAndId('input_peerId')
        .value(localStorage.getItem('peerId'))
        .autocapitalize('none')
      )
    ).className('cleanBreak').tagAndId('id_container'),
    e.div(
      e.button('Ready for peer connection').tag('button_ready'),
      e.button('Abort peer connection').tag('button_abort').hidden(true),
      e.button('Try to connect').tag('button_connect').hidden(true),
      e.span('Offline.').tag('text_connection').className('offline'),
    ).className('cleanBreak'),
    e.div(
      e.div(...((cards = []) => {
        for (const variant of ['star','box','waves','cross','circle']) {
          const card = e.div(
            e.img().draggable(false).src(`zener/${variant}.svg`)
          ).className('card')
          cards.push(card)
        }
        return cards
      })()).tagAndId('table'),
      e.button('Make your guess!').tag('button_guess'),
      e.span('Total score: ', e.span('0 / 0').tag('text_score')),
      e.span('Last 10 guesses: ', e.span('0 / 0').tag('text_last10'))
    ).tagAndId('gameUI').set('disabled', '')
  ).id('container')
))

//#region global variables
const {input_myId, input_peerId, button_ready, 
  button_connect, table, button_guess, id_container,
  button_abort, text_connection
} = consumeTags()
globalThis['DEBUG_SIGNALING'] = true
const idSuffix = '-guessExp'
let myId, peerId
/** @type {PeerServerSignalingClient} */
let signalingClient
/** @type {RTCPeerConnection} */
let peerConnection
/** @type {RTCDataChannel} */
let dataChannel
//#endregion

//document.querySelector('.element').classList.add('shrink');

button_guess.onclick = () => {
  let selectedIndex = Math.round(Math.random() * 5)
  let index = 0
  for (const card of document.getElementsByClassName('card')) {
    if (index++ == selectedIndex) {
      card.classList.add('correct')
    } else if (!card.classList.contains('selected')) {
      card.classList.add('hidden')
    }
  }
}

function card_onClick({currentTarget}) {
  for (const card of document.getElementsByClassName('card')) {
    card.classList.remove('selected')
  }
  currentTarget.classList.add('selected')
}
for (const card of document.getElementsByClassName('card')) {
  card.draggable = false
  card.onclick = card_onClick
}

button_ready.onclick = () => {
  myId = input_myId.value
  peerId = input_peerId.value
  if (!myId || !peerId) {
    alert('Please fill out "my ID" and "peer ID"!')
    return
  }
  localStorage.setItem('myId', myId)
  localStorage.setItem('peerId', peerId)
  id_container.setAttribute('disabled','')
  button_ready.hidden = true
  button_abort.hidden = false
  initPeerConnection(myId, peerId, idSuffix)
}

button_abort.onclick = () => {
  resetConnection()
}

button_connect.onclick = () => {
  button_connect.hidden = true
  dataChannel = peerConnection.createDataChannel('protocol1')
  onDataChannel({channel: dataChannel})
}

function resetConnection() {
  peerConnection?.close()
  signalingClient?.close()
  text_connection.className = 'offline'
  text_connection.textContent = 'Offline.'
  button_connect.hidden = true
  button_abort.hidden = true
  id_container.removeAttribute('disabled')
  button_ready.hidden = false
  id_container.hidden = false
}

async function initPeerConnection(myId, peerId, suffix) {
  myId += suffix; peerId += suffix
  try {
    signalingClient = await ensureClientReady({myId, signalingClient})
  } catch (error) {
    button_abort.click()
    return alert(error)
  }
  const signalingChannel = signalingClient.getChannel(peerId)
  const negotiator = new RTCPerfectNegotiator({
    peerConfiguration: peerjsIceConfig,
    signalingChannel
  })
  peerConnection = negotiator.peerConnection
  button_connect.hidden = false
  initPeerConnectionEvents(peerConnection)
  // (negotiation is not done before a channel or track is added)
}

/**
 * @param {RTCPeerConnection} peerConnection 
 */
function initPeerConnectionEvents(peerConnection) {
  peerConnection.ondatachannel = onDataChannel
  peerConnection.onconnectionstatechange = () => {
    debug('connectionState', peerConnection.connectionState)
    switch (peerConnection.connectionState) {
      case 'connecting':
        button_connect.hidden = true
      break
      case 'connected':
        debugConnectionStats()
        id_container.hidden = true
        button_connect.hidden = true
        text_connection.className = 'online'
        text_connection.textContent = 'Online.'
      break
      case 'disconnected':
        text_connection.className = 'reconnecting'
        text_connection.textContent = 'Reconnecting...'
      break
      case 'closed':
        resetConnection()
      break
    }
  }
}

function onDataChannel({channel} = {}) {
  if (channel.label == 'protocol1') {
    dataChannel = channel

    dataChannel.onopen = () => {

    }
    dataChannel.onmessage = ({data}) => {

    }
    dataChannel.onerror = ({error}) => {
      // this will happen if other side e.g. refresh the tab
    }
    dataChannel.onclose = () => {
      resetConnection() // (since there is no reliable events to monitor when a peerConnection is closed we use a data channel to know when)
    }
  }
}

function debugConnectionStats() {
  peerConnection.getStats().then(reports => {
    for (const [id, report] of reports) {
      if (report.type == 'candidate-pair' && report.nominated) {
        const localCandidate = reports.get(report.localCandidateId)
        const remoteCandidate = reports.get(report.remoteCandidateId)
        const [local, remote] = [localCandidate.candidateType, remoteCandidate.candidateType]
        if (localCandidate.candidateType == 'relay' || remoteCandidate.candidateType == 'relay') {
          debug(`Relayed connection successful! (${local}, ${remote})`)
        } else {
          debug(`Direct connection successful! (${local}, ${remote})`)
        }
      }
    }
  })
}
