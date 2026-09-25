import { ROOM_PROTOCOL } from '../.server-build/network-state.js';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { Room } from './rooms.mjs';
import { createAccounts } from './accounts.mjs';
export function createArenaServer({
  host = '127.0.0.1',
  port = 3002,
  origins = ['http://localhost:3001', 'http://127.0.0.1:3001'],
} = {}) {
  const rooms = new Map(),
    peers = new Map();
  let pendingAuth = 0;
  const accounts=createAccounts();
  const http = createServer(async (req, res) => {
    if(await accounts.handle(req,res,origins))return;
    if (req.url === '/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ ok: true, protocol: ROOM_PROTOCOL, rooms: rooms.size }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 12288,
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
      chatName: null, chatAt: 0, joining: false, directoryAt: 0, authAt: 0,
    };
    peers.set(ws, peer);
    ws.on('pong', () => {
      peer.alive = true;
    });
    ws.on('error', () => {});
    ws.on('message', async (raw) => {
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
        if(m.type==='rooms'){
          if(now-peer.directoryAt<1500) return;
          peer.directoryAt=now;
          send(ws,{type:'rooms',protocol:ROOM_PROTOCOL,rooms:[...rooms.values()].map(r=>r.listing()).filter(Boolean)});
        }else if(m.type==='chat-hello'){
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
          if (peer.joined || peer.joining) throw new Error('Already joining a room');
          if(now-peer.authAt<1500) throw new Error('Please wait before trying again');
          if(pendingAuth>=8) throw new Error('Server busy. Try again shortly');
          peer.authAt=now; peer.joining=true; pendingAuth++;
          try {
          let room;
          const identity=m.accessToken?await accounts.verify(m.accessToken):null;
          const account=identity?await accounts.get(identity.id):null;
          if(account?.data.migratedTo)throw Error('Sign in again');
          if (m.type === 'quick') {
            // One global queue: fill existing rooms before allocating another.
            room = [...rooms.values()].filter(r=>r.public&&!r.match.ended&&r.match.time>15&&r.slots.size<r.capacity).sort((a,b)=>b.slots.size-a.slots.size)[0];
            if (!room) {
              if (rooms.size >= 32) throw new Error('Room limit');
              const rotation=[...rooms.values()].filter(r=>r.public).length;
              const mode=[0,2,3][rotation%3],map=rotation%2;
              room=new Room(mode,map,undefined,{duration:300,capacity:6,fragLimit:30,public:true,difficulty:'normal'});
              while(rooms.has(room.code))room=new Room(mode,map,undefined,{duration:300,capacity:6,fragLimit:30,public:true,difficulty:'normal'});
              rooms.set(room.code,room);
            }
          } else if (m.type === 'create') {
            if (rooms.size >= 32) throw new Error('Room limit');
            room = new Room(m.mode, m.map, undefined, { duration: m.duration, capacity: m.capacity, fragLimit: m.fragLimit, botFill: m.botFill, difficulty: m.difficulty, listed: m.listed, staging: true });
            while (rooms.has(room.code)) room = new Room(m.mode, m.map, undefined, { duration: m.duration, capacity: m.capacity, fragLimit: m.fragLimit, botFill: m.botFill, difficulty: m.difficulty, listed: m.listed, staging: true });
            await room.setPassword(m.password);
            if(ws.readyState!==1)return;
            if(rooms.size>=32)throw new Error('Room limit');
            rooms.set(room.code, room);
          } else room = rooms.get(String(m.room ?? '').toUpperCase());
          if (!room) throw new Error('Room unavailable');
          if(m.type==='join' && !m.token && !await room.checkPassword(m.password)) throw new Error('Incorrect lobby password');
          if(ws.readyState!==1)return;
          const prior=m.token?room.slots.get(m.token):null;
          if(prior?.accountId&&prior.accountId!==identity?.id)throw Error('Sign in to reconnect');
          if(identity&&[...rooms.values()].some(r=>[...r.slots.values()].some(s=>s.accountId===identity.id&&s.connected)))throw Error('Account already playing on another device');
          const cosmetics=account?accounts.cosmetics(account.data):null;
          const session = room.join(account?.data.name??m.name, m.token, Date.now(), m.primary, cosmetics?.operator??m.operator, cosmetics?.weaponFinishes??m.weaponFinishes);
          const slot=room.slots.get(session.token);slot.accountId=identity?.id??null;slot.accountJoinedAt??=room.match.elapsed;
          peer.room = room;
          peer.token = session.token;
          peer.joined = true;
          send(ws, {
            type: 'welcome',
            protocol: ROOM_PROTOCOL,
            room: room.code,
            ...session,
            tickRate: 120,
            snapshotRate: 20,
          });
          send(ws, room.snapshot(peer.token));
          peer.eventSent = room.eventHead;
          } finally {peer.joining=false;pendingAuth--;}
        } else if (m.type === 'input') peer.room?.input(peer.token, m);
        else if (m.type === 'deploy')
          send(ws, {
            type: 'deployment',
            accepted: peer.room?.deploy(peer.token, m.primary) ?? false,
          });
        else if (m.type === 'kick') {
          if(!peer.room)throw new Error('Join a lobby first');
          const removed=peer.room.kick(peer.token,m.id);
          for(const [other,p] of peers)if(p.room===peer.room&&p.token===removed){
            send(other,{type:'kicked',message:'Removed by host'});p.room=null;p.token=null;other.close(4003,'Removed by host');
          }
        }
        else if (m.type === 'lobby') {
          const slot=peer.room?.slots.get(peer.token);
          if(slot?.accountId){const row=await accounts.get(slot.accountId);if(row.data.migratedTo)throw Error('Sign in again');Object.assign(m,accounts.cosmetics(row.data),{name:row.data.name});}
          peer.room?.lobbyChange(peer.token,m);
        }
        else if (m.type === 'rematch') peer.room?.rematch(peer.token);
        else if (m.type === 'start') peer.room?.startMatch(peer.token);
        else if (m.type === 'ping') send(ws, { type: 'pong', nonce: m.nonce });
        else throw new Error('Unknown message');
      } catch (error) {
        send(ws, {
          type: action.startsWith('chat')?'chat-error':['lobby','start','rematch','kick'].includes(action) ? 'lobby-error' : 'error',
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
      for (const room of rooms.values()) {
        room.step();
        if(room.match.ended&&room.accountRewardRound!==room.roundId){
          room.accountRewardRound=room.roundId;
          for(const [token,slot] of room.slots){
            if(!slot.accountId)continue;
            const a=room.match.actors[slot.id],seconds=room.match.elapsed-(slot.accountJoinedAt??0);
            const receipt={id:room.roundId,seconds,eligible:seconds>=30,kills:a.kills,headshots:a.headshots,meleeKills:a.meleeKills,matches:1,wins:room.snapshot(token).outcome==='victory'?1:0};
            try{accounts.queue(slot.accountId,receipt);}catch{console.error('Account reward could not be queued');}
          }
        }
      }
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
        accounts.close();
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
