var myRole = ''; 
const socket = io("https://exam-chat-app.onrender.com");
let peerConnection;
let localStream;
let currentFacingMode = 'user'; 
let typingTimer;
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const FIXED_ID = "yaru201yaru";
const FIXED_PASS = "1404243024vm";

function togglePassword() {
    const passInput = document.getElementById('roomPass');
    const eyeIcon = document.getElementById('eye-icon');
    if (passInput.type === "password") {
        passInput.type = "text";
        eyeIcon.innerText = "🙈"; 
    } else {
        passInput.type = "password";
        eyeIcon.innerText = "👁️"; 
    }
}

// --- सुधरा हुआ लॉगिन फंक्शन ---
function login() {
    console.log("Login sequence started...");
    
    try {
        const idInput = document.getElementById('roomId');
        const passInput = document.getElementById('roomPass');
        const roleInput = document.getElementById('role');
        const loginScreen = document.getElementById('login-screen');
        const mainScreen = document.getElementById('main-screen');

        if (!idInput || !passInput || !mainScreen) {
            alert("Error: HTML Elements (roomId/main-screen) missing!");
            return;
        }

        const enteredId = idInput.value.trim();
        const enteredPass = passInput.value.trim();
        myRole = roleInput.value;

        if (enteredId === FIXED_ID && enteredPass === FIXED_PASS) {
            // लॉगिन सफल
            alert("✅ ID/Pass Correct! Room में प्रवेश कर रहे हैं...");

            // स्क्रीन बदलें
            loginScreen.style.display = 'none';
            mainScreen.style.display = 'block';

            // रोल के हिसाब से UI दिखाएँ
            if (myRole === 'user') {
                const modal = document.getElementById('screen-share-modal');
                if(modal) modal.style.display = 'flex';
            } else {
                const wrapper = document.getElementById('video-wrapper');
                if(wrapper) wrapper.style.display = 'flex';
            }

            // सर्वर को सूचित करें
            socket.emit('user_joined', myRole);
            socket.emit('fetch_history');
            
        } else {
            alert("❌ गलत ID या Password!");
        }
    } catch (err) {
        alert("Login Error: " + err.message);
    }
}

// --- बाकी सारे ओरिजिनल फीचर्स ---

document.addEventListener('visibilitychange', () => {
    if(document.hidden && myRole === 'user') {
        socket.emit('cheating_alert', "🚨 WARNING: User ने एग्जाम स्क्रीन (Tab) से बाहर जाने की कोशिश की है!");
    }
});

socket.on('cheating_alert', (msg) => {
    displayMessage({ id: Date.now().toString(), sender: 'system', message: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, false);
});

socket.on('status_update', (users) => {
    const statusInd = document.getElementById('status-indicator');
    if(!statusInd) return;
    const otherRole = myRole === 'admin' ? 'user' : 'admin';
    if (users[otherRole]) {
        statusInd.innerText = "🟢 Online";
        statusInd.style.color = "#dcf8c6";
    } else {
        statusInd.innerText = "🔴 Offline";
        statusInd.style.color = "#ffbaba";
    }
});

function handleTyping() {
    socket.emit('typing', myRole);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.emit('stop_typing', myRole), 2000);
}

socket.on('typing', (role) => {
    if(role !== myRole) {
        const el = document.getElementById('typing-indicator');
        if(el) el.style.display = 'block';
    }
});
socket.on('stop_typing', (role) => {
    if(role !== myRole) {
        const el = document.getElementById('typing-indicator');
        if(el) el.style.display = 'none';
    }
});

function sendMessage() {
    const msgInput = document.getElementById('messageInput');
    const msg = msgInput.value.trim();
    if (!msg) return;

    const msgId = Date.now().toString();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const data = { id: msgId, sender: myRole, message: msg, time: timeNow };
    
    displayMessage(data, true); 
    socket.emit('send_message', data);
    msgInput.value = '';
    socket.emit('stop_typing', myRole);
}

socket.on('receive_message', (data) => {
    if (data.sender !== myRole) {
        displayMessage(data, false); 
        socket.emit('message_status', { id: data.id, status: 'read' });
    }
});

socket.on('message_status', (data) => {
    const tickElement = document.getElementById(`tick-${data.id}`);
    if (tickElement && data.status === 'read') {
        tickElement.innerText = '✓✓'; 
        tickElement.classList.add('blue'); 
    }
});

function displayMessage(data, isSentByMe) {
    const chatBox = document.getElementById('chat-box');
    if(!chatBox) return;
    const div = document.createElement('div');
    
    if(data.sender === 'system') {
        div.className = 'msg system';
    } else {
        div.className = isSentByMe ? 'msg sent' : 'msg received';
    }
    
    let tickHTML = isSentByMe && data.sender !== 'system' ? `<span id="tick-${data.id}" class="tick blue">✓✓</span>` : '';

    div.innerHTML = `
        <div>${data.message}</div>
        <div class="msg-info"><span>${data.time || ''}</span>${tickHTML}</div>
    `;
    
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; 
}

socket.on('load_history', (history) => {
    const chatBox = document.getElementById('chat-box');
    if(chatBox) {
        chatBox.innerHTML = ''; 
        history.forEach(data => displayMessage(data, data.sender === myRole));
    }
});

async function startMonitoring() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode }, audio: true });
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

        document.getElementById('screen-share-modal').style.display = 'none';
        document.getElementById('share-indicator').style.display = 'block';

        peerConnection = new RTCPeerConnection(servers);

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        screenStream.getTracks().forEach(track => peerConnection.addTrack(track, screenStream));
        
        screenStream.getVideoTracks()[0].onended = () => {
            alert("⚠️ आपने स्क्रीन शेयरिंग बंद कर दी है!");
            socket.emit('cheating_alert', "🚨 WARNING: User ने Screen Casting बंद कर दी है!");
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) socket.emit('signal', { type: 'candidate', candidate: event.candidate });
        };
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { type: 'offer', offer: offer });
    } catch (err) {
        alert("⚠️ कैमरा/स्क्रीन शेयरिंग परमिशन ज़रूरी है!");
        console.error(err);
    }
}

function sendAdminCommand(action) {
    socket.emit('admin_command', { action: action });
}

socket.on('admin_command', async (data) => {
    if(myRole === 'user' && localStream) {
        if(data.action === 'toggle_mic') {
            const audioTrack = localStream.getAudioTracks()[0];
            if(audioTrack) audioTrack.enabled = !audioTrack.enabled;
        } 
        else if(data.action === 'switch_cam') {
            currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            const videoTrack = localStream.getVideoTracks()[0];
            videoTrack.stop();
            const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } });
            const newVideoTrack = newStream.getVideoTracks()[0];
            localStream.removeTrack(videoTrack);
            localStream.addTrack(newVideoTrack);
            const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
            if(sender) sender.replaceTrack(newVideoTrack);
        }
    }
});

socket.on('signal', async (data) => {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(servers);
        peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo');
            if(remoteVideo) remoteVideo.srcObject = event.streams[0];
        };
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) socket.emit('signal', { type: 'candidate', candidate: event.candidate });
        };
    }
    if (data.type === 'offer' && myRole === 'admin') {
        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { type: 'answer', answer: answer });
    } else if (data.type === 'answer' && myRole === 'user') {
        await peerConnection.setRemoteDescription(data.answer);
    } else if (data.type === 'candidate') {
        await peerConnection.addIceCandidate(data.candidate);
    }
});

function leaveChat() {
    if(confirm("क्या आप सच में रूम से बाहर जाना चाहते हैं?")) window.location.reload(); 
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('theme-btn');
    if(btn) btn.innerText = document.body.classList.contains('dark-mode') ? "☀️ Light" : "🌙 Dark";
}

// --- Drag & Drop ---
const dragItem = document.getElementById("video-wrapper");
const dragHandle = document.getElementById("drag-handle");
let active = false;
let currentX, currentY, initialX, initialY;
let xOffset = 0, yOffset = 0;

if(dragHandle) {
    dragHandle.addEventListener("mousedown", dragStart, false);
    document.addEventListener("mouseup", dragEnd, false);
    document.addEventListener("mousemove", drag, false);
    dragHandle.addEventListener("touchstart", dragStart, {passive: false});
    document.addEventListener("touchend", dragEnd, false);
    document.addEventListener("touchmove", drag, {passive: false});
}

function getEventLocation(e) {
    return e.touches && e.touches.length > 0 ? e.touches[0] : e;
}

function dragStart(e) {
    const loc = getEventLocation(e);
    initialX = loc.clientX - xOffset;
    initialY = loc.clientY - yOffset;
    if (e.target === dragHandle) active = true;
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    active = false;
}

function drag(e) {
    if (active) {
        e.preventDefault();
        const loc = getEventLocation(e);
        currentX = loc.clientX - initialX;
        currentY = loc.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        if(dragItem) dragItem.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
}