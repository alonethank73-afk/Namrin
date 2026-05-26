const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
 
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
 
// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));
 
// ─── Endpoint: ESP32-CAM uploads image here ───────────────────────────────────
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image received' });
  }
 
  const base64Image = req.file.buffer.toString('base64');
  const mimeType = req.file.mimetype || 'image/jpeg';
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
 
  console.log(`[${new Date().toLocaleTimeString()}] New image from Arduino (${(req.file.size / 1024).toFixed(1)} KB)`);
 
  // Broadcast to ALL connected browser clients
  let sent = 0;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'arduino_image', data: dataUrl }));
      sent++;
    }
  });
 
  console.log(`  → Broadcasted to ${sent} client(s)`);
  res.json({ success: true, clients: sent });
});
 
// ─── WebSocket: track connected clients ───────────────────────────────────────
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client connected: ${ip} (total: ${wss.clients.size})`);
 
  ws.send(JSON.stringify({ type: 'connected', message: 'Server ready' }));
 
  ws.on('close', () => {
    console.log(`[WS] Client disconnected (remaining: ${wss.clients.size})`);
  });
});
 
// ─── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════╗');
  console.log(`║  OCR Scanner Server                    ║`);
  console.log(`║  http://localhost:${PORT}                  ║`);
  console.log(`║  POST /upload  ← ESP32-CAM endpoint    ║`);
  console.log('╚════════════════════════════════════════╝');
});