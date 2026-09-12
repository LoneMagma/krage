import { cameraMotion } from './motion';
import { NetworkState, type RoomSnapshot } from './network-state';
import {
  RoomClient,
  type ConnectionInfo,
  type RoomOptions,
} from './room-client';
import { FrameStats, type FrameReport } from './performance';
import { weaponPose, equipPose } from './animation';
import { CaptureGuard, respawnShortcut, CrouchControl, boundKey } from './controls';
import { syncView } from './view';
import * as T from 'three';
import {
  Match,
  DEFAULT_SETTINGS,
  GUNS,
  EDGE_ATTACKS,
  shotSpread,
  emptyInput,
  eye,
  clamp,
  v,
  dist,
  hasLOS,
  type Settings,
  type Mode,
  type Vec,
  type GameEvent,
} from './core';
import {
  buildMap,
  avatar,
  modelVariant,
  cloneAvatar,
  animateAvatar,
  makeWeapon,
  poseAvatar,
  RIG_LINKS,
  material,
  disposeObject,
  disposeMaterials,
  type Avatar,
} from './graphics';
import { ARENA_PALETTES, COLORS } from './palette';
import { stepRagdoll } from './ragdoll';
import { type MatchReceipt } from './progression';
import { matchReport } from './report';
import { AudioSystem } from './audio';
import { registerGameTools } from './webmcp';
export type Phase = 'menu' | 'playing' | 'spawning' | 'paused' | 'ended';
export type Snapshot = {
  phase: Phase;
  mode: Mode;
  network: ConnectionInfo | null;
  hp: number;
  ammo: number;
  weapon: number;
  primary: number;
  reload: number;
  equip: number;
  lastDeath: null | { killer: string; weapon: number; head: boolean };
  time: number;
  elapsed: number;
  score: number;
  deaths: number;
  streak: number;
  speed: number;
  fps: number;
  frameMs: number;
  diagnostics?: { drawCalls: number; triangles: number; modelRebuilds: number; pendingInputs: number };
  crouched: boolean;
  lastBenchmark: Snapshot['benchmark'];
  dragAim: boolean;
  captureFailed: boolean;
  performance: FrameReport;
  benchmark: null | {
    remaining: number;
    complete: boolean;
    shots: number;
    kills: number;
    deaths: number;
    maxCorpses: number;
    drawCalls: number;
    triangles: number;
    width: number;
    height: number;
    quality: string;
    report: FrameReport;
  };
  shield: number;
  respawn: number;
  alive: boolean;
  teams: number[];
  winner: string;
  leaderboard: {
    id: number;
    name: string;
    bot?: boolean;
    team: number;
    kills: number;
    deaths: number;
    score: number;
  }[];
  shots: number;
  hits: number;
  headshots: number;
  slideCooldown: number;
  map: string;
};
export const EMPTY_SNAPSHOT: Snapshot = {
  phase: 'menu',
  mode: 0,
  network: null,
  hp: 100,
  ammo: 30,
  weapon: 1,
  primary: 1,
  reload: 0,
  equip: 0,
  lastDeath: null,
  time: 300,
  elapsed: 0,
  score: 0,
  deaths: 0,
  streak: 0,
  speed: 0,
  fps: 0,
  frameMs: 0,
  crouched: false,
  lastBenchmark: null,
  dragAim: false,
  captureFailed: false,
  performance: new FrameStats().report(),
  benchmark: null,
  shield: 0,
  respawn: 0,
  alive: true,
  teams: [0, 0],
  winner: '',
  leaderboard: [],
  shots: 0,
  hits: 0,
  headshots: 0,
  slideCooldown: 0,
  map: 'DUNE',
};
export type Feed = {
  id: number;
  killer: string;
  victim: string;
  weapon: number;
  head: boolean;
  own: boolean;
  time: number;
};
type Spark = { mesh: T.Mesh; velocity: T.Vector3; life: number; max: number };
const TRACER_PROFILES = [
  {speed:220,length:0.65,width:0.009,color:0xffd6a0},
  {speed:340,length:1.05,width:0.012,color:0xffb768},
  {speed:180,length:0.38,width:0.016,color:0xffedc7},
];
type Trace = {
  speed: number;
  length: number;
  mesh: T.Mesh;
  life: number;
  start: T.Vector3;
  direction: T.Vector3;
  distance: number;
  age: number;
};
type Mark = { mesh: T.Mesh; life: number };
type Doll = {
  group: T.Group;
  points: T.Vector3[];
  old: T.Vector3[];
  model: Avatar;
  yaw: number;
  life: number;
  accumulator: number;
  links: number[][];
  constraints: number[][];
  quiet: number;
  sleeping: boolean;
};
export class Arena {
  network: NetworkState | null = null;
  roomClient: RoomClient | null = null;
  connection: ConnectionInfo | null = null;
  networkPrimary: number | null = null;
  networkLobbyMap = 0;
  joinRoom(options: RoomOptions) {
    this.networkLobbyMap = this.match.map.id;
    this.disconnectRoom();
    this.phase = 'menu';
    this.audio.start();
    this.roomClient = new RoomClient(
      options,
      (snapshot) => this.receiveRoom(snapshot),
      (info) => {
        const previous=this.connection;
        this.connection = info;
        if (info.status !== 'connected' && this.network) {
          if(info.status==='failed')this.pause();
          this.keys.clear();this.mouseDown=this.ads=false;this.input=emptyInput();
          this.network.history = [];
        }
        // HUD already refreshes at 10Hz; avoid two React updates per snapshot.
        if(previous?.status!==info.status||previous?.message!==info.message||previous?.players!==info.players)this.emit();
      },
    );
    this.roomClient.connect();
  }
  disconnectRoom() {
    this.capture.cancel();
    this.roomClient?.stop();
    this.roomClient = null;
    this.network = null;
    this.connection = null;
    this.networkPrimary = null;
  }
  receiveRoom(snapshot: RoomSnapshot) {
    const previousPhase=this.phase;
    if (snapshot.staging) {
      if(this.network){this.network=null;this.resetEffects();this.keys.clear();this.mouseDown=this.ads=false;}
      this.phase = 'menu'; if(previousPhase!==this.phase)this.emit(); return;
    }
    if (!this.network) {
      this.network = new NetworkState(snapshot);
      this.match = this.network.match;
      this.resetEffects();
      this.lastDeath = null;
      this.feed = [];
      this.onFeed([]);
      disposeObject(this.mapGroup);
      this.mapGroup = buildMap(this.match.map);
      this.scene.add(this.mapGroup);
      this.loadModels();
      this.applyTheme();
      this.phase = 'paused';
      this.benchmark = null;
      this.input = emptyInput();
      this.keys.clear();
      this.previous.copy(this.match.player.pos);
      this.camera.position.copy(eye(this.match.player));
    } else if (!this.network.accept(snapshot)) return;
    const paused = this.phase === 'paused';
    this.processEvents();
    if (this.match.ended) {
      this.phase = 'ended';
      this.onScoreboard(false);
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (paused) this.phase = 'paused';
    else if (this.match.pendingSpawn) this.phase = 'spawning';
    else if (this.phase === 'spawning') this.phase = 'playing';
    if (!this.match.player.alive && this.networkPrimary !== null)
      this.match.player.primary = this.networkPrimary;
    else if (this.match.player.alive) this.networkPrimary = null;
    if(previousPhase!==this.phase)this.emit();
  }
  stepOnline(dt: number) {
    const net = this.network!;
    if (this.connection?.status !== 'connected' || net.state !== 'playing')
      return;
    this.accumulator += dt;
    let count = 0;
    while (this.accumulator >= 1 / 60 && count++ < 6) {
      const frame = net.frame(this.input);
      this.roomClient?.send(frame);
      for (const event of net.feedbackEvents.splice(0)) {
        if (event.type === 'shot') {
          this.audio.shot(event.weapon, eye(this.match.player), eye(this.match.player), this.match.player.yaw, true, event.attack);
          if (event.weapon !== 3) this.gunKick = Math.min(1, this.gunKick + GUNS[event.weapon].recoil * 15);
        } else if (event.type === 'reload') this.audio.reload(event.weapon);
        else this.audio.equip(event.weapon);
      }
      this.fireQueued = this.jumpQueued = false;
      this.input.fire = this.mouseDown || this.touch.fire || this.keys.has('Mouse0');
      this.input.jump = this.keys.has('Space') || this.touch.jump;
      this.slidePulse = false;
      this.input.slide =
        this.keys.has(this.settings.slideKey) || this.touch.slide;
      this.input.reload = false;
      this.input.weapon = -1;
      this.accumulator -= 1 / 60;
    }
  }

  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(95, 1, 0.06, 150);
  gunScene = new T.Scene();
  gunCamera = new T.PerspectiveCamera(65, 1, 0.01, 10);
  mapGroup: T.Group;
  gun: T.Group;
  viewWeapons: T.Group[];
  lastDeath: Snapshot['lastDeath'] = null;
  botFootsteps = new Map<number, number>();
  operatorVariant = 0;
  finishVariant = 0;
  weaponFinishes: number[] = [0, 0, 0];
  lastFragTime = -Infinity;
  comboCount = 0;
  roundId = '';
  onMatchComplete: (receipt: MatchReceipt) => void = () => {};
  flash: T.Mesh;
  sun: T.DirectionalLight;
  match: Match;
  phase: Phase = 'menu';
  settings: Settings = { ...DEFAULT_SETTINGS };
  models: Avatar[] = [];
  frame = 0;
  last = 0;
  accumulator = 0;
  stopped = false;
  dragAim = false;
  captureFailed = false;
  capture = new CaptureGuard();
  dragX = 0;
  dragY = 0;
  frameStats = new FrameStats();
  benchmark: Snapshot['benchmark'] = null;
  lastBenchmark: Snapshot['benchmark'] = null;
  benchmarkElapsed = 0;
  benchmarkPriorDrag = false;
  renderCalls = 0;
  renderTriangles = 0;
  reloadPhase = 'ready';
  damageAngle = 0;
  keys = new Set<string>();
  crouchControl = new CrouchControl();
  slidePulse = false;
  marks: Mark[] = [];
  radarTime = 0;
  mouseDown = false;
  fireQueued = false;
  jumpQueued = false;
  ads = false;
  input = emptyInput();
  touch = emptyInput();
  touchMode = false;
  adsLerp = 0;
  gunKick = 0;
  recoil = 0;
  time = 0;
  lastHud = 0;
  fpsTime = 0;
  fpsFrames = 0;
  fps = 0;
  frameMs = 0;
  footTime = 0;
  lastWeapon = 1;
  traces: Trace[] = [];
  sparks: Spark[] = [];
  dolls: Doll[] = [];
  audio = new AudioSystem();
  hud?: HTMLElement;
  minimap: HTMLCanvasElement | null = null;
  hitFlash = 0;
  damageFlash = 0;
  killFlash = 0;
  crossSpread = 0;
  eventId = 0;
  feed: Feed[] = [];
  snap: Snapshot = { ...EMPTY_SNAPSHOT };
  onSnapshot: (s: Snapshot) => void = () => {};
  onFeed: (f: Feed[]) => void = () => {};
  onError: (s: string) => void = () => {};
  onScoreboard: (b: boolean) => void = () => {};
  onFrag: (message: string) => void = () => {};
  cleanup: (() => void)[] = [];
  previous = new T.Vector3();
  cameraRoll = 0;
  landing = 0;
  swayX = 0;
  swayY = 0;
  lobbyScene = new T.Scene();
  lobbyCamera = new T.PerspectiveCamera(34, 1, 0.1, 20);
  lobbyAvatar = avatar(COLORS.action);
  themeLight = new T.HemisphereLight('#f4d4a2', '#31313b', 2.1);
  mapPreviews: string[] = [];

  constructor(public host: HTMLDivElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: false,
      powerPreference: 'low-power',
      alpha: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color('#94bac0');
    this.scene.fog = new T.Fog('#94bac0', 48, 115);
    this.scene.add(this.themeLight);
    this.sun = new T.DirectionalLight('#fff0d3', 2.5);
    this.sun.position.set(-18, 32, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -26,
      right: 26,
      top: 25,
      bottom: -25,
      near: 1,
      far: 90,
    });
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.gunScene.add(new T.HemisphereLight('#e7f7ff', '#506658', 2.5));
    const gs = new T.DirectionalLight('#ffe1b5', 2.5);
    gs.position.set(-2, 4, -1);
    this.gunScene.add(gs);
    this.viewWeapons = [0, 1, 2, 3].map((id) => makeWeapon(id));
    this.gun = this.viewWeapons[1];
    this.gunScene.add(this.gun);
    this.flash = new T.Mesh(
      new T.ConeGeometry(0.08, 0.26, 5),
      new T.MeshBasicMaterial({
        color: '#ffdb86',
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.flash.rotation.x = -Math.PI / 2;
    this.flash.visible = false;
    this.gun.add(this.flash);
    this.flash.position.set(0, 0.02, -0.98);
    this.match = new Match(0, 0, 5);
    this.mapGroup = buildMap(this.match.map);
    this.scene.add(this.mapGroup);
    this.loadModels();
    this.applyTheme();
    this.lobbyScene.add(new T.HemisphereLight('#dcebf2', '#333d49', 2.6));
    const key = new T.DirectionalLight('#ffe0ad', 3.3);
    key.position.set(-2, 4, 3);
    this.lobbyScene.add(key);
    const rim = new T.DirectionalLight('#8bd8eb', 2);
    rim.position.set(3, 2, -2);
    this.lobbyScene.add(rim);
    const ground = new T.Mesh(new T.CircleGeometry(1.2, 48), new T.MeshBasicMaterial({color:'#101820',transparent:true,opacity:0.3,depthWrite:false}));
    ground.rotation.x=-Math.PI/2; ground.position.y=-0.025; ground.scale.y=0.65;
    this.lobbyScene.add(ground);
    this.lobbyScene.add(this.lobbyAvatar.group);
    this.lobbyAvatar.group.rotation.y = Math.PI + 0.3;
    this.lobbyAvatar.ring.visible = false;
    this.lobbyAvatar.weapon.visible = true;
    this.lobbyCamera.position.set(0, 1.2, 3.6);
    this.lobbyCamera.lookAt(0, 0.92, 0);
    try {
      this.lastBenchmark = JSON.parse(
        localStorage.getItem('krage-last-benchmark') || 'null',
      );
    } catch {}
    this.listen(window, 'resize', this.resize);
    this.listen(document, 'keydown', this.keyDown as EventListener);
    this.listen(document, 'keyup', this.keyUp as EventListener);
    this.listen(document, 'mousemove', this.mouseMove as EventListener);
    this.listen(document, 'pointerlockchange', this.lockChanged);
    this.listen(document, 'pointerlockerror', () => {
      this.captureError(this.capture.generation);
    });
    this.listen(host, 'mousedown', ((e: MouseEvent) => {
      if (this.phase === 'playing') {
        this.dragX = e.clientX;
        this.dragY = e.clientY;
        if (e.button === 0) {
          this.mouseDown = true;
          this.fireQueued = true;
        }
        if (e.button === 2) this.ads = true;
      }
    }) as EventListener);
    this.listen(document, 'mouseup', ((e: MouseEvent) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.ads = false;
    }) as EventListener);
    this.listen(host, 'contextmenu', (e) => e.preventDefault());
    this.listen(host, 'wheel', ((e: WheelEvent) => {
      if (this.phase !== 'playing') return;
      e.preventDefault();
      this.input.weapon =
        this.match.player.weapon === 3 ? this.match.player.primary : 3;
    }) as EventListener);
    this.listen(window, 'blur', () => this.pause());
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    this.listen(this.renderer.domElement, 'webglcontextlost', (e) => {
      e.preventDefault();
      this.pause();
      this.onError(
        'Graphics were interrupted. Reload this page to restore the arena.',
      );
    });
    this.cleanup.push(
      registerGameTools(
        () => this.snap,
        () => this.pause(),
      ),
    );
    const viewportObserver = new ResizeObserver(this.resize);
    viewportObserver.observe(this.host);
    this.cleanup.push(() => viewportObserver.disconnect());
    this.resize();
    this.frame = requestAnimationFrame(this.loop);
  }
  listen(target: EventTarget, name: string, fn: EventListener) {
    target.addEventListener(name, fn, { passive: false });
    this.cleanup.push(() => target.removeEventListener(name, fn));
  }
  resize = () => {
    const w = this.host.clientWidth || innerWidth,
      h = this.host.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.gunCamera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.gunCamera.updateProjectionMatrix();
  };
  setSettings(settings: Settings) {
    this.settings = { ...settings };
    this.match.difficulty = settings.difficulty;
    this.audio.setVolume(settings.effectsEnabled === false ? 0 : settings.volume);
    this.renderer.setPixelRatio(
      settings.quality === 'potato'
        ? 0.7
        : settings.quality === 'high'
          ? Math.min(devicePixelRatio, 1.6)
          : 1,
    );
    this.renderer.shadowMap.enabled = settings.quality === 'high';
    this.crouchControl.reset();
    this.resize();
  }
  modelRebuilds = 0;
  loadModels() {
    this.modelRebuilds++;
    for (const m of this.models) disposeObject(m.group);
    this.models = this.match.actors.map((a) => {
      const m = avatar(
        a.id === 0
          ? COLORS.action
          : this.match.mode >= 2 && a.team === 0
            ? COLORS.ally
            : COLORS.enemy,
        modelVariant(a, this.match.mode, this.operatorVariant),
        a.id === 0 ? this.finishVariant : 0,
      );
      this.scene.add(m.group);
      return m;
    });
  }
  applyTheme() {
    const foundry = this.match.map.id === 0,
      palette = ARENA_PALETTES[this.match.map.id];
    this.scene.background = new T.Color(palette.sky);
    this.scene.fog = new T.Fog(palette.sky, 65, 145);
    this.themeLight.color.set(palette.light);
    this.themeLight.groundColor.set(palette.bounce);
    this.sun.color.set(palette.sun);
    this.sun.intensity = foundry ? 2.8 : 2.35;
    this.themeLight.intensity = foundry ? 1.65 : 1.9;
    this.sun.position.set(foundry ? -22 : 18, 38, 16);
    this.sun.shadow.camera.left = -34;
    this.sun.shadow.camera.right = 34;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.updateProjectionMatrix();
  }
  setCosmetics(operator: number, finish: number, weaponFinishes = [finish, finish, finish]) {
    if (this.operatorVariant === operator && this.finishVariant === finish && this.weaponFinishes.join() === weaponFinishes.join())
      return;
    this.operatorVariant = operator;
    this.finishVariant = finish;
    this.weaponFinishes = weaponFinishes;
    const primary = this.lobbyAvatar.gunId;
    disposeObject(this.lobbyAvatar.group);
    this.lobbyAvatar = avatar(COLORS.action, operator, finish);
    this.lobbyAvatar.ring.visible = this.lobbyAvatar.shadow.visible = false;
    this.lobbyScene.add(this.lobbyAvatar.group);
    this.setPrimaryPreview(primary);
    this.gun.remove(this.flash);
    for (const gun of this.viewWeapons) disposeObject(gun);
    this.viewWeapons = [0, 1, 2, 3].map((id) => makeWeapon(id, true, weaponFinishes[id] ?? finish));
    this.gun = this.viewWeapons[this.match.player.weapon];
    this.gun.add(this.flash);
    this.gunScene.add(this.gun);
  }
  setPrimaryPreview(primary: number) {
    disposeObject(this.lobbyAvatar.weapon);
    const gun = makeWeapon(primary, false, this.weaponFinishes[primary] ?? this.finishVariant);
    gun.scale.setScalar(0.65);
    gun.position.set(0.22, 1.1, -0.32);
    this.lobbyAvatar.group.add(gun);
    this.lobbyAvatar.weapon = gun;
    this.lobbyAvatar.gunId = primary;
  }
  choosePrimary(primary: number) {
    if (
      this.network &&
      [0, 1, 2].includes(primary) &&
      !this.match.player.alive
    ) {
      this.networkPrimary = primary;
      this.match.player.primary = primary;
    } else this.match.selectPrimary(primary);
    this.emit();
  }
  deploy() {
    if (this.network) {
      if (
        this.connection?.status !== 'connected' ||
        this.match.player.alive ||
        this.match.player.respawn > 0
      )
        return;
      this.roomClient?.deploy(this.match.player.primary);
      this.match.pendingSpawn = false;
      this.resume();
      return;
    }
    if (this.match.deployPlayer()) {
      this.previous.copy(this.match.player.pos);
      this.camera.position.copy(eye(this.match.player));
      this.resume();
    }
  }
  setMap(id: number) {
    if (this.phase !== 'menu' || id === this.match.map.id) return;
    disposeObject(this.mapGroup);
    this.match = new Match(0, id, 5);
    this.mapGroup = buildMap(this.match.map);
    this.scene.add(this.mapGroup);
    this.loadModels();
    this.applyTheme();
  }
  start(
    mode: Mode,
    map: number,
    bots: number,
    difficulty: Settings['difficulty'],
    weapon = 1,
    seed?: number,
  ) {
    this.disconnectRoom();
    this.resetEffects();
    this.lastDeath = null;
    this.roundId = crypto.randomUUID();
    this.botFootsteps.clear();
    this.match = new Match(mode, map, bots, difficulty, seed);
    this.match.player.primary = weapon;
    this.match.spawn(this.match.player, true);
    disposeObject(this.mapGroup);
    this.mapGroup = buildMap(this.match.map);
    this.scene.add(this.mapGroup);
    this.loadModels();
    this.applyTheme();
    this.feed = [];
    this.onFeed([]);
    this.previous.copy(this.match.player.pos);
    this.camera.position.copy(eye(this.match.player));
    this.input = emptyInput();
    this.touch = emptyInput();
    this.keys.clear();
    this.crouchControl.reset();
    this.slidePulse = false;
    this.mouseDown = false;
    this.fireQueued = this.jumpQueued = false;
    this.ads = false;
    this.accumulator = 0;
    this.adsLerp = 0;
    this.recoil = 0;
    this.gunKick = 0;
    this.landing = this.cameraRoll = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.footTime = 0;
    this.frameStats.reset();
    this.benchmark = null;
    this.resume();
  }
  useDragAim() {
    this.capture.cancel();
    this.dragAim = true;
    this.captureFailed = false;
    this.onError('');
    this.resume();
  }
  startBenchmark() {
    this.benchmarkPriorDrag = this.dragAim;
    this.dragAim = true;
    this.start(0, 0, 5, 'normal', 1, 7331);
    this.match.fragLimit = 999;
    this.benchmarkElapsed = 0;
    this.benchmark = {
      remaining: 30,
      complete: false,
      shots: 0,
      kills: 0,
      deaths: 0,
      maxCorpses: 0,
      drawCalls: 0,
      triangles: 0,
      width: this.renderer.domElement.width,
      height: this.renderer.domElement.height,
      quality: this.settings.quality,
      report: this.frameStats.report(),
    };
    this.emit();
  }
  captureError(request: number) {
    if(document.pointerLockElement===this.renderer.domElement || !this.capture.settle(request))return;
    this.captureFailed=true;this.pause();
    this.onError('Mouse capture failed. Retry Resume or use drag aim.');
  }
  resume() {
    if(this.network&&this.connection?.status!=='connected')return;
    if(this.match.ended||this.capture.pending)return;
    this.captureFailed=false;this.onError('');
    this.audio.start();
    this.phase = this.match.pendingSpawn ? 'spawning' : 'playing';
    this.mouseDown = false;
    this.fireQueued = this.jumpQueued = false;
    this.ads = false;
    this.keys.clear();
    this.crouchControl.reset();
    this.slidePulse = false;
    this.input = emptyInput();
    this.last = performance.now();
    this.accumulator = 0;
    if (!this.touchMode && !this.dragAim && this.phase === 'playing' && document.pointerLockElement!==this.renderer.domElement) {
      const request=this.capture.begin();
      setTimeout(()=>this.captureError(request),2500);
      try {
        const p=this.renderer.domElement.requestPointerLock();
        if(p&&typeof p.catch==='function')p.catch(()=>this.captureError(request));
      }catch{this.captureError(request);}
    }
    this.emit();
  }
  pause() {
    if (this.phase !== 'playing' && this.phase !== 'spawning') return;
    this.phase = 'paused';
    this.capture.cancel();
    if (this.network && this.connection?.status === 'connected')
      this.roomClient?.send(this.network.neutral());
    this.keys.clear();
    this.crouchControl.reset();
    this.slidePulse = false;
    this.mouseDown = false;
    this.fireQueued = this.jumpQueued = false;
    this.ads = false;
    this.touch = emptyInput();
    this.input = emptyInput();
    this.onScoreboard(false);
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock();
    this.emit();
  }
  rejoinRoom() {
    if(!this.roomClient)return;
    this.roomClient.retry();
  }
  playAgain() {
    if(this.connection&&!this.connection.public){this.roomClient?.rematch();return;}
    if(this.roomClient){const options={...this.roomClient.options,room:undefined,quickPlay:true};this.joinRoom(options);}
  }
  lobby() {
    const wasOnline = !!this.network;
    this.disconnectRoom();
    this.phase = 'menu';
    if (wasOnline) this.setMap(this.networkLobbyMap);
    if (this.benchmark) this.dragAim = this.benchmarkPriorDrag;
    this.benchmark = null;
    this.keys.clear();
    this.crouchControl.reset();
    this.slidePulse = false;
    this.mouseDown = false;
    this.fireQueued = this.jumpQueued = false;
    this.ads = false;
    this.onScoreboard(false);
    this.feed = [];
    this.onFeed([]);
    this.resetEffects();
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock();
    this.emit();
  }
  lockChanged = () => {
    if(document.pointerLockElement===this.renderer.domElement){const requested=this.capture.settle(this.capture.generation);if(!requested&&this.phase!=='playing'){document.exitPointerLock();return;}this.captureFailed=false;if(requested&&this.phase==='paused')this.phase=this.match.pendingSpawn?'spawning':'playing';this.emit();return;}
    if (
      document.pointerLockElement !== this.renderer.domElement &&
      !this.touchMode &&
      !this.dragAim &&
      !this.capture.pending &&
      this.phase === 'playing'
    )
      this.pause();
  };
  keyDown = (e: KeyboardEvent) => {
    const target=e.target as HTMLElement | null;
    if(e.defaultPrevented||target?.isContentEditable||target?.closest('input,textarea,select,button,[role="dialog"]'))return;
    const code = boundKey(e.code, this.settings.bindings);
    if (
      code === 'Escape' &&
      (this.phase === 'playing' || this.phase === 'spawning')
    ) {
      e.preventDefault();
      this.pause();
      return;
    }
    if(this.phase==='paused'&&code==='Enter'&&!e.repeat){e.preventDefault();this.resume();return;}
    if (this.phase === 'spawning') {
      if(code==='Space')e.preventDefault();
      if(code==='Tab'){e.preventDefault();this.onScoreboard(true);}
      if (respawnShortcut(code,e.repeat)) {
        e.preventDefault();
        this.deploy();
      }
      const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(code);
      if (index >= 0) {
        e.preventDefault();
        this.choosePrimary(index);
      }
      return;
    }
    if (this.phase !== 'playing') return;
    if (
      [
        'Space',
        'Tab',
        'ShiftLeft',
        'ShiftRight',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(code)
    )
      e.preventDefault();
    if(e.repeat&&code==='Space'&&!this.keys.has('Space'))return;
    this.keys.add(code);
    const crouchKey =
      code === 'ShiftRight'
        ? 'ShiftLeft'
        : code === 'ControlRight'
          ? 'ControlLeft'
          : code;
    if (crouchKey === this.settings.crouchKey) {
      e.preventDefault();
      this.crouchControl.press(performance.now());
      this.slidePulse ||= this.crouchControl.consumeSlide();
    }
    if (code === this.settings.slideKey) e.preventDefault();
    if (e.repeat) return;
    if (code === 'Space') this.jumpQueued = true;
    if (code === 'Tab') this.onScoreboard(true);
    if (code === 'KeyR') this.input.reload = true;
    if (code === 'Digit1') this.input.weapon = this.match.player.primary;
    if (code === 'Digit2') this.input.weapon = 3;
    if (code === 'KeyQ')
      this.input.weapon =
        this.match.player.weapon === 3 ? this.match.player.primary : 3;
  };
  keyUp = (e: KeyboardEvent) => {
    const code = boundKey(e.code, this.settings.bindings);
    this.keys.delete(code);
    const crouchKey =
      code === 'ShiftRight'
        ? 'ShiftLeft'
        : code === 'ControlRight'
          ? 'ControlLeft'
          : code;
    if (crouchKey === this.settings.crouchKey) this.crouchControl.release();
    if (code === 'Tab') {
      e.preventDefault();
      this.onScoreboard(false);
    }
  };
  mouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing' || !this.match.player.alive) return;
    if (this.dragAim) {
      if (this.ads || this.mouseDown)
        this.look(e.clientX - this.dragX, e.clientY - this.dragY);
      this.dragX = e.clientX;
      this.dragY = e.clientY;
    } else if (document.pointerLockElement === this.renderer.domElement)
      this.look(e.movementX, e.movementY);
  };
  look(dx: number, dy: number) {
    if (this.phase !== 'playing') return;
    const p = this.match.player,
      m =
        this.settings.sensitivity *
        0.002 *
        ((this.ads || this.touch.ads || this.keys.has('Mouse2')) && this.match.player.weapon !== 3 ? 0.55 : 1);
    this.swayX = clamp(this.swayX + dx * 0.00013, -0.018, 0.018);
    this.swayY = clamp(this.swayY + dy * 0.00013, -0.015, 0.015);
    p.yaw -= clamp(dx, -350, 350) * m;
    p.pitch = clamp(
      p.pitch - dy * m * (this.settings.invertY ? -1 : 1),
      -1.48,
      1.48,
    );
  }
  loop = (now: number) => {
    if (this.stopped) return;
    this.frame = requestAnimationFrame(this.loop);
    const realDt = Math.max(0, (now - (this.last || now)) / 1000),
      dt = Math.min(0.1, realDt);
    this.last = now;
    this.time += dt;
    this.fpsFrames++;
    this.fpsTime += realDt;
    if (this.fpsTime > 0.5) {
      this.frameMs = (this.fpsTime * 1000) / this.fpsFrames;
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsTime = 0;
      this.fpsFrames = 0;
    }
    if (this.phase === 'playing' || this.phase === 'spawning') {
      const p = this.match.player;
      if (this.dragAim && !this.benchmark) {
        const yawInput =
          Number(this.keys.has('KeyJ')) - Number(this.keys.has('KeyL'));
        const pitchInput =
          Number(this.keys.has('KeyI')) - Number(this.keys.has('KeyK'));
        p.yaw += yawInput * dt * 1.8;
        p.pitch = clamp(p.pitch + pitchInput * dt * 1.4, -1.48, 1.48);
      }
      this.input.forward =
        Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
        Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) +
        this.touch.forward;
      this.input.right =
        Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
        Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) +
        this.touch.right;
      this.input.jump =
        this.keys.has('Space') || this.jumpQueued || this.touch.jump;
      this.input.crouch = this.crouchControl.active || this.touch.crouch;
      this.input.slide =
        this.slidePulse ||
        this.keys.has(this.settings.slideKey) ||
        (this.settings.slideKey === 'ShiftLeft' &&
          this.keys.has('ShiftRight')) ||
        (this.settings.slideKey === 'ControlLeft' &&
          this.keys.has('ControlRight')) ||
        this.touch.slide;
      this.input.fire =
        this.phase === 'playing' &&
        (this.mouseDown || this.fireQueued || this.touch.fire || this.keys.has('Mouse0'));
      this.input.ads = this.ads || this.touch.ads || this.keys.has('Mouse2');
      if (this.benchmark && !this.benchmark.complete) {
        this.benchmarkElapsed += realDt;
        this.benchmark.remaining = Math.max(0, 30 - this.benchmarkElapsed);
        if (this.benchmarkElapsed > 2) this.frameStats.record(realDt);
        if (this.match.pendingSpawn && p.respawn <= 0) {
          this.match.deployPlayer();
          this.phase = 'playing';
        }
        const target = this.match.actors
          .filter(
            (a) =>
              a.alive &&
              a.id !== 0 &&
              hasLOS(eye(p), eye(a), this.match.map.blocks),
          )
          .sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos))[0];
        if (target) {
          p.yaw = Math.atan2(p.pos.x - target.pos.x, p.pos.z - target.pos.z);
          p.pitch = Math.atan2(
            target.pos.y + target.viewHeight - 0.3 - eye(p).y,
            Math.hypot(target.pos.x - p.pos.x, target.pos.z - p.pos.z),
          );
          p.recoilPitch = p.recoilYaw = 0;
          this.input.fire = true;
          this.input.forward = 0.3;
          this.input.right = Math.sin(this.match.elapsed * 1.3) * 0.6;
        } else {
          p.yaw = Math.atan2(p.pos.x, p.pos.z);
          this.input.forward = 1;
          this.input.right = Math.sin(this.match.elapsed) * 0.7;
        }
        this.input.jump = this.match.elapsed % 4 < 0.04;
        this.input.ads = true;
        this.benchmark.maxCorpses = Math.max(
          this.benchmark.maxCorpses,
          this.dolls.length,
        );
        if (this.benchmark.remaining === 0) {
          Object.assign(this.benchmark, {
            complete: true,
            shots: p.shots,
            kills: p.kills,
            deaths: p.deaths,
            report: this.frameStats.report(),
          });
          this.lastBenchmark = { ...this.benchmark };
          try {
            localStorage.setItem(
              'krage-last-benchmark',
              JSON.stringify(this.lastBenchmark),
            );
          } catch {}
          this.pause();
          this.dragAim = this.benchmarkPriorDrag;
          this.emit();
        }
      } else if (this.phase === 'playing' && this.match.elapsed > 2)
        this.frameStats.record(realDt);
      if (this.network) this.stepOnline(dt);
      else {
        this.accumulator += dt;
        let count = 0;
        while (this.accumulator >= 1 / 120 && count++ < 12) {
          this.previous.copy(p.pos);
          this.match.step(1 / 120, this.input);
          this.fireQueued = this.jumpQueued = false;
          if (!this.benchmark || this.benchmark.complete)
            this.input.fire = this.mouseDown || this.touch.fire || this.keys.has('Mouse0');
          this.input.jump = this.keys.has('Space') || this.touch.jump;
          if (this.slidePulse) {
            this.slidePulse = false;
            this.input.slide = false;
          }
          this.input.reload = false;
          this.input.weapon = -1;
          this.accumulator -= 1 / 120;
          this.processEvents();
          if (this.match.ended) {
            this.phase = 'ended';
            document.exitPointerLock?.();
            this.onScoreboard(false);
            this.emit();
            break;
          }
        }
      }
      this.updateCamera(dt);
      this.updateEffects(dt);
      this.radarTime += dt;
      if (this.radarTime >= 0.08) {
        this.drawRadar();
        this.radarTime = 0;
      }
    } else if (this.phase === 'menu') {
      this.camera.fov = 49;
      const orbit = Math.sin(this.time * 0.07) * 0.025;
      this.camera.position.set(7 + orbit * 2, 2.7, 19);
      this.camera.lookAt(-3, 2.2, -8);
      this.camera.updateProjectionMatrix();
      const preview = {
        ...this.match.player,
        pos: v(),
        yaw: Math.PI + 0.22 + Math.sin(this.time * 0.32) * 0.045,
        pitch: 0,
        alive: true,
        crouched: false,
        stanceBlend: 0, slideBlend: 0, landingCompression: 0, grounded: true,
        slide: 0,
        viewHeight: 1.67,
        shield: 0,
        vel: v(),
        stride: 0,
        weapon: this.lobbyAvatar.gunId,
        fired: 0,
        reload: 0,
      };
      animateAvatar(this.lobbyAvatar, preview, this.time, dt);
      this.lobbyAvatar.weapon.rotation.x = -0.12 + Math.sin(this.time * 1.2) * 0.025;
      this.lobbyAvatar.weapon.position.y = 1.07 + Math.sin(this.time * 1.2) * 0.008;
      this.lobbyAvatar.joints[4].z -= 0.06;
      this.lobbyAvatar.joints[7].z -= 0.08;
      poseAvatar(this.lobbyAvatar, this.lobbyAvatar.joints);

    }

    if (this.network) {
      this.network.interpolate(dt);
      if (this.phase === 'paused') {
        this.updateCamera(dt);
        this.updateEffects(dt);
      }
    }
    if(this.network)for(const a of this.match.actors){
      const variant=modelVariant(a,this.match.mode,this.operatorVariant);
      if(this.models[a.id]?.group.userData.operator===variant)continue;
      if(this.models[a.id])disposeObject(this.models[a.id].group);
      const model=avatar(a.id===0?COLORS.action:this.match.mode>=2&&a.team===0?COLORS.ally:COLORS.enemy,variant,a.id===0?this.finishVariant:0);
      this.models[a.id]=model;this.scene.add(model.group);this.modelRebuilds++;
    }
    for (let i = 0; i < this.models.length; i++) {
      const a = this.match.actors[i];
      if (i !== 0 && this.phase !== 'menu')
        animateAvatar(this.models[i], a, this.match.elapsed, dt);
      if (i === 0 || this.phase === 'menu')
        this.models[i].group.visible = false;
    }
    this.renderer.info.reset();
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    if (this.phase !== 'menu' && this.match.player.alive) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.gunScene, this.gunCamera);
    }
    if (this.phase === 'menu') {
      const previewElement = this.host.parentElement?.querySelector('.operator-window');
      const preview = previewElement && getComputedStyle(previewElement).visibility !== 'hidden' ? previewElement.getBoundingClientRect() : undefined;
      const host = this.host.getBoundingClientRect();
      if (preview && preview.width > 0 && preview.height > 0) {
        const x = preview.left - host.left,
          y = host.height - (preview.bottom - host.top);
        this.renderer.autoClear = false;
        this.renderer.setViewport(x, y, preview.width, preview.height);
        this.renderer.setScissor(x, y, preview.width, preview.height);
        this.renderer.setScissorTest(true);
        this.renderer.clearDepth();
        this.lobbyCamera.aspect = preview.width / preview.height;
        this.lobbyCamera.updateProjectionMatrix();
        this.renderer.render(this.lobbyScene, this.lobbyCamera);
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(0, 0, host.width, host.height);
      }
    }
    this.renderCalls = this.renderer.info.render.calls;
    this.renderTriangles = this.renderer.info.render.triangles;
    if (this.benchmark && !this.benchmark.complete) {
      this.benchmark.drawCalls = Math.max(
        this.benchmark.drawCalls,
        this.renderCalls,
      );
      this.benchmark.triangles = Math.max(
        this.benchmark.triangles,
        this.renderTriangles,
      );
    }
    if (now - this.lastHud > 100) {
      this.emit();
      this.lastHud = now;
    }
  };
  updateCamera(dt: number) {
    const p = this.match.player;
    const weaponView = this.network?.feedback.state ?? p;
    // Render the same eye origin used by hitscan. No vertical lag while jumping or crouching.
    syncView(this.camera, p);
    if (this.network && p.alive) {
      this.camera.rotation.x = clamp(p.pitch + weaponView.recoilPitch - p.recoilPitch, -1.48, 1.48);
      this.camera.rotation.y = p.yaw + weaponView.recoilYaw - p.recoilYaw;
    }
    if (!p.alive) this.camera.position.y = p.pos.y + 0.7;
    const aim = this.input.ads && weaponView.weapon !== 3 ? 1 : 0;
    this.adsLerp = T.MathUtils.damp(this.adsLerp, aim, 18, dt);
    const speed = Math.hypot(p.vel.x, p.vel.z);
    const motion = cameraMotion(p, this.adsLerp, this.settings.cameraMotion ?? 0.65, this.time);
    this.cameraRoll = T.MathUtils.damp(this.cameraRoll, p.alive ? motion.roll : 0, 12, dt);
    this.camera.rotation.z = this.cameraRoll;
    const fov = this.settings.fov + motion.fov - this.adsLerp * 23;
    this.camera.fov = T.MathUtils.damp(this.camera.fov, fov, 14, dt);
    this.camera.updateProjectionMatrix();
    const equip = equipPose(weaponView);
    if (this.gun.userData.weapon !== equip.weapon) {
      if (weaponView.weapon !== 3) this.lastWeapon = weaponView.weapon;
      this.gun.remove(this.flash);
      this.gun.removeFromParent();
      this.gun = this.viewWeapons[equip.weapon];
      this.gunScene.add(this.gun);
      this.gun.add(this.flash);
      this.flash.position.z = equip.weapon === 0 ? -0.73 : -0.98;
    }
    this.recoil = Math.max(0, this.recoil - dt * 2.8);
    this.gunKick = T.MathUtils.damp(this.gunKick, 0, 18, dt);
    const bob =
      Math.sin(p.stride * 3.5) *
      Math.min(speed * 0.0015, 0.011) *
      (p.grounded ? 1 : 0) *
      (1 - this.adsLerp * 0.8);
    const pose = weaponPose(weaponView),
      reload = pose.lower;
    if (
      pose.phase !== this.reloadPhase &&
      ['open', 'feed', 'close'].includes(pose.phase)
    )
      this.audio.reloadPhase(pose.phase, weaponView.weapon);
    this.reloadPhase = pose.phase;
    this.landing = T.MathUtils.damp(this.landing, 0, 16, dt);
    this.swayX = T.MathUtils.damp(this.swayX, 0, 12, dt);
    this.swayY = T.MathUtils.damp(this.swayY, 0, 12, dt);
    this.gun.position.set(
      T.MathUtils.lerp(0.28, 0, this.adsLerp) + bob - this.swayX,
      -0.28 - Math.abs(bob) * 0.65 - this.landing + this.swayY - reload * 0.25,
      -0.4 + this.gunKick * 0.18,
    );
    this.gun.rotation.set(
      this.gunKick * 0.16 - reload * 0.6,
      -this.swayX * 0.4 + this.gunKick * (weaponView.weapon===0?0.018:weaponView.weapon===1?-0.028:0.008),
      -reload * 0.7 + (-(p.slideBlend ?? 0) * 0.12) + bob * 0.5,
    );
    // Raise the sights to the center of the view in ADS.
    this.gun.position.y = T.MathUtils.lerp(
      this.gun.position.y,
      -0.184,
      this.adsLerp * (1 - equip.lower),
    );
    this.gun.position.y -= equip.lower * 0.62;
    this.gun.position.x += equip.lower * 0.13;
    this.gun.rotation.z -= equip.lower * 0.22;
    this.gun.rotation.x -= equip.lower * 0.3;
    const magazine = this.gun.getObjectByName('reload-magazine');
    if (magazine) {
      magazine.position.set(-pose.magazine * 0.055, -pose.magazine * 0.32, pose.magazine * 0.07);
      magazine.rotation.x = -pose.magazine * 0.3;
    }
    const support = this.gun.getObjectByName('support-hand');
    if (support) {
      support.position.set(reload * 0.13, -reload * 0.17, reload * 0.27);
      support.rotation.z = reload * 0.25;
    }
    const hinge = this.gun.getObjectByName('barrel-hinge');
    if (hinge) hinge.rotation.x = -pose.hinge * 0.65;
    for (const name of ['shell-left','shell-right']) {
      const shell = this.gun.getObjectByName(name);
      if (shell) shell.position.z = -0.015 + pose.magazine * 0.16;
    }
    const bolt = this.gun.getObjectByName('bolt');
    if (bolt)
      bolt.position.z = 0.025 - (weaponView.fired > 0.05 ? 0.05 : pose.bolt * 0.07);
    this.flash.visible = weaponView.fired > 0.08 && weaponView.weapon !== 3 && weaponView.equip === 0;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.set(weaponView.weapon===2?1.65:weaponView.weapon===0?0.7:1,weaponView.weapon===2?0.8:weaponView.weapon===0?0.7:1.25,1);
    if (weaponView.weapon === 3 && weaponView.fired > 0) {
      const attack=weaponView.edgeAttack ?? 'slash', spec=EDGE_ATTACKS[attack];
      const t=clamp(1-weaponView.fired/spec.duration,0,1);
      const contact=spec.contact/spec.duration;
      const swing=t<contact ? Math.sin(t/contact*Math.PI/2) : Math.pow(1-(t-contact)/(1-contact),2);
      if (attack === 'stab') {
        this.gun.position.z-=swing*0.48; this.gun.position.x-=swing*0.08;
        this.gun.rotation.x+=swing*0.22;
      } else {
        const side=weaponView.edgeSide || 1;
        this.gun.position.x+=side*swing*0.4;
        this.gun.position.y+=swing*0.06;
        this.gun.rotation.z+=side*swing*1.35;
        this.gun.rotation.y+=side*swing*0.6;
        this.gun.position.z-=swing*0.16;
      }
    }
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);
    this.killFlash = Math.max(0, this.killFlash - dt);
    this.crossSpread = T.MathUtils.damp(
      this.crossSpread,
      speed * 0.5 + this.gunKick * 20,
      14,
      dt,
    );
    if (this.hud) {
      this.hud.style.setProperty('--damage', String(this.damageFlash));
      this.hud.style.setProperty(
        '--hit',
        String(Math.min(1, this.hitFlash * 10)),
      );
      const spread = shotSpread(weaponView, this.input.ads);
      const radius = Math.tan(spread) / Math.tan(this.camera.fov * Math.PI / 360) * this.host.clientHeight / 2;
      this.hud.style.setProperty('--shotgun-radius', `${Math.max(10, radius)}px`);
      this.hud.style.setProperty('--cross-gap', `${Math.max(3, radius * 0.4) + this.crossSpread}px`);
      this.hud.style.setProperty('--cross-color', this.settings.crosshair);
      this.hud.style.setProperty(
        '--cross-opacity',
        p.alive && weaponView.reload === 0 && this.adsLerp < 0.85 ? '1' : '0',
      );
    }
    if (p.grounded && speed > 1.3 && p.alive && p.slide === 0) {
      this.footTime += speed * dt;
      if (this.footTime >= 1.65) {
        this.audio.step(this.surfaceAt(p.pos), p.crouched);
        this.footTime = 0;
      }
    } else this.footTime = 0;
    for (const actor of this.match.actors) {
      if (!actor.bot || !actor.alive || !actor.grounded || actor.slide > 0)
        continue;
      const stride = Math.floor(actor.stride / 1.65);
      if (this.botFootsteps.get(actor.id) !== stride) {
        this.botFootsteps.set(actor.id, stride);
        const spatial = this.soundPosition(actor.pos);
        if (spatial.distance < 16 && Math.hypot(actor.vel.x, actor.vel.z) > 1.3)
          this.audio.step(
            this.surfaceAt(actor.pos),
            actor.crouched,
            spatial.pan,
            Math.max(0, 1 - spatial.distance / 16) * 0.7,
          );
      }
    }
  }
  surfaceAt(pos: Vec): 'metal' | 'stone' {
    const metal = this.match.map.blocks.some(
      (b) =>
        ['platform', 'bridge', 'step', 'tank', 'server'].includes(
          b.kind ?? '',
        ) &&
        Math.abs(pos.x - b.x) <= b.w / 2 &&
        Math.abs(pos.z - b.z) <= b.d / 2 &&
        Math.abs(pos.y - (b.y + b.h / 2)) < 0.16,
    );
    return metal ? 'metal' : 'stone';
  }
  soundPosition(pos: Vec) {
    const p = this.match.player,
      dx = pos.x - p.pos.x,
      dz = pos.z - p.pos.z,
      distance = Math.hypot(dx, dz);
    return {
      distance,
      pan: clamp(
        (Math.cos(p.yaw) * dx - Math.sin(p.yaw) * dz) / Math.max(1, distance),
        -1,
        1,
      ),
    };
  }
  processEvents() {
    const events = this.match.events.splice(0);
    let ownShot = false, ownHitSound = false;
    const played = new Set<number>();
    const impacted = new Set<number>();
    for (const e of events) {
      const predicted = e.actor === 0 && this.network?.feedback.confirmed(e);
      if (e.type === 'melee-contact' && e.end && e.surface !== 'miss') {
        const spatial=this.soundPosition(e.end);
        if (spatial.distance<24) this.audio.bladeContact(e.surface === 'actor',e.attack === 'stab',spatial.pan,Math.max(0,1-spatial.distance/24));
        if (e.surface === 'world') this.addSpark(e.end,3,'#dab989');
        if (e.actor === 0) this.gunKick=Math.max(this.gunKick,0.12);
      }
      if (e.type === 'shot' && e.pos && e.end) {
        if (e.actor === 0 && !ownShot && !predicted) {
          ownShot = true;
          const gun = GUNS[this.match.player.weapon];
          if (e.weapon !== 3) this.gunKick = Math.min(1, this.gunKick + gun.recoil * 15);
        }
        if (!played.has(e.actor) && !predicted)
          this.audio.shot(
            e.weapon!,
            e.pos,
            eye(this.match.player),
            this.match.player.yaw,
            e.actor === 0,
            e.attack,
          );
        played.add(e.actor);

        if (e.weapon !== 3) this.addTrace(e);
        if (e.weapon !== 3 && e.surface === 'world') {
          this.addSpark(e.end, 3, '#e2ba7c');
          this.addMark(e);
          if (!impacted.has(e.actor)) {
            impacted.add(e.actor);
            const spatial = this.soundPosition(e.end);
            if (spatial.distance < 24) {
              const metal = this.match.map.blocks.some(
                (b) =>
                  [
                    'platform',
                    'bridge',
                    'step',
                    'tank',
                    'server',
                    'pipe',
                  ].includes(b.kind ?? '') &&
                  Math.abs(e.end!.x - b.x) <= b.w / 2 + 0.05 &&
                  Math.abs(e.end!.z - b.z) <= b.d / 2 + 0.05 &&
                  Math.abs(e.end!.y - b.y) <= b.h / 2 + 0.05,
              );
              this.audio.impact(metal, spatial.pan, 1 - spatial.distance / 24);
            }
          }
        }
        if (e.weapon !== 3 && e.surface === 'actor')
          this.addSpark(e.end, 2, '#a9c6ce');
      }
      if (e.type === 'hit') {
        if (e.actor === 0) {
          this.hitFlash = e.head ? 0.22 : 0.15;
          this.hud?.style.setProperty(
            '--hit-color',
            e.head ? '#ffca76' : '#e8f1dc',
          );
          if(!ownHitSound){this.audio.hit(events.some(hit=>hit.type==='hit'&&hit.actor===0&&hit.head));ownHitSound=true;}
        }
        if (e.target === 0) {
          const attacker = this.match.actors[e.actor];
          this.damageAngle =
            Math.atan2(
              attacker.pos.x - this.match.player.pos.x,
              -(attacker.pos.z - this.match.player.pos.z),
            ) + this.match.player.yaw;
          this.hud?.style.setProperty(
            '--damage-angle',
            `${this.damageAngle}rad`,
          );
          this.damageFlash = Math.min(0.8, this.damageFlash + 0.26);
          this.audio.burst(0.08, 0.1, 600);
        }
      }
      if (e.type === 'kill') {
        const killer = this.match.actors[e.actor],
          victim = this.match.actors[e.target!];
        this.feed.unshift({
          id: ++this.eventId,
          killer: killer.name,
          victim: victim.name,
          weapon: e.weapon!,
          head: !!e.head,
          own: e.actor === 0 || e.target === 0,
          time: this.match.elapsed,
        });
        this.feed = this.feed.slice(0, 5);
        this.onFeed([...this.feed]);
        if (e.actor === 0) {

          const now = this.match.elapsed;
          this.comboCount = now >= this.lastFragTime && now - this.lastFragTime <= 4 ? this.comboCount + 1 : 1;
          this.lastFragTime = now;
          if(e.weapon===3)this.audio.edgeKill();else this.audio.kill(this.comboCount);
          const combo = this.comboCount >= 4 ? `${this.comboCount}× MULTIKILL` : this.comboCount === 3 ? '3× COMBO' : this.comboCount === 2 ? '2× COMBO' : '';
          const title = combo || (e.head ? 'HEADSHOT' : e.weapon === 3 ? (e.attack === 'stab' ? 'SKEWERED' : 'CUTTHROAT') : killer.streak >= 5 ? 'UNSTOPPABLE' : killer.streak >= 3 ? 'ON FIRE' : 'ELIMINATED');
          this.onFrag(`${title}${combo && e.head ? ' · HEADSHOT' : ''} +${e.head ? 150 : 100}`);
          this.killFlash = 1.5;
        }
        this.addDoll(victim.id, killer.pos, e.weapon ?? 1, e.attack, killer.edgeSide ?? 1);
        if (victim.id === 0) {
          this.lastDeath = {
            killer: killer.name,
            weapon: e.weapon ?? 1,
            head: !!e.head,
          };
          this.phase = 'spawning';
          this.keys.clear();
          this.crouchControl.reset();
          this.slidePulse = false;
          this.mouseDown = false;
          this.fireQueued = this.jumpQueued = false;
          this.ads = false;
          this.touch = emptyInput();
          this.input = emptyInput();
          this.onScoreboard(false);
          if (document.pointerLockElement === this.renderer.domElement)
            document.exitPointerLock();
          this.emit();
        }
      }
      if (e.type === 'equip' && e.actor === 0 && !predicted) this.audio.equip(e.weapon ?? 1);
      if (e.type === 'end') {
        const report = matchReport(
          this.match.mode,
          this.match.actors,
          this.match.teams,
        );
        this.audio.result(report.outcome === 'victory');
        const player = this.match.player;
        this.onMatchComplete({
          id: this.roundId,
          seconds: this.match.elapsed,
          eligible:
            !this.network &&
            !this.benchmark &&
            this.match.difficulty !== 'dummy' &&
            this.match.actors.length > 1,
          kills: player.kills,
          headshots: player.headshots,
          meleeKills: player.meleeKills,
          matches: 1,
          wins: report.outcome === 'victory' ? 1 : 0,
        });
      }
      if (e.type === 'reload' && e.actor === 0 && !predicted)
        this.audio.reload(e.weapon ?? 1);
      if (e.type === 'land' && e.actor === 0) {
        this.landing = Math.min(0.09, (e.damage ?? 0) * 0.008);
        this.audio.land(
          e.damage ?? 4,
          this.surfaceAt(this.match.player.pos) === 'metal',
        );
      }
      if (e.type === 'jump' && e.actor === 0) this.audio.jump();
      if (e.type === 'slide' && e.actor === 0)
        this.audio.slide(this.surfaceAt(this.match.player.pos));
      if (e.type === 'respawn' && e.actor === 0) {
        this.audio.spawn();
        this.previous.copy(this.match.player.pos);
        this.camera.position.copy(eye(this.match.player));
        this.damageFlash = 0;
        this.mouseDown = false;
        this.fireQueued = this.jumpQueued = false;
      }
    }
    // React HUD updates are batched to the regular cadence; kill/hit effects stay immediate.
    if (events.some((e) => e.type === 'kill' || e.type === 'respawn'))
      this.emit();
    const filtered = this.feed.filter((f) => this.match.elapsed - f.time < 6);
    if (filtered.length !== this.feed.length) {
      this.feed = filtered;
      this.onFeed([...this.feed]);
    }
  }
  addTrace(e: GameEvent) {
    if (this.traces.length >= 35) {
      const old = this.traces.shift()!;
      disposeObject(old.mesh);
    }
    const start = new T.Vector3(e.pos!.x, e.pos!.y, e.pos!.z);
    const end = new T.Vector3(e.end!.x, e.end!.y, e.end!.z);
    const profile=TRACER_PROFILES[e.weapon ?? 1];
    const shooter=this.match.actors[e.actor];
    if(shooter&&start.distanceTo(end)>0.8){
      start.x+=Math.cos(shooter.yaw)*0.16-Math.sin(shooter.yaw)*0.35;
      start.z-=Math.sin(shooter.yaw)*0.16+Math.cos(shooter.yaw)*0.35;
      start.y-=0.14;
    }
    start.lerp(
      end,
      Math.min(0.06, 0.5 / Math.max(0.01, start.distanceTo(end))),
    );
    const delta = end.clone().sub(start),
      length = delta.length();
    const mesh = new T.Mesh(
      new T.CylinderGeometry(profile.width*0.2, profile.width, 1, 5),
      new T.MeshBasicMaterial({
        color: profile.color,
        depthWrite: false,
        transparent: true,
        opacity: 0.55,
      }),
    );
    mesh.position.copy(start).addScaledVector(delta, 0.5);
    mesh.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      delta.normalize(),
    );
    this.scene.add(mesh);
    mesh.scale.y = Math.min(1.8, length);
    mesh.position.copy(start);
    this.traces.push({
      mesh,
      speed: profile.speed, length: profile.length,
      life: length / profile.speed + 0.025,
      start,
      direction: delta,
      distance: length,
      age: 0,
    });
  }
  addSpark(pos: Vec, n: number, color: string) {
    if (this.settings.quality === 'potato') return;
    for (let i = 0; i < n; i++) {
      if (this.sparks.length >= 60) {
        const old = this.sparks.shift()!;
        disposeObject(old.mesh);
      }
      const mesh = new T.Mesh(
        new T.BoxGeometry(0.045, 0.045, 0.045),
        material(color),
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        velocity: new T.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 3,
          (Math.random() - 0.5) * 3,
        ),
        life: 0.42,
        max: 0.42,
      });
    }
  }
  addDoll(id: number, attacker: Vec, weapon = 1, attack?: string, side=1) {
    if (this.settings.quality === 'potato') return;
    while (this.dolls.length >= 5) disposeObject(this.dolls.shift()!.group);
    const a = this.match.actors[id];
    const model = cloneAvatar(this.models[id]);
    // Body pose is sampled from the death tick; the hidden carried weapon need not be rebuilt.
    animateAvatar(
      model,
      { ...a, alive: true, weapon: model.gunId, reload: 0 },
      this.match.elapsed,
    );
    const points = model.joints.map((p) =>
      p
        .clone()
        .applyAxisAngle(new T.Vector3(0, 1, 0), a.yaw)
        .add(new T.Vector3().copy(a.pos)),
    );
    model.group.position.set(0, 0, 0);
    model.group.rotation.set(0, 0, 0);
    model.weapon.visible = model.shadow.visible = model.ring.visible = false;
    const impulse = new T.Vector3(
      a.pos.x - attacker.x,
      0.12,
      a.pos.z - attacker.z,
    )
      .normalize()
      .multiplyScalar(weapon === 2 ? 0.05 : weapon === 3 ? 0.027 : 0.029);
    if (weapon === 3 && attack === 'slash') {
      const tangent=new T.Vector3(impulse.z,0,-impulse.x).normalize().multiplyScalar(side*0.016);
      impulse.add(tangent);
    }
    impulse.add(
      new T.Vector3(a.vel.x, a.vel.y, a.vel.z).multiplyScalar(1 / 60),
    );
    const articulation = this.models[id].group.userData.locomotion?.jointVelocity as T.Vector3[] | undefined;
    const old = points.map((p, i) => {
      const previous = p.clone().sub(impulse);
      if (articulation?.[i]) previous.addScaledVector(articulation[i].clone().applyAxisAngle(new T.Vector3(0,1,0),a.yaw), -1/60);
      return previous;
    });
    const links = RIG_LINKS.map(([i, j]) => [
      i,
      j,
      points[i].distanceTo(points[j]),
    ]);
    const pairs = [
      [1, 3],
      [1, 6],
      [2, 9],
      [2, 12],
      [3, 6],
      [9, 12],
      [0, 2],
      [3, 2],
      [6, 2],
      [4, 8],
      [7, 5],
    ];
    const constraints = [
      ...links,
      ...pairs.map(([i, j], index) => [
        i,
        j,
        points[i].distanceTo(points[j]),
        index > 6 ? 0.14 : 0.8,
      ]),
    ];
    poseAvatar(model, points, a.yaw);
    this.scene.add(model.group);
    this.dolls.push({
      group: model.group,
      model,
      yaw: a.yaw,
      points,
      old,
      links,
      constraints,
      life: 6,
      accumulator: 0,
      quiet: 0,
      sleeping: false,
    });
  }
  addMark(e: GameEvent) {
    if (!e.normal || !e.end) return;
    while (this.marks.length >= (this.settings.quality === 'potato' ? 12 : 48))
      disposeObject(this.marks.shift()!.mesh);
    const mesh = new T.Mesh(
      new T.CircleGeometry(e.weapon === 2 ? 0.037 : 0.052, 9),
      new T.MeshBasicMaterial({
        color: '#101621',
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    mesh.position
      .copy(e.end)
      .addScaledVector(new T.Vector3().copy(e.normal), 0.006);
    mesh.quaternion.setFromUnitVectors(
      new T.Vector3(0, 0, 1),
      new T.Vector3().copy(e.normal),
    );
    const rim = new T.Mesh(
      new T.RingGeometry(
        e.weapon === 2 ? 0.03 : 0.043,
        e.weapon === 2 ? 0.05 : 0.069,
        9,
      ),
      new T.MeshBasicMaterial({
        color: '#aebac8',
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    mesh.add(rim);
    this.scene.add(mesh);
    this.marks.push({ mesh, life: 10 });
  }
  updateEffects(dt: number) {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mark = this.marks[i];
      mark.life -= dt;
      (mark.mesh.material as T.MeshBasicMaterial).opacity = Math.min(
        0.7,
        mark.life * 0.7,
      );
      if (mark.life <= 0) {
        disposeObject(mark.mesh);
        this.marks.splice(i, 1);
      }
    }
    for (let i = this.traces.length - 1; i >= 0; i--) {
      const t = this.traces[i];
      t.life -= dt;
      t.age += dt;
      const head = Math.min(t.distance, t.age * t.speed),
        tail = Math.max(0, head - t.length);
      t.mesh.position
        .copy(t.start)
        .addScaledVector(t.direction, (head + tail) * 0.5);
      t.mesh.scale.y = Math.max(0.001, head - tail);
      (t.mesh.material as T.MeshBasicMaterial).opacity = Math.min(
        0.6,
        Math.max(0, t.life * 24),
      );
      if (t.life <= 0) {
        disposeObject(t.mesh);
        this.traces.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        disposeObject(s.mesh);
        this.sparks.splice(i, 1);
        continue;
      }
      s.velocity.y -= 18 * dt;
      s.mesh.position.addScaledVector(s.velocity, dt);
      s.mesh.rotation.x += dt * 9;
      if (s.mesh.position.y < 0.03) {
        s.mesh.position.y = 0.03;
        s.velocity.y = Math.abs(s.velocity.y) * 0.18;
        s.velocity.x *= 0.7;
        s.velocity.z *= 0.7;
      }
    }
    for (let k = this.dolls.length - 1; k >= 0; k--) {
      const d = this.dolls[k];
      d.life -= dt;
      if (d.life <= 0) {
        disposeObject(d.group);
        this.dolls.splice(k, 1);
        continue;
      }
      if (!d.sleeping) {
        d.accumulator += dt;
        const steps = Math.min(4, Math.floor(d.accumulator * 60));
        d.accumulator -= steps / 60;
        for (let sub = 0; sub < steps; sub++) {
          const energy = stepRagdoll(
            d.points,
            d.old,
            d.constraints,
            this.match.map.blocks,
          );
          d.quiet = energy < 0.000002 ? d.quiet + 1 / 60 : 0;
          if (d.quiet > 0.6) {
            d.sleeping = true;
            break;
          }
        }
        poseAvatar(d.model, d.points, d.yaw);
      }
    }
  }
  drawRadar() {
    if (!this.minimap) return;
    const c = this.minimap.getContext('2d');
    if (!c) return;
    const size = 150,
      map = this.match.map,
      scale = 130 / Math.max(map.width, map.depth);
    c.clearRect(0, 0, size, size);
    c.fillStyle = '#122426d9';
    c.fillRect(0, 0, size, size);
    const X = (x: number) => 75 + x * scale,
      Z = (z: number) => 75 + z * scale;
    c.strokeStyle = '#ffffff0e';
    for (let n = 15; n < 150; n += 20) {
      c.beginPath();
      c.moveTo(n, 0);
      c.lineTo(n, 150);
      c.moveTo(0, n);
      c.lineTo(150, n);
      c.stroke();
    }
    for (const b of map.blocks) {
      c.fillStyle = b.kind === 'crate' ? '#788678' : '#64786c';
      c.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * scale, b.d * scale);
    }
    for (const a of this.match.actors) {
      if (!a.alive) continue;
      if (a.id !== 0 && this.match.enemy(this.match.player, a) && a.fired <= 0)
        continue;
      c.fillStyle =
        a.id === 0
          ? '#fff3d6'
          : this.match.enemy(this.match.player, a)
            ? '#ff764e'
            : '#78d4d5';
      c.beginPath();
      c.arc(X(a.pos.x), Z(a.pos.z), a.id === 0 ? 3.5 : 3, 0, Math.PI * 2);
      c.fill();
      if (a.id === 0) {
        c.strokeStyle = '#fff3d6';
        c.beginPath();
        c.moveTo(X(a.pos.x), Z(a.pos.z));
        c.lineTo(
          X(a.pos.x - Math.sin(a.yaw) * 2.2),
          Z(a.pos.z - Math.cos(a.yaw) * 2.2),
        );
        c.stroke();
      }
    }
  }
  emit() {
    const p = this.match.player;
    const weaponView = this.network?.feedback.state ?? p;
    this.snap = {
      phase: this.phase,
      mode: this.match.mode,
      network: this.connection ? { ...this.connection } : null,
      hp: Math.ceil(p.hp),
      ammo: weaponView.ammo[weaponView.weapon],
      weapon: weaponView.weapon,
      primary: p.primary,
      reload: weaponView.reload,
      equip: weaponView.equip,
      lastDeath: this.lastDeath,
      time: this.match.time,
      elapsed: this.match.elapsed,
      score: p.kills,
      deaths: p.deaths,
      streak: p.streak,
      speed: Math.hypot(p.vel.x, p.vel.z),
      fps: this.fps,
      frameMs: this.frameMs,
      diagnostics: { drawCalls: this.renderCalls, triangles: this.renderTriangles, modelRebuilds: this.modelRebuilds, pendingInputs: this.network?.history.length ?? 0 },
      crouched: p.crouched || p.slide > 0,
      lastBenchmark: this.lastBenchmark,
      dragAim: this.dragAim,
      captureFailed: this.captureFailed,
      performance: this.frameStats.report(),
      benchmark: this.benchmark ? { ...this.benchmark } : null,
      shield: p.shield,
      respawn: p.respawn,
      alive: p.alive,
      teams: [...this.match.teams],
      winner: this.match.winner,
      leaderboard: this.match.actors
        .filter((a) => !this.network || this.network.active.has(a.id))
        .map((a) => ({
          id: a.id,
          name: a.name,
          bot: a.bot,
          team: a.team,
          kills: a.kills,
          deaths: a.deaths,
          score: a.score,
        }))
        .sort((a, b) => b.kills - a.kills || b.score - a.score),
      shots: p.shots,
      hits: p.hits,
      headshots: p.headshots,
      slideCooldown: p.slideCooldown,
      map: this.match.map.name,
    };
    this.onSnapshot(this.snap);
  }
  resetEffects() {
    for (const m of this.marks) disposeObject(m.mesh);
    this.marks = [];
    this.traces.forEach((t) => disposeObject(t.mesh));
    this.sparks.forEach((s) => disposeObject(s.mesh));
    this.dolls.forEach((d) => disposeObject(d.group));
    this.traces = [];
    this.sparks = [];
    this.dolls = [];
    this.damageFlash = 0;
    this.hitFlash = 0;
    this.killFlash = 0;
  }
  dispose() {
    this.disconnectRoom();
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.cleanup.forEach((fn) => fn());
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock();
    this.audio.dispose();
    this.resetEffects();
    disposeObject(this.scene);
    this.gun.remove(this.flash);
    for (const weapon of this.viewWeapons) disposeObject(weapon);
    disposeObject(this.flash);
    disposeObject(this.gunScene);
    disposeObject(this.lobbyScene);
    disposeMaterials();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
