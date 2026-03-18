require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3000;
const HISTORY_FILE = path.join(__dirname, 'chat_history.json');

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // 1. Text & Voice Messages
    socket.on('send_message', (data) => {
        io.emit('receive_message', data);
        // Save to History
        try {
            let history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || "[]") : [];
            history.push(data);
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
        } catch (e) { console.error("History Error:", e.message); }
    });

    socket.on('fetch_history', () => {
        try {
            if (fs.existsSync(HISTORY_FILE)) {
                socket.emit('load_history', JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')));
            }
        } catch (e) { console.error(e.message); }
    });

    // 2. Video Call Signals (WebRTC)
    socket.on('call_user', (data) => socket.broadcast.emit('call_user', data));
    socket.on('answer_call', (data) => socket.broadcast.emit('answer_call', data));
    socket.on('ice_candidate', (data) => socket.broadcast.emit('ice_candidate', data));
    socket.on('end_call', () => socket.broadcast.emit('end_call'));

    // 3. Typing Status
    socket.on('typing', (role) => socket.broadcast.emit('typing', role));
    socket.on('stop_typing', (role) => socket.broadcast.emit('stop_typing', role));
});

server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));