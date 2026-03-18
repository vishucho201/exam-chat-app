const socket = io("https://exam-chat-app.onrender.com"); // अपना रेंडर लिंक चेक कर लें
let myRole = '';

// --- 1. NEW LOGIN SYSTEM ---
function login() {
    const id = document.getElementById('userId').value.trim();
    const pass = document.getElementById('userPass').value.trim();

    if (id === "aaaa1111" && pass === "aaaa1111") {
        myRole = 'admin';
        document.getElementById('chat-title').innerText = "Chatting with User";
    } else if (id === "uuuu1111" && pass === "uuuu1111") {
        myRole = 'user';
        document.getElementById('chat-title').innerText = "Chatting with Admin";
    } else {
        alert("❌ Invalid ID or Password");
        return;
    }

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    socket.emit('fetch_history');
}

// --- 2. TEXT CHAT SYSTEM ---
function sendTextMessage() {
    const input = document.getElementById('messageInput');
    if (!input.value.trim()) return;

    const data = { type: 'text', sender: myRole, content: input.value, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    socket.emit('send_message', data);
    input.value = '';
}

socket.on('receive_message', (data) => displayMessage(data));
socket.on('load_history', (history) => history.forEach(data => displayMessage(data)));

function displayMessage(data) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = `msg ${data.sender === myRole ? 'sent' : 'received'}`;
    
    if (data.type === 'text') {
        div.innerHTML = `${data.content} <br><small style="font-size: 10px; color: gray;">${data.time}</small>`;
    } else if (data.type === 'audio') {
        div.innerHTML = `<audio controls src="${data.content}" style="width: 200px; height: 30px;"></audio> <br><small style="font-size: 10px; color: gray;">${data.time}</small>`;
    }
    
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleTyping() {
    // Typing indicator logic can be added here
}

// --- 3. VOICE MESSAGE (MIC) SYSTEM ---
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

async function toggleMic() {
    const micBtn = document.getElementById('micBtn');
    
    if (!isRecording) {
        // Start Recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const data = { type: 'audio', sender: myRole, content: reader.result, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                    socket.emit('send_message', data);
                };
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('mic-recording'); // Red color animation
        } catch (err) { alert("Mic Permission Denied!"); }
    } else {
        // Stop Recording and Send
        mediaRecorder.stop();
        isRecording = false;
        micBtn.classList.remove('mic-recording');
    }
}

// --- 4. VIDEO CALL (WebRTC MVP) ---
let localStream;
let peerConnection;
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function startVideoCall() {
    document.getElementById('video-container').style.display = 'block';
    document.getElementById('endCallBtn').style.display = 'inline-block';
    
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;

    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) socket.emit('ice_candidate', event.candidate);
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call_user', offer);
}

// Incoming Call (Answer)
socket.on('call_user', async (offer) => {
    if (confirm("Incoming Video Call! Answer?")) {
        document.getElementById('video-container').style.display = 'block';
        document.getElementById('endCallBtn').style.display = 'inline-block';

        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;

        peerConnection = new RTCPeerConnection(servers);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            document.getElementById('remoteVideo').srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) socket.emit('ice_candidate', event.candidate);
        };

        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer_call', answer);
    }
});

socket.on('answer_call', async (answer) => {
    await peerConnection.setRemoteDescription(answer);
});

socket.on('ice_candidate', async (candidate) => {
    if (peerConnection) await peerConnection.addIceCandidate(candidate);
});

function endVideoCall() {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    document.getElementById('video-container').style.display = 'none';
    document.getElementById('endCallBtn').style.display = 'none';
    socket.emit('end_call');
}

socket.on('end_call', () => {
    if (peerConnection) peerConnection.close();
    document.getElementById('video-container').style.display = 'none';
    document.getElementById('endCallBtn').style.display = 'none';
});