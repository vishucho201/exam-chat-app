var myRole = ''; 
var socket = io("https://exam-chat-app.onrender.com");
let currentFacingMode = 'user'; 
let typingTimer;

// 🟢 LiveKit Room Variable
let livekitRoom; 

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

// --- Bulletproof Login Function ---
function login() {
    console.log("Login sequence started...");
    
    try {
        const idInput = document.getElementById('roomId');
        const passInput = document.getElementById('roomPass');
        const roleInput = document.getElementById('role');
        const loginScreen = document.getElementById('login-screen');
        const mainScreen = document.getElementById('main-screen');

        if (!idInput || !passInput || !mainScreen) {
            alert("Error: HTML Elements missing!");
            return;
        }

        const enteredId = idInput.value.trim();
        const enteredPass = passInput.value.trim();
        myRole = roleInput.value;

        if (enteredId === "yaru201yaru" && enteredPass === "1404243024vm") {
            alert("✅ ID/Pass Correct! Room में प्रवेश कर रहे हैं...");

            loginScreen.style.display = 'none';
            mainScreen.style.display = 'block';

            if (myRole === 'user') {
                const modal = document.getElementById('screen-share-modal');
                if(modal) modal.style.display = 'flex';
            } else {
                const wrapper = document.getElementById('video-wrapper');
                if(wrapper) wrapper.style.display = 'flex';
            }

            socket.emit('user_joined', myRole);
            socket.emit('fetch_history');
            
        } else {
            alert("❌ गलत ID या Password!");
        }
    } catch (err) {
        alert("Login Error: " + err.message);
    }
}

// --- चैट और चीटिंग फीचर्स ---
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

// 🟢 LIVEKIT CAMERA & SCREEN SHARE LOGIC
async function startMonitoring() {
    // 1. सर्वर से LiveKit का पास (Token) मांगें
    socket.emit('get_livekit_token', myRole);
}

socket.on('livekit_token', async (data) => {
    try {
        const modal = document.getElementById('screen-share-modal');
        if (modal) modal.style.display = 'none';

        // 2. नया LiveKit Room बनाएँ
        livekitRoom = new LivekitClient.Room({
            adaptiveStream: true,
            dynacast: true,
        });

        // 3. जब वीडियो/ऑडियो सर्वर से आये (एडमिन के लिए)
        livekitRoom.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
            if (track.kind === 'video') {
                const element = track.attach();
                element.style.width = "100%";
                element.style.height = "100%";
                element.style.objectFit = "cover";
                
                const remoteVideoContainer = document.getElementById('remoteVideo').parentElement;
                document.getElementById('remoteVideo').style.display = 'none'; 
                remoteVideoContainer.appendChild(element);
            } else if (track.kind === 'audio') {
                track.attach(); 
            }
        });

        // 4. रूम से कनेक्ट करें
        await livekitRoom.connect(data.url, data.token);
        console.log('✅ LiveKit Room Connected!');

        // 5. अगर यूज़र है, तो उसका कैमरा, माइक और स्क्रीन ऑन करें
        if (myRole === 'user') {
            await livekitRoom.localParticipant.enableCameraAndMicrophone();
            
            try {
                await livekitRoom.localParticipant.setScreenShareEnabled(true);
            } catch (screenErr) {
                console.warn("Screen share blocked:", screenErr);
                socket.emit('cheating_alert', "🚨 Alert: User की Screen Sharing ब्लॉक है, लेकिन Camera & Mic LIVE हैं!");
            }
        }
    } catch (error) {
        console.error("LiveKit connection error:", error);
        alert("⚠️ Video server से कनेक्ट नहीं हो पाया!");
    }
});

function sendAdminCommand(action) {
    socket.emit('admin_command', { action: action });
}

// 🟢 Admin Commands for LiveKit
socket.on('admin_command', async (data) => {
    if(myRole === 'user' && livekitRoom) {
        if(data.action === 'toggle_mic') {
            const isEnabled = livekitRoom.localParticipant.isMicrophoneEnabled;
            await livekitRoom.localParticipant.setMicrophoneEnabled(!isEnabled);
        } 
        else if(data.action === 'switch_cam') {
            currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            await livekitRoom.localParticipant.setCameraEnabled(false);
            await livekitRoom.localParticipant.setCameraEnabled(true, { facingMode: currentFacingMode });
        }
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