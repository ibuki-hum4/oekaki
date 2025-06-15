import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Toolbar,
  AppBar,
  Container,
  Button,
  Slider,
  Chip,
  Drawer,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Palette,
  Brush,
  Delete,
  Clear,
  People,
  Menu,
  Save,
  TouchApp
} from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import io from 'socket.io-client';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Socket.IOサーバーURLを環境変数から取得
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export default function DrawingApp() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(5);
  const [userCount, setUserCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);

  // ルーム管理用state
  const [rooms, setRooms] = useState({});
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState('public'); // public/private/personal
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [inviteUserId, setInviteUserId] = useState('');
  const [mySocketId, setMySocketId] = useState('');
  const [roomMembers, setRoomMembers] = useState([]);

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#000080', '#008000'
  ];

  useEffect(() => {
    // Socket.io接続 - 環境変数から取得（開発時はデフォルトでlocalhost）
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
    socketRef.current = io(serverUrl);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // キャンバス設定
    canvas.width = 800;
    canvas.height = 600;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Socket.ioイベント
    socketRef.current.on('drawing', (data) => {
      drawLine(ctx, data, false);
    });

    socketRef.current.on('clearCanvas', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    socketRef.current.on('userCount', (count) => {
      setUserCount(count);
    });

    socketRef.current.on('canvasHistory', (history) => {
      history.forEach(data => {
        drawLine(ctx, data, false);
      });
    });

    socketRef.current.on('connect', () => {
      setAlertMessage('サーバーに接続しました！');
      setShowAlert(true);
    });

    socketRef.current.on('disconnect', () => {
      setAlertMessage('サーバーから切断されました');
      setShowAlert(true);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  const drawLine = (ctx, data, isLocal = true) => {
    const prevComposite = ctx.globalCompositeOperation;
    const prevColor = ctx.strokeStyle;
    const prevSize = ctx.lineWidth;

    ctx.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;

    if (data.type === 'start') {
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
    } else {
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
    }

    if (isLocal) {
      ctx.globalCompositeOperation = prevComposite;
      ctx.strokeStyle = prevColor;
      ctx.lineWidth = prevSize;
    }
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const coords = getCoordinates(e);
    setLastX(coords.x);
    setLastY(coords.y);

    const ctx = canvasRef.current.getContext('2d');
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    
    const data = {
      x: coords.x,
      y: coords.y,
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      type: 'start'
    };

    drawLine(ctx, data);
    socketRef.current.emit('drawing', data);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const coords = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    
    const data = {
      x: coords.x,
      y: coords.y,
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      type: 'draw'
    };

    drawLine(ctx, data);
    socketRef.current.emit('drawing', data);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    socketRef.current.emit('clearCanvas');
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `drawing-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    setAlertMessage('画像を保存しました！');
    setShowAlert(true);
  };

  // ルーム管理Socketイベント
  useEffect(() => {
    if (!socketRef.current) return;
    // サーバーからルームリスト取得
    socketRef.current.emit('getRoomList', (rooms) => setRooms(rooms));
    // ルームリスト更新
    socketRef.current.on('roomList', (rooms) => setRooms(rooms));
    // 自分のSocketID取得
    socketRef.current.on('connect', () => setMySocketId(socketRef.current.id));
    // ルームメンバー更新
    socketRef.current.on('roomMembers', (members) => setRoomMembers(members));
    // 招待通知
    socketRef.current.on('invitedToRoom', ({ roomId, room }) => {
      setAlertMessage(`ルーム「${room.name}」に招待されました`);
      setShowAlert(true);
    });
    return () => {
      socketRef.current.off('roomList');
      socketRef.current.off('roomMembers');
      socketRef.current.off('invitedToRoom');
    };
  }, []);

  // ルーム作成
  const handleCreateRoom = () => {
    if (!roomName) return;
    const roomId = `${roomType}-${Date.now()}`;
    socketRef.current.emit('createRoom', {
      roomId,
      name: roomName,
      isPrivate: roomType === 'private',
      isPersonal: roomType === 'personal'
    }, (res) => {
      if (res.success) {
        setCurrentRoomId(roomId);
        setRoomName('');
        setRoomType('public');
      } else {
        setAlertMessage(res.message);
        setShowAlert(true);
      }
    });
  };

  // ルーム参加
  const handleJoinRoom = (roomId) => {
    socketRef.current.emit('joinRoom', { roomId }, (res) => {
      if (res.success) {
        setCurrentRoomId(roomId);
        setRoomMembers(res.room.members);
      } else {
        setAlertMessage(res.message);
        setShowAlert(true);
      }
    });
  };

  // ルーム退出
  const handleLeaveRoom = () => {
    if (!currentRoomId) return;
    socketRef.current.emit('leaveRoom', { roomId: currentRoomId }, () => {
      setCurrentRoomId(null);
      setRoomMembers([]);
    });
  };

  // ルーム削除
  const handleDeleteRoom = (roomId) => {
    socketRef.current.emit('deleteRoom', { roomId }, (res) => {
      setAlertMessage(res.success ? 'ルームを削除しました' : res.message);
      setShowAlert(true);
      if (currentRoomId === roomId) {
        setCurrentRoomId(null);
        setRoomMembers([]);
      }
    });
  };

  // ルーム招待
  const handleInvite = () => {
    if (!currentRoomId || !inviteUserId) return;
    socketRef.current.emit('inviteToRoom', { roomId: currentRoomId, userId: inviteUserId }, (res) => {
      setAlertMessage(res.success ? '招待しました' : res.message);
      setShowAlert(true);
      setInviteUserId('');
    });
  };

  // ルーム管理パネル
  const RoomPanel = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>ルーム管理</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <input
          type="text"
          placeholder="ルーム名"
          value={roomName}
          onChange={e => setRoomName(e.target.value)}
          style={{ flex: 1, padding: 4, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <Select
          value={roomType}
          onChange={e => setRoomType(e.target.value)}
          size="small"
        >
          <MenuItem value="public">公開</MenuItem>
          <MenuItem value="private">非公開</MenuItem>
          <MenuItem value="personal">個人用</MenuItem>
        </Select>
        <Button variant="contained" onClick={handleCreateRoom}>作成</Button>
      </Box>
      <Typography variant="subtitle2" sx={{ mt: 2 }}>ルーム一覧</Typography>
      <Box sx={{ maxHeight: 200, overflowY: 'auto', mb: 2 }}>
        {Object.entries(rooms).length === 0 && <Typography color="text.secondary">ルームなし</Typography>}
        {Object.entries(rooms).map(([id, room]) => (
          <Paper key={id} sx={{ p: 1, mb: 1, bgcolor: currentRoomId === id ? '#e3f2fd' : '#fafafa' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ flex: 1 }}>
                {room.name} <Chip size="small" label={room.isPersonal ? '個人用' : room.isPrivate ? '非公開' : '公開'} color={room.isPersonal ? 'default' : room.isPrivate ? 'warning' : 'primary'} />
              </Typography>
              {currentRoomId === id ? (
                <Button size="small" onClick={handleLeaveRoom}>退出</Button>
              ) : (
                <Button size="small" onClick={() => handleJoinRoom(id)}>参加</Button>
              )}
              {room.owner === mySocketId && (
                <Button size="small" color="error" onClick={() => handleDeleteRoom(id)}>削除</Button>
              )}
            </Box>
            {currentRoomId === id && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption">メンバー: {roomMembers.length > 0 ? roomMembers.join(', ') : 'なし'}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <input
                    type="text"
                    placeholder="ユーザーIDで招待"
                    value={inviteUserId}
                    onChange={e => setInviteUserId(e.target.value)}
                    style={{ flex: 1, padding: 2, borderRadius: 4, border: '1px solid #ccc' }}
                  />
                  <Button size="small" onClick={handleInvite}>招待</Button>
                </Box>
              </Box>
            )}
          </Paper>
        ))}
      </Box>
    </Box>
  );

  const ToolPanel = () => (
    <Box sx={{ width: 280, p: 2 }}>
      <Typography variant="h6" gutterBottom>
        🎨 ツールパネル
      </Typography>
      
      {/* カラーパレット */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          <Palette sx={{ mr: 1, verticalAlign: 'middle' }} />
          カラーパレット
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {colors.map((color) => (
            <Box
              key={color}
              onClick={() => setCurrentColor(color)}
              sx={{
                width: 32,
                height: 32,
                backgroundColor: color,
                border: currentColor === color ? '3px solid #1976d2' : '1px solid #ccc',
                borderRadius: '50%',
                cursor: 'pointer',
                '&:hover': { transform: 'scale(1.1)' }
              }}
            />
          ))}
        </Box>
        <Box sx={{ mt: 1 }}>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            style={{ width: '100%', height: '40px', border: 'none', borderRadius: '8px' }}
          />
        </Box>
      </Box>

      {/* ブラシサイズ */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          <Brush sx={{ mr: 1, verticalAlign: 'middle' }} />
          ブラシサイズ: {currentSize}px
        </Typography>
        <Slider
          value={currentSize}
          onChange={(e, value) => setCurrentSize(value)}
          min={1}
          max={50}
          valueLabelDisplay="auto"
        />
      </Box>

      {/* ツール選択 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          ツール選択
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={currentTool === 'pen' ? 'contained' : 'outlined'}
            onClick={() => setCurrentTool('pen')}
            startIcon={<Brush />}
          >
            ペン
          </Button>
          <Button
            variant={currentTool === 'eraser' ? 'contained' : 'outlined'}
            onClick={() => setCurrentTool('eraser')}
            startIcon={<TouchApp />}
          >
            消しゴム
          </Button>
        </Box>
      </Box>

      {/* アクション */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="outlined"
          color="success"
          onClick={saveCanvas}
          startIcon={<Save />}
        >
          画像を保存
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={clearCanvas}
          startIcon={<Clear />}
        >
          全消去
        </Button>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 2 }}
            >
              <Menu />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              🎨 リアルタイム共同お絵描きアプリ
            </Typography>
            <Chip
              icon={<People />}
              label={`${userCount}人参加中`}
              color="secondary"
              variant="outlined"
              sx={{ color: 'white', borderColor: 'white' }}
            />
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 2 }}>
          <Paper elevation={3} sx={{ mx: 'auto', display: 'inline-block', p: 2 }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                cursor: currentTool === 'pen' ? 'crosshair' : 'grab',
                touchAction: 'none'
              }}
            />
          </Paper>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            💡 複数人で同時にお絵描きできます！友達にURLを共有してください。
            左上のメニューボタンからツールパネルを開けます。
          </Alert>
        </Container>

        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <ToolPanel />
          <RoomPanel />
        </Drawer>

        <Snackbar
          open={showAlert}
          autoHideDuration={3000}
          onClose={() => setShowAlert(false)}
          message={alertMessage}
        />
      </Box>
    </ThemeProvider>
  );
}