
import {RTCPerfectNegotiator} from 'rtc-perfect-negotiator'
import {PeerServerSignalingClient} from 'tiny-peerserver-client'
import {debug, pageSetup, e, tags, wrap, unwrap} from 'wrapped-elements'

pageSetup({
  title: 'Guess Experiment',
  allowDarkTheme: false, // skip the style injection for this
  stylesheets: 'style.css',
  favicon: false // set to a blank one
})

document.body.append(...unwrap(
  e.div(
    e.h1('The Guess Experiment'),
    e.p('Connect to a peer and try to guess the randomly selected card shown on their screen. This can be done using remote viewing (extra sensory perception) or telepathy with the peer who can see the card. Version: 0.1.'),
    //e.div(
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
      ).className('cleanBreak'),
      e.div(
      e.button('Ready for peer connection').tag('button_ready'),
      e.button('Try to connect').tag('button_connect').disabled(true),
      e.button('Disconnect').tag('button_disconnect').disabled(true),
    ).className('cleanBreak'),
    // ),
    e.div(
      e.div(e.img().draggable(false).src('zener/star.svg')).className('card'),
      e.div(e.img().draggable(false).src('zener/box.svg')).className('card'),
      e.div(e.img().draggable(false).src('zener/waves.svg')).className('card'),
      e.div(e.img().draggable(false).src('zener/cross.svg')).className('card'),
      e.div(e.img().draggable(false).src('zener/circle.svg')).className('card'),
    ).tagAndId('table'),
    // todo: on guess remove those not selected, then show the selected card next to the correct card (as an animation), then the text correct or wrong
    e.button('Make your guess!').tag('button_guess'),
    e.span('Total score: 10 / 10'),
    e.span('Last 10 guesses: 10 / 10')
  ).id('container')
))

const {input_myId, input_peerId, button_ready, 
  button_connect, button_disconnect, table, button_guess} = tags

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


globalThis['DEBUG_SIGNALING'] = true
const idSuffix = '-guessExp'
let myId, peerId
/** @type {PeerServerSignalingClient} */
let signalingClient
/** @type {RTCPeerConnection} */
let peerConnection
/** @type {RTCDataChannel} */
let dataChannel
const iceConfig = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ]
    }, { // from the PeerJS project: https://github.com/peers/peerjs/blob/master/lib/util.ts
      username: 'peerjs',
      credential: 'peerjsp',
      urls: [
        'turn:eu-0.turn.peerjs.com:3478',
        'turn:us-0.turn.peerjs.com:3478',
      ]
    }
  ]
}

button_connect.onclick = () => {
  button_connect.disabled = true
  dataChannel = peerConnection.createDataChannel('protocol1')
  initDataChannel()
}

button_disconnect.onclick = () => {
  button_disconnect.disabled = true
  peerConnection.close()
}

button_ready.onclick = async () => {
  chat.replaceChildren() // clear chat
  myId = input_myId.value
  peerId = input_peerId.value
  if (!myId || !peerId) {
    displayChatMessage('Please fill out "my ID" and "peer ID"!')
    return
  }
  button_ready.disabled = true
  input_myId.disabled = true
  input_peerId.disabled = true
  checkbox_turn.disabled = true
  sessionStorage.setItem('myId', myId)
  sessionStorage.setItem('peerId', peerId)
  initPeerConnection(myId, peerId, idSuffix)
}

/** Since there are no reliable events on the RTCPeerConnection to monitor when it is closed we use a data channel to trigger this when it is closed. */
function onClosed() {
  displayChatMessage('Connection closed...')
  // reset all buttons
  input_myId.disabled = false
  input_peerId.disabled = false
  button_ready.disabled = false
  checkbox_turn.disabled = false
  button_connect.disabled = true
  button_disconnect.disabled = true
  button_send.disabled = true
}

async function initPeerConnection(myId, peerId, suffix) {
  myId += suffix; peerId += suffix
  if (signalingClient) {
    if (!(signalingClient.ready && signalingClient.myId == myId)) {
      signalingClient.reconnect(myId) // if closed or reconnecting with a new ID
    }
  } else { // we only create one client (which can reconnect when needed)
    signalingClient = new PeerServerSignalingClient({myId})
    signalingClient.addEventListener('connecting', ({detail: {connectionAttempt, lastAttempt}}) => {
      displayChatMessage(`Signaling channel connecting... ${connectionAttempt}/${signalingClient.maxConnectionAttempts}`)})
    signalingClient.addEventListener('ready', () => {
      displayChatMessage(`Signaling channel ready.`)})
    signalingClient.addEventListener('closed', ({detail: {willRetry}}) => {
      displayChatMessage(`Signaling channel closed, willRetry: ${willRetry}`)})
    signalingClient.addEventListener('error', ({detail: {message, code}}) => {
      displayChatMessage(`Signaling channel error: ${code} ${message}`)})
  }
  try {
    if (!signalingClient.ready) {
      await signalingClient.createReadyPromise()
    } else {
      displayChatMessage('Signaling channel ready.')
    }
  } catch (error) {
    if (error.code == 'SIGNALING_SERVER_TIMEOUT') {
      displayChatMessage(`Signaling channel connection timeout.`)
    }
    input_myId.disabled = false
    input_peerId.disabled = false
    button_ready.disabled = false
    return
  }
  // signaling server ready
  const signalingChannel = signalingClient.getChannel(peerId)
  const negotiator = new RTCPerfectNegotiator({
    peerConfiguration: (checkbox_turn.checked ? iceConfigWithTURN : iceConfig),
    signalingChannel
  })
  displayChatMessage(`Negotiator isPolite = ${negotiator.isPolite}`)
  negotiator.addEventListener('error', ({detail: {message, code}}) => {
    debugToChat(`error: ${code} (${peerConnection.signalingState}) ${message}`)})
  peerConnection = negotiator.peerConnection
  button_connect.disabled = false // allow chat channel creation
  initPeerConnectionEvents(peerConnection)
  // debug('peerConfiguration:', peerConnection.getConfiguration())
  // (negotiation is not done before a channel or track is added)
}

/**
 * @param {RTCPeerConnection} peerConnection 
 */
function initPeerConnectionEvents(peerConnection) {
  peerConnection.onnegotiationneeded = () => {
    debugToChat('## negotiation needed ##')
  }
  peerConnection.onconnectionstatechange = () => {
    debugToChat('## connection state ##', peerConnection.connectionState)
    switch (peerConnection.connectionState) {
      case 'connected': displayConnectionStats(); break
    }
  }
  peerConnection.onsignalingstatechange = async () => {
    debug('## signaling state ##', peerConnection.signalingState)
  }
  peerConnection.oniceconnectionstatechange = async () => {
    debug('## ICE connection state ##', peerConnection.iceConnectionState)
  }
  peerConnection.ondatachannel = ({channel}) => {
    debug('new data channel:', channel.label, peerConnection.connectionState, peerConnection.signalingState)
    if (!dataChannel && channel.label == 'chat') {
      dataChannel = channel
      initChatChannel()
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
          displayChatMessage(`Relayed connection successful! (${local}, ${remote})`)
        } else {
          displayChatMessage(`Direct connection successful! (${local}, ${remote})`)
        }
      }
    }
  })
}

function initDataChannel() {
  button_connect.disabled = true
  
  dataChannel.onopen = () => {
    debug('chat channel opened')
    input_msg.focus()
    button_send.disabled = false
    button_disconnect.disabled = false
  }
  dataChannel.onmessage = ({data}) => {
    debug('message received:', data)
    if (typeof data == 'string') {
      onChatMessage(data)
    }
  }
  dataChannel.onerror = ({error}) => {
    // this will happen if other side e.g. refresh the tab
    debug('chat channel error:', error)
  }
  dataChannel.onclose = () => {
    debug('chat channel closed:', peerConnection.connectionState, peerConnection.signalingState)
    peerConnection.close() // if it isn't already
    dataChannel = false
    button_connect.disabled = false
    onClosed() // (since there is no reliable events to monitor when a peerConnection is closed we use a data channel to know when)
  }
}
