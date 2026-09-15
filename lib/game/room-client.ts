import {
  ROOM_PROTOCOL,
  type InputFrame,
  type RoomSnapshot,
} from './network-state.js';
export type ConnectionInfo = {
  lobby?: RoomSnapshot;
  public?: boolean;
  host?: number | null;
  you?: number;
  status: 'connecting' | 'connected' | 'reconnecting' | 'failed';
  room: string;
  ping: number;
  jitter?: number;
  serverStepMs?: number;
  queuedInputs?: number;
  droppedInputs?: number;
  message: string;
  players: number;
  state: 'waiting' | 'playing' | 'ended';
};
export type RoomOptions = {
  url: string;
  room?: string;
  name: string;
  mode: number;
  map: number;
  primary: number;
  operator?: number;
  duration?: number;
  capacity?: number;
  quickPlay?: boolean;
  fragLimit?: number;
  botFill?: boolean;
  difficulty?: string;
};
export function defaultRoomURL() {
  return (
    process.env.NEXT_PUBLIC_ROOM_URL ||
    (['localhost', '127.0.0.1'].includes(location.hostname)
      ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3002/play`
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/play`)
  );
}
/** Transport owns reconnect/heartbeat. Combat and prediction live outside the socket lifecycle. */
export type ChatMessage={channel:'global'|'match'|'team';name:string;text:string};
export class RoomClient {
  onChat: ((message:ChatMessage)=>void)|null=null;
  subscribeChat(receive:(message:ChatMessage)=>void){this.onChat=receive;return()=>{if(this.onChat===receive)this.onChat=null;};}
  chat(channel:'match'|'team',text:string){if(this.socket?.readyState===1)this.socket.send(JSON.stringify({type:'chat',channel,text:text.slice(0,160)}));}

  socket: WebSocket | null = null;
  token = '';
  stopped = false;
  retries = 0;
  retryTimer: ReturnType<typeof setTimeout> | undefined;
  heartbeat: ReturnType<typeof setInterval> | undefined;
  lastMessage = Date.now();
  info: ConnectionInfo = {
    status: 'connecting',
    room: '',
    ping: 0,
    message: '',
    players: 0,
    state: 'waiting',
  };
  constructor(
    public options: RoomOptions,
    public onSnapshot: (s: RoomSnapshot) => void,
    public onStatus: (s: ConnectionInfo) => void,
  ) {}
  notify(change: Partial<ConnectionInfo>) {
    Object.assign(this.info, change);
    this.onStatus({ ...this.info });
  }
  connect() {
    this.stopped = false;
    let address: URL;
    try {
      address = new URL(this.options.url);
      if (
        !['ws:', 'wss:'].includes(address.protocol) ||
        address.username ||
        address.password ||
        (location.protocol === 'https:' && address.protocol !== 'wss:')
      )
        throw new Error('Use a secure wss address on an HTTPS page.');
    } catch (e) {
      this.notify({
        status: 'failed',
        message:
          e instanceof Error ? e.message : 'Invalid room server address.',
      });
      return;
    }
    this.notify({
      status: this.token ? 'reconnecting' : 'connecting',
      message: '',
    });
    const socket = (this.socket = new WebSocket(address.href));
    this.lastMessage = Date.now();
    socket.onopen = () => {
      if(this.socket!==socket||this.stopped){socket.close();return;}
      socket.send(
        JSON.stringify(
          this.token
            ? { type: 'join', room: this.info.room, token: this.token }
            : { type: this.options.room ? 'join' : this.options.quickPlay ? 'quick' : 'create', ...this.options },
        ),
      );
    };
    socket.onmessage = (event) => {
      if(this.socket!==socket||this.stopped)return;
      this.lastMessage = Date.now();
      try {
        const m = JSON.parse(event.data);
        if(m.type==='chat')this.onChat?.(m);
        else if(m.type==='chat-error')this.onChat?.({channel:'match',name:'SYSTEM',text:String(m.message)});
        else if (m.type === 'welcome') {
          if (m.protocol !== ROOM_PROTOCOL) {
            this.stop();
            this.notify({
              status: 'failed',
              message: 'Server version differs. Refresh both game and server.',
            });
            return;
          }
          this.token = m.token;
          this.retries = 0;
          this.notify({ status: 'connected', room: m.room, message: '' });
        } else if (m.type === 'snapshot') {
          this.notify({
            players: m.actors.filter((a: { connected: boolean }) => a.connected)
              .length,
            state: m.state,
            lobby: m.staging ? m : undefined,
            public:m.public,host:m.host,you:m.you,
            serverStepMs: m.serverStepMs ?? 0,
            queuedInputs: m.queuedInputs ?? 0,
            droppedInputs:m.droppedInputs??0,
          });
          this.onSnapshot(m);
        } else if (m.type === 'pong' && typeof m.nonce === 'number') {
          const ping = Math.max(0, Date.now() - m.nonce);
          this.notify({ ping, jitter: this.info.ping ? (this.info.jitter ?? 0) * 0.8 + Math.abs(ping - this.info.ping) * 0.2 : 0 });
        }
        else if (m.type === 'error') {
          this.stop();
          this.notify({
            status: 'failed',
            message: String(m.message).slice(0, 120),
          });
        } else if (m.type === 'deployment' && !m.accepted)
          this.notify({
            message: 'Deployment not ready. Choose your primary and try again.',
          });
      } catch {
        this.stop();
        this.notify({ status: 'failed', message: 'Invalid server response.' });
      }
    };
    socket.onerror = () => {
      /* close determines whether reconnect is possible */
    };
    socket.onclose = () => {
      if(this.socket!==socket)return;
      clearInterval(this.heartbeat);
      if (this.stopped) return;
      if (this.token && this.retries++ < 12) {
        this.notify({
          status: 'reconnecting',
          message: 'Connection lost. Rejoining your slot…',
        });
        this.retryTimer = setTimeout(
          () => this.connect(),
          Math.min(3000, this.retries * 500),
        );
      } else
        this.notify({
          status: 'failed',
          message: this.token
            ? 'Your session could not be restored. Return to the lobby.'
            : 'Cannot reach the room server. Check the address and that it is running.',
        });
    };
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastMessage > (document.hidden ? 45000 : 15000)) {
        socket.close();
        return;
      }
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'ping', nonce: Date.now() }));
    }, 1000);
  }
  send(frame: InputFrame) {
    if (
      this.info.status === 'connected' &&
      this.socket?.readyState === WebSocket.OPEN &&
      this.socket.bufferedAmount < 8192
    )
      this.socket.send(JSON.stringify({ type: 'input', ...frame }));
  }
  lobby(change: { primary?: number; operator?: number; ready?: boolean }) {
    this.notify({message:''});
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({type:'lobby',...change}));
  }
  retry() {
    this.stop();this.retries=0;this.connect();
  }
  rematch() {
    if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type:'rematch'}));
  }
  startMatch() {
    this.notify({message:''});
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({type:'start'}));
  }
  deploy(primary: number) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: 'deploy', primary }));
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.socket = null;
  }
}
