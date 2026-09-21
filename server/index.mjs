import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { Room } from './rooms.mjs';
export function createArenaServer({
  host = '127.0.0.1',
  port = 3002,
  origins = ['http://localhost:3001', 'http://127.0.0.1:3001'],
} = {}) {
  const rooms = new Map(),
    peers = new Map();
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ ok: true, protocol: 14, rooms: rooms.size }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2048,
    perMessageDeflate: false,
    maxFragments: 16,
    maxBufferedChunks: 64,
  });
  http.on('upgrade', (req, socket, head) => {
    if (
      req.url !== '/play' ||
      (req.headers.origin && !origins.includes(req.headers.origin)) ||
      peers.size >= 256
    ) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit('connection', ws, req),
    );
  });
  const send = (ws, message) => {
    // Snapshots supersede one another. Do not queue seconds of obsolete state.
    if(message.type==='snapshot' && ws.bufferedAmount>32768)return false;
    if (ws.readyState === 1 && ws.bufferedAmount < 262144) {
      ws.send(JSON.stringify(message));return true;
    }
    if (ws.bufferedAmount >= 262144) ws.close(1013, 'Slow connection');
    return false;
  };
  wss.on('connection', (ws) => {
    const peer = {
      room: null,
      token: null,
      budget: 240,
      window: Date.now(),
      joined: false,
      alive: true,
      eventSent: 0,
      chatName: null, chatAt: 0,
    };
    peers.set(ws, peer);
    ws.on('pong', () => {
      peer.alive = true;
    });
    ws.on('error', () => {});
    ws.on('message', (raw) => {
      let action = '';
      try {
        const now = Date.now();
        // Allow delayed TCP batches while bounding sustained traffic per peer.
        peer.budget=Math.min(240,peer.budget+(now-peer.window)*0.09);
        peer.window=now;
        if (--peer.budget < 0) {
          ws.close(1008, 'Rate limit');
          return;
        }
        const m = JSON.parse(raw.toString());
        if (!m || typeof m !== 'object' || Array.isArray(m))
          throw new Error('Invalid message');
        action = typeof m.type==='string'?m.type:'';
        if(m.type==='chat-hello'){
          peer.chatName=String(m.name??'Player').split('').filter(c=>c.charCodeAt(0)>=32&&c!=='<'&&c!=='>').join('').trim().slice(0,16)||'Player';
          send(ws,{type:'chat-ready'});
        }else if(m.type==='chat'){
          if(now-peer.chatAt<1000)throw new Error('Wait a moment before sending again');
          if(!['global','match','team'].includes(m.channel)||typeof m.text!=='string')throw new Error('Invalid chat');
          const text=m.text.split('').map(c=>c.charCodeAt(0)<32?' ':c).join('').trim().slice(0,160);
          if(!text)return;
          const slot=peer.room?.slots.get(peer.token),actor=slot?peer.room.match.actors[slot.id]:null;
          if(m.channel==='global'?!peer.chatName:!actor)throw new Error('Join chat first');
          if(m.channel==='team'&&peer.room.mode<2)throw new Error('No teams in this mode');
          peer.chatAt=now;
          const message={type:'chat',channel:m.channel,name:m.channel==='global'?peer.chatName:actor.name,text};
          for(const [other,p] of peers){
            const recipient=p.room?.slots.get(p.token);
            if(m.channel==='global'?!!p.chatName:p.room===peer.room&&recipient&&(m.channel!=='team'||p.room.match.actors[recipient.id].team===actor.team))send(other,message);
          }
        }else if (m.type === 'create'  || m.type === 'join' || m.type === 'quick') {
          if (peer.joined) throw new Error('Already joined');
          let room;
          if (m.type === 'quick') {
            const duration = m.duration ?? 300;
            const capacity = m.mode === 0 ? (m.capacity ?? 8) : [8,2,4,6][m.mode];
            room = [...rooms.values()].find(r => r.public && r.mode === m.mode && r.map === m.map && r.match.duration === duration && r.capacity === capacity && !r.match.ended && r.match.time > 15 && r.slots.size < r.capacity);
            if (!room) {
              if (rooms.size >= 32) throw new Error('Room limit');
              room = new Room(m.mode, m.map, undefined, { duration, capacity, public: true });
              while (rooms.has(room.code)) room = new Room(m.mode, m.map, undefined, { duration, capacity, public: true });
              rooms.set(room.code, room);
            }
          } else if (m.type === 'create') {
            if (rooms.size >= 32) throw new Error('Room limit');
            room = new Room(m.mode, m.map, undefined, { duration: m.duration, capacity: m.capacity, fragLimit: m.fragLimit, botFill: m.botFill, difficulty: m.difficulty, staging: true });
            while (rooms.has(room.code)) room = new Room(m.mode, m.map, undefined, { duration: m.duration, capacity: m.capacity, fragLimit: m.fragLimit, botFill: m.botFill, difficulty: m.difficulty, staging: true });
            rooms.set(room.code, room);
          } else room = rooms.get(String(m.room ?? '').toUpperCase());
          if (!room) throw new Error('Room unavailable');
          const session = room.join(m.name, m.token, Date.now(), m.primary, m.operator);
          peer.room = room;
          peer.token = session.token;
          peer.joined = true;
          send(ws, {
            type: 'welcome',
            protocol: 14,
            room: room.code,
            ...session,
            tickRate: 120,
            snapshotRate: 20,
          });
          send(ws, room.snapshot(peer.token));
          peer.eventSent = room.eventHead;
        } else if (m.type === 'input') peer.room?.input(peer.token, m);
        else if (m.type === 'deploy')
          send(ws, {
            type: 'deployment',
            accepted: peer.room?.deploy(peer.token, m.primary) ?? false,
          });
        else if (m.type === 'lobby') peer.room?.lobbyChange(peer.token, m);
        else if (m.type === 'rematch') peer.room?.rematch(peer.token);
        else if (m.type === 'start') peer.room?.startMatch(peer.token);
        else if (m.type === 'ping') send(ws, { type: 'pong', nonce: m.nonce });
        else throw new Error('Unknown message');
      } catch (error) {
        send(ws, {
          type: action.startsWith('chat')?'chat-error':['lobby','start','rematch'].includes(action) ? 'lobby-error' : 'error',
          message: error instanceof Error ? error.message : 'Invalid request',
        });
      }
    });
    ws.on('close', () => {
      peer.room?.disconnect(peer.token);
      peers.delete(ws);
    });
  });
  let last = performance.now(),
    accumulator = 0;
  const tick = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min(0.1, (now - last) / 1000);
    last = now;
    let steps = 0;
    while (accumulator >= 1 / 120 && steps++ < 12) {
      for (const room of rooms.values()) room.step();
      accumulator -= 1 / 120;
    }
    for (const [code, room] of rooms)
      if (Date.now() - room.lastActive > 180000) rooms.delete(code);
  }, 1000 / 120);
  const broadcast = setInterval(() => {
    for (const [ws, p] of peers)
      if (p.room) {
        const snapshot = p.room.snapshot(p.token);
        snapshot.events = snapshot.events.filter(
          (event) => event.eventId > p.eventSent,
        );
        if(send(ws, snapshot))p.eventSent = snapshot.eventHead;
      }
  }, 50);
  const heartbeat = setInterval(() => {
    for (const [ws, p] of peers) {
      if (!p.alive) {
        ws.terminate();
        continue;
      }
      p.alive = false;
      ws.ping();
    }
  }, 15000);
  return {
    http,
    rooms,
    wss,
    listen: () =>
      new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, () => {
          http.off('error', reject);
          resolve(http.address());
        });
      }),
    close: () =>
      new Promise((resolve) => {
        clearInterval(tick);
        clearInterval(broadcast);
        clearInterval(heartbeat);
        for (const ws of peers.keys()) ws.terminate();
        wss.close(() => http.close(resolve));
      }),
  };
}
if (process.argv[1]?.endsWith('/server/index.mjs')) {
  const server = createArenaServer({
    host: process.env.KRAGE_HOST || '0.0.0.0',
    port: Number(process.env.PORT || process.env.KRAGE_PORT || 3002),
    origins: (
      process.env.KRAGE_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001'
    ).split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean),
  });
  const address = await server.listen();
  console.log(
    `krage room server: ws://${address.address}:${address.port}/play`,
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => void server.close().then(() => process.exit(0)));
}
