let socket;
let localStream;
let remoteStream;
let peerConnection;
let roomId;
let isCaller = false;

const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

// UI Elements
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const roomInput = document.getElementById('room-input');
const statusText = document.getElementById('status-text');
const currentRoomIdDisplay = document.getElementById('current-room-id');

async function startCall(isNewRoom) {
    roomId = roomInput.value.trim();
    if (!roomId) {
        roomId = isNewRoom ? Math.random().toString(36).substring(7) : prompt('Enter Room ID:');
    }

    if (!roomId) return;

    // Initialize Socket
    const backendUrl = window.ENV_CONFIG ? window.ENV_CONFIG.backendApiUrl : 'http://localhost:5001';
    socket = io(backendUrl);

    // Setup Local Media
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        // Hide overlay, show UI
        document.getElementById('join-overlay').classList.add('hidden');
        document.getElementById('main-call-ui').classList.remove('hidden');
        currentRoomIdDisplay.innerText = roomId;
        statusText.innerText = 'Waiting for peer...';

        socket.emit('join-room', roomId);
    } catch (err) {
        console.error('Error accessing media:', err);
        alert('Could not access camera or microphone. Please check permissions.');
        return;
    }

    setupSocketListeners();
}

function setupSocketListeners() {
    socket.on('user-connected', (userId) => {
        console.log('Peer connected:', userId);
        statusText.innerText = 'Connecting to peer...';
        initiateCall();
    });

    socket.on('offer', async (data) => {
        if (!peerConnection) createPeerConnection();
        console.log('Received offer from peer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer, roomId });
    });

    socket.on('answer', async (data) => {
        console.log('Received answer from peer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        statusText.innerText = 'Connected';
    });

    socket.on('ice-candidate', async (data) => {
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error('Error adding ice candidate:', e);
            }
        }
    });
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(iceServers);

    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
        console.log('Received remote track');
        if (!remoteStream) {
            remoteStream = new MediaStream();
            remoteVideo.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
        statusText.innerText = 'Connected';
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, roomId });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            statusText.innerText = 'Connected';
        } else if (peerConnection.connectionState === 'disconnected') {
            statusText.innerText = 'Peer Left';
        }
    };
}

async function initiateCall() {
    isCaller = true;
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { offer, roomId });
}

// Controls
function toggleAudio() {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    document.getElementById('toggle-mic').classList.toggle('active');
    document.getElementById('toggle-mic').innerHTML = audioTrack.enabled ? 
        '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
}

function toggleVideo() {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    document.getElementById('toggle-video').classList.toggle('active');
    document.getElementById('toggle-video').innerHTML = videoTrack.enabled ? 
        '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
}

function endCall() {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    window.location.href = 'index.html';
}

function copyRoomId() {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied to clipboard: ' + roomId);
}
