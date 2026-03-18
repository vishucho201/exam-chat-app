require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { AccessToken } = require('livekit-server-sdk'); // 👈 LiveKit SDK जोड़ा गया

// 👇 अपनी LiveKit की तीनों चीज़ें यहाँ डालें 👇
const LIVEKIT_API_KEY = "APIJNBuBVYqWDPt";
const LIVEKIT_API_SECRET = "M2romB64VbYx28qdB4eCCAfr28cWSzeOJUvrmAf61i0A";
const LIVEKIT_URL = "wss://examapp-a17ep6sh.livekit.cloud"; 

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const HISTORY_FILE = path.join(__dirname, 'chat_history.json');

const activeUsers = { admin: false, user: false };
const socketRoleMap = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/creator-secret-panel', (req, res) => {
    const pass = req.query.pass;
    if (pass === process.env.SECRET_PASS) {
        if (fs.existsSync(HISTORY_FILE)) {
            res.header("Content-Type", "application/json");
            res.sendFile(HISTORY_FILE);
        } else {
            res.send('अभी तक कोई चैट हिस्ट्री नहीं है।');
        }
    } else {
        res.status(403).send('Access Denied! गलत पासवर्ड।');
    }
});

io.on('connection', (socket) => {
    console.log('एक नया यूज़र कनेक्ट हुआ:', socket.id);

    // 🟢 LiveKit Token Generator (नया कोड)
    socket.on('get_livekit_token', (role) => {
        const roomName = 'secure-exam-room';
        const participantName = role + '_' + Math.floor(Math.random() * 10000);

        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: participantName,
        });
        
        // रूम में घुसने और वीडियो भेजने/देखने की परमिशन
        at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
        
        socket.emit('livekit_token', { token: at.toJwt(), url: LIVEKIT_URL });
    });

    socket.on('user_joined', (role) => {
        socketRoleMap[socket.id] = role;
        activeUsers[role] = true;
        io.emit('status_update', activeUsers); 
    });

    socket.on('send_message', (data) => {
        io.emit('receive_message', data);
        try {
            let history = [];
            if (fs.existsSync(HISTORY_FILE)) {
                const fileData = fs.readFileSync(HISTORY_FILE, 'utf8');
                if (fileData.trim() !== "") history = JSON.parse(fileData);
            }
            history.push(data);
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
        } catch (error) {
            console.error("⚠️ चैट सेव करते समय एरर:", error.message);
        }
    });

    socket.on('typing', (role) => socket.broadcast.emit('typing', role));
    socket.on('stop_typing', (role) => socket.broadcast.emit('stop_typing', role));
    socket.on('admin_command', (data) => socket.broadcast.emit('admin_command', data));
    socket.on('cheating_alert', (msg) => socket.broadcast.emit('cheating_alert', msg));
    socket.on('message_status', (data) => socket.broadcast.emit('message_status', data));

    socket.on('fetch_history', () => {
        try {
            if (fs.existsSync(HISTORY_FILE)) {
                const fileData = fs.readFileSync(HISTORY_FILE, 'utf8');
                if (fileData.trim() !== "") {
                    socket.emit('load_history', JSON.parse(fileData)); 
                }
            }
        } catch (error) {
            console.error("हिस्ट्री लोड करने में एरर:", error.message);
        }
    });

    socket.on('disconnect', () => {
        const role = socketRoleMap[socket.id];
        if(role) {
            activeUsers[role] = false;
            io.emit('status_update', activeUsers); 
            delete socketRoleMap[socket.id];
        }
        console.log('यूज़र डिसकनेक्ट हो गया:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`सर्वर चालू हो गया है: http://localhost:${PORT}`);
});