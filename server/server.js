const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 許可するオリジン（本番URLと開発環境）
const allowedOrigins = [
  'http://localhost:3000',                    // 開発環境
  process.env.FRONTEND_URL || ''              // 本番環境のURL
].filter(Boolean);

// シンプルかつセキュアなCORS設定
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  }
}));

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins
  }
});

// 接続ユーザー数とキャンバスデータを保存
let connectedUsers = 0;
let canvasData = []; // 描画データの履歴を保存

// ルーム情報をメモリで管理
// rooms = { roomId: { name, owner, members, isPrivate, isPersonal, invited } }
let rooms = {};

io.on('connection', (socket) => {
    connectedUsers++;
    console.log(`ユーザーが接続しました。現在の接続数: ${connectedUsers}`);
    
    // 新しいユーザーに現在の接続数を送信
    io.emit('userCount', connectedUsers);
    
    // 新しいユーザーに既存のキャンバスデータを送信
    socket.emit('canvasHistory', canvasData);
    
    // 描画データを受信して他のユーザーに送信
    socket.on('drawing', (data) => {
        // 描画データを保存（履歴を制限して メモリ不足を防ぐ）
        canvasData.push(data);
        if (canvasData.length > 10000) {
            canvasData = canvasData.slice(-5000); // 後半5000個を保持
        }
        
        // 他のユーザーに送信（送信者以外）
        socket.broadcast.emit('drawing', data);
    });
    
    // キャンバスクリアを受信
    socket.on('clearCanvas', () => {
        canvasData = []; // 履歴をクリア
        io.emit('clearCanvas'); // 全ユーザーに送信
        console.log('キャンバスがクリアされました');
    });
    
    // ルーム作成
    socket.on('createRoom', ({ roomId, name, isPrivate = false, isPersonal = false }, callback) => {
        if (rooms[roomId]) {
            callback && callback({ success: false, message: 'ルームIDが既に存在します' });
            return;
        }
        rooms[roomId] = {
            name,
            owner: socket.id,
            members: [socket.id],
            isPrivate,
            isPersonal,
            invited: [] // 招待されたユーザーID
        };
        socket.join(roomId);
        callback && callback({ success: true, room: rooms[roomId] });
        io.emit('roomList', rooms); // 全員にルームリストを送信
    });

    // ルームへの招待
    socket.on('inviteToRoom', ({ roomId, userId }, callback) => {
        if (!rooms[roomId]) {
            callback && callback({ success: false, message: 'ルームが存在しません' });
            return;
        }
        if (!rooms[roomId].invited.includes(userId)) {
            rooms[roomId].invited.push(userId);
        }
        io.to(userId).emit('invitedToRoom', { roomId, room: rooms[roomId] });
        callback && callback({ success: true });
    });

    // ルームに参加
    socket.on('joinRoom', ({ roomId }, callback) => {
        const room = rooms[roomId];
        if (!room) {
            callback && callback({ success: false, message: 'ルームが存在しません' });
            return;
        }
        // 非公開ルームは招待されたユーザーのみ参加可
        if (room.isPrivate && !room.invited.includes(socket.id) && room.owner !== socket.id) {
            callback && callback({ success: false, message: '招待されていません' });
            return;
        }
        if (!room.members.includes(socket.id)) {
            room.members.push(socket.id);
        }
        socket.join(roomId);
        callback && callback({ success: true, room });
        io.to(roomId).emit('roomMembers', room.members);
    });

    // ルームから退出
    socket.on('leaveRoom', ({ roomId }, callback) => {
        const room = rooms[roomId];
        if (!room) return;
        room.members = room.members.filter(id => id !== socket.id);
        socket.leave(roomId);
        io.to(roomId).emit('roomMembers', room.members);
        callback && callback({ success: true });
    });

    // ルーム削除（オーナーのみ）
    socket.on('deleteRoom', ({ roomId }, callback) => {
        const room = rooms[roomId];
        if (!room) {
            callback && callback({ success: false, message: 'ルームが存在しません' });
            return;
        }
        if (room.owner !== socket.id) {
            callback && callback({ success: false, message: 'オーナーのみ削除可能' });
            return;
        }
        // ルーム内の全員を退出させる
        room.members.forEach(id => io.sockets.sockets.get(id)?.leave(roomId));
        delete rooms[roomId];
        io.emit('roomList', rooms);
        callback && callback({ success: true });
    });

    // ルームリスト要求
    socket.on('getRoomList', (callback) => {
        callback && callback(rooms);
    });

    // ユーザーが切断したとき
    socket.on('disconnect', () => {
        connectedUsers--;
        console.log(`ユーザーが切断しました。現在の接続数: ${connectedUsers}`);
        io.emit('userCount', connectedUsers);
    });
});

const PORT = process.env.PORT || 3001; // Next.jsと被らないように3001を使用
server.listen(PORT, () => {
    console.log(`🚀 サーバーがポート ${PORT} で起動しました`);
    console.log(`📡 Socket.IOサーバーが動作中`);
    console.log(`🎨 Next.jsアプリは http://localhost:3000 でアクセス`);
});