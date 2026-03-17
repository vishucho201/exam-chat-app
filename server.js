require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // यह किसी भी ऐप को जुड़ने की इजाज़त देता है
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const HISTORY_FILE = path.join(__dirname, 'chat_history.json');

// कौन ऑनलाइन है यह ट्रैक करने के लिए
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

    // Online Status Tracker
    socket.on('user_joined', (role) => {
        socketRoleMap[socket.id] = role;
        activeUsers[role] = true;
        io.emit('status_update', activeUsers); // सबको बताएं कौन ऑनलाइन है
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

    // Typing Indicators
    socket.on('typing', (role) => socket.broadcast.emit('typing', role));
    socket.on('stop_typing', (role) => socket.broadcast.emit('stop_typing', role));

    // Admin Controls & Cheating Alerts
    socket.on('admin_command', (data) => socket.broadcast.emit('admin_command', data));
    socket.on('cheating_alert', (msg) => socket.broadcast.emit('cheating_alert', msg));

    socket.on('message_status', (data) => socket.broadcast.emit('message_status', data));
    socket.on('signal', (data) => socket.broadcast.emit('signal', data));

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
            io.emit('status_update', activeUsers); // सबको बताएं वो ऑफलाइन हो गया
            delete socketRoleMap[socket.id];
        }
        console.log('यूज़र डिसकनेक्ट हो गया:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`सर्वर चालू हो गया है: http://localhost:${PORT}`);
});