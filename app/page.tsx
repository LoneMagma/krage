'use client';
import {MapPicker} from '@/components/game/map-picker';
import {PlayerAvatar} from '@/components/game/player-avatar';
import {enterGameDisplay} from '@/lib/game/mobile-display';

import { matchReward } from '@/lib/game/progression';
import { ArenaChat } from '@/components/game/arena-chat';
import { GameChoice } from '@/components/game/game-choice';
import { AccountPanel } from '@/components/game/account-panel';
import {accountsConfigured} from '@/lib/account/client';
import { useAccount } from '@/lib/account/use-account';
import { type RoomClient, defaultRoomURL } from '@/lib/game/room-client';
import Link from 'next/link';
import {TouchControls} from '@/components/game/touch-controls';
import { useCallback, useEffect, useLayoutEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Crosshair,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  MousePointer2,
  RotateCcw,
  Maximize,
  Pause,
  MoveUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LobbySection } from '@/components/game/lobby-section';
import { MapDiagram } from '@/components/game/map-diagram';
import {
  DEFAULT_SETTINGS,
  GUNS,
  makeMap,
  type Settings,
  type Mode,
} from '@/lib/game/core';
import {
  EMPTY_SNAPSHOT,
  type Arena,
  type Feed,
  type Snapshot,
} from '@/lib/game/engine';

import { RoomPanel } from '@/components/game/room-panel';
import { KrCredit } from '@/components/game/identity';
import { Challenges } from '@/components/game/challenges';
import { Locker } from '@/components/game/locker';
import {
  CATALOG,
  purchase,
  OPERATORS,
  claimableCount,
  newProfile,
  loadProfile,
  refreshProfile,
  recordMatch,
  type Profile,
  type MatchReceipt,
} from '@/lib/game/progression';
import { KeyBindings } from '@/components/game/key-bindings';
import { weaponFinish } from '@/lib/game/progression';
import { KrageLogo, WeaponGlyph, QualityPreview, CrosshairPreview } from '@/components/game/identity';
import { matchReport } from '@/lib/game/report';
import { BINDABLE_KEYS, keyLabel } from '@/lib/game/controls';

const modes = ['Free for all', '1 v 1', '2 v 2', '3 v 3'];
const maps = [makeMap(0), makeMap(1), makeMap(2), makeMap(3)];
function Scoreboard({ snap, mode }: { snap: Snapshot; mode: number }) {
  return (
    <div className="scoreboard">
      <div className="scoreboard-title">
        <span>SCOREBOARD</span>
        <span>
          {modes[mode]} / {snap.map}
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>PLAYER</th>
            <th>FRAGS</th>
            <th>DEATHS</th>
            <th>POINTS</th>
          </tr>
        </thead>
        <tbody>
          {snap.leaderboard.map((a, i) => (
            <tr key={a.id} className={a.id === 0 ? 'you-row' : ''}>
              <td>
                <span className="rank">{String(i + 1).padStart(2, '0')}</span>
                <i
                  className={
                    mode >= 2 && a.team === 0 ? 'team-dot ally' : 'team-dot'
                  }
                />
                <PlayerAvatar name={a.name}/>{a.name}
                {a.bot && <small>BOT</small>}
              </td>
              <td>{a.kills}</td>
              <td>{a.deaths}</td>
              <td>{a.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function SettingsPanel({
  settings,
  onChange,
  children,
}: {
  children?: React.ReactNode;
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const [category,setCategory]=useState('VIEW');
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <><div className="settings-category-picker"><GameChoice compact aria-label="Settings category" value={category} onChange={setCategory}>{['VIEW','SOUND','MOVEMENT',...(children?['PERFORMANCE']:[])].map(label=><option key={label} value={label}>{label}</option>)}</GameChoice></div>
    <div className="settings-fields" hidden={category==='PERFORMANCE'}>
      <button hidden={category!=='SOUND'} aria-pressed={settings.musicEnabled !== false} onClick={() => update('musicEnabled', settings.musicEnabled === false)}>MUSIC <b>{settings.musicEnabled === false ? 'OFF' : 'ON'}</b></button>
      <button hidden={category!=='SOUND'} aria-pressed={settings.effectsEnabled !== false} onClick={() => update('effectsEnabled', settings.effectsEnabled === false)}>GAME SOUND <b>{settings.effectsEnabled === false ? 'OFF' : 'ON'}</b></button>
      <label hidden={category!=='MOVEMENT'}>
        Camera motion <output>{Math.round((settings.cameraMotion ?? 0.45) * 100)}%</output>
        <input aria-label="Camera motion" type="range" min="0" max="1" step="0.05" value={settings.cameraMotion ?? 0.45} onChange={e => update('cameraMotion', +e.target.value)} />
      </label>
      <label hidden={category!=='MOVEMENT'}>
        Mouse sensitivity <output>{settings.sensitivity.toFixed(2)}</output>
        <input
          aria-label="Mouse sensitivity"
          type="range"
          min="0.2"
          max="2.5"
          step="0.05"
          value={settings.sensitivity}
          onChange={(e) => update('sensitivity', +e.target.value)}
        />
      </label>
      <label hidden={category!=='VIEW'}>
        Field of view <output>{settings.fov}°</output>
        <input
          aria-label="Field of view"
          type="range"
          min="75"
          max="115"
          step="1"
          value={settings.fov}
          onChange={(e) => update('fov', +e.target.value)}
        />
      </label>
      <label hidden={category!=='SOUND'}>
        Sound volume <output>{Math.round(settings.volume * 100)}%</output>
        <input
          aria-label="Sound volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          onInput={(e) => onChange({ ...settings, volume: +e.currentTarget.value, effectsEnabled: +e.currentTarget.value > 0 })}
        />
      </label>
      <fieldset hidden={category!=='MOVEMENT'} className="choice-setting"><legend>Bot difficulty</legend><GameChoice compact
          value={settings.difficulty}
          onChange={(value)=>
            update('difficulty', value as Settings['difficulty'])
          }
        >
          <option value="dummy">Targets</option>
          <option value="casual">Casual</option>
          <option value="normal">Regular</option>
          <option value="hard">Veteran</option>
        </GameChoice>
      </fieldset>
      <fieldset hidden={category!=='VIEW'} className="choice-setting"><legend>Graphics</legend><GameChoice compact
          value={settings.quality}
          className="quality-choice"
          onChange={(value)=>
            update('quality', value as Settings['quality'])
          }
        >
          <option value="potato"><QualityPreview level={0}/><span>Low</span></option>
          <option value="balanced"><QualityPreview level={1}/><span>Balanced</span></option>
          <option value="high"><QualityPreview level={2}/><span>High</span></option>
        </GameChoice>
      </fieldset>

      <fieldset hidden={category!=='MOVEMENT'} className="choice-setting"><legend>Hold crouch</legend><GameChoice compact
          value={settings.crouchKey}
          aria-label="Crouch key"
          onChange={(value)=> {
            const crouchKey = value;
            onChange({
              ...settings,
              crouchKey,
              slideKey:
                crouchKey === settings.slideKey
                  ? settings.crouchKey
                  : settings.slideKey,
            });
          }}
        >
          {BINDABLE_KEYS.map((key) => (
            <option key={key} value={key}>
              {keyLabel(key)}
            </option>
          ))}
        </GameChoice>
      </fieldset>
      <fieldset hidden={category!=='MOVEMENT'} className="choice-setting"><legend>Slide</legend><GameChoice compact
          value={settings.slideKey}
          aria-label="Slide key"
          onChange={(value)=> update('slideKey', value)}
        >
          {BINDABLE_KEYS.filter((key) => key !== settings.crouchKey).map(
            (key) => (
              <option key={key} value={key}>
                {keyLabel(key)}
              </option>
            ),
          )}
        </GameChoice>
      </fieldset>

      <fieldset hidden={category!=='VIEW'} className="choice-setting"><legend>Crosshair</legend><GameChoice compact
          value={settings.crosshair}
          className="crosshair-choice"
          onChange={(value)=> update('crosshair', value)}
        >
          <option value="#eaffdf"><CrosshairPreview color="#eaffdf"/><span>Mint white</span></option>
          <option value="#7bffff"><CrosshairPreview color="#7bffff"/><span>Cyan</span></option>
          <option value="#f9fa6d"><CrosshairPreview color="#f9fa6d"/><span>Lime</span></option>
          <option value="#ff78c5"><CrosshairPreview color="#ff78c5"/><span>Pink</span></option>
        </GameChoice>
      </fieldset>
      <label hidden={category!=='MOVEMENT'} className="check-setting">
        <input
          type="checkbox"
          checked={settings.invertY}
          onChange={(e) => update('invertY', e.target.checked)}
        />{' '}
        Invert vertical look
      </label>
      <Button
        className="secondary-button"
        onClick={() => onChange({ ...DEFAULT_SETTINGS })}
      >
        <RotateCcw size={14} /> Restore defaults
      </Button>
    </div>{category==='PERFORMANCE'&&children}</>
  );
}
export default function Home() {
  const mount = useRef<HTMLDivElement>(null),
    arena = useRef<Arena | null>(null),
    hud = useRef<HTMLDivElement>(null),
    radar = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>(0),
    [map, setMap] = useState(0),
    [bots, setBots] = useState(3),
    [weapon, setWeapon] = useState(1),
    [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [duration,setDuration]=useState(300);
  const [playerName,setPlayerName] = useState('PLAYER');
  const [choicesLoaded, setChoicesLoaded] = useState(false);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [modal, setModal] = useState<
      'settings' | 'controls' | 'loadout' | 'locker' | 'challenges' | 'online' | 'practice' | null
    >(null),
    [snap, setSnap] = useState<Snapshot>({ ...EMPTY_SNAPSHOT }),
    [feed, setFeed] = useState<Feed[]>([]),
    [board, setBoard] = useState(false),
    [inGameChat, setInGameChat] = useState(false),
    [frags, setFrags] = useState<{id:number;message:string}[]>([]),
    [touch, setTouch] = useState(false),
    [operatorShop,setOperatorShop]=useState(false),[touchEditor,setTouchEditor]=useState(false),[resumeTouch,setResumeTouch]=useState(false),[mapChoosing,setMapChoosing]=useState(false),
    [pauseSettings, setPauseSettings] = useState(false);
  const mutationRef=useRef(false);const [accountBusy,setAccountBusy]=useState(false);
  const [profile, setProfile] = useState<Profile>(() => newProfile()),
    [profileLoaded, setProfileLoaded] = useState(false);
  const [reward,setReward]=useState<{id:number;title:string;amount:number}|null>(null);
  const [lastAward,setLastAward]=useState(0);
  const [previewRotation,setPreviewRotation]=useState(0);
  const rotateCharacter=(delta:number)=>{arena.current?.rotateLobby(delta);setPreviewRotation(p=>(p+delta*180/Math.PI+360)%360);};
  const [chatRoom,setChatRoom]=useState<RoomClient|null>(null);
  const account = useAccount(
    ready&&profileLoaded,
    data=>{
      setProfile(data.profile);setPlayerName(data.name);
      setSettings(previous=>{const next={...previous,...data.preferences};arena.current?.setSettings(next);return next;});
    },
    ()=>{arena.current?.lobby();setProfile(newProfile());setPlayerName('PLAYER');setLastAward(0);setSettings(previous=>{const next={...DEFAULT_SETTINGS,quality:previous.quality};arena.current?.setSettings(next);return next;});},
    ()=>{try{setProfile(loadProfile(localStorage.getItem("krage-practice-v1")));setPlayerName(localStorage.getItem("krage-player-name")||"PLAYER");}catch{}},
  );
  const handleMatchComplete=useEffectEvent((receipt:MatchReceipt)=>{
    if(account.active){setLastAward(0);setTimeout(()=>void account.refresh().catch(()=>{}),1500);return;}
    setProfile(p=>recordMatch(p,receipt));setLastAward(receipt.eligible&&receipt.seconds>=30&&receipt.id?matchReward(receipt):0);
  });
  const accountBlocked=account.active&&(!account.connected||account.loading||!!account.decision);
  const cloudAction=async(action:{type:string;id:string;weapon?:number})=>{
    if(mutationRef.current||accountBlocked)return;mutationRef.current=true;setAccountBusy(true);
    const before=profile;
    try{const result=await account.act(action);
      const amount=result.data.profile.balance-before.balance;
      arena.current?.audio.reward();setReward({id:Date.now(),title:action.type==='claim'?'REWARD CLAIMED':action.type==='buy'?'UNLOCKED':'EQUIPPED',amount:Math.max(0,amount)});
    }catch(e){setError(e instanceof Error?e.message:'Save failed');}finally{mutationRef.current=false;setAccountBusy(false);}
  };
  const handleOperatorAction=(event:React.MouseEvent<HTMLButtonElement>)=>{const id=event.currentTarget.dataset.operator!;const owned=profile.owned.includes(id);if(account.active)void cloudAction({type:owned?'equip':'buy',id});else setProfile(p=>owned?{...p,operator:id}:purchase(p,id));};
  const chooseOperator=(direction:number)=>{const owned=OPERATORS.filter(o=>profile.owned.includes(o.id));const id=owned[(owned.findIndex(o=>o.id===profile.operator)+owned.length+direction)%owned.length]?.id;if(!id)return;if(account.active)void cloudAction({type:'equip',id});else setProfile(p=>({...p,operator:id}));};
  const savePlayerName = (name: string) => { setPlayerName(name);account.preferences({name}); try { localStorage.setItem('krage-player-name',name); } catch {} };
  const claimable=claimableCount(profile);
  useEffect(()=>{if(!reward)return;const timer=setTimeout(()=>setReward(null),2300);return()=>clearTimeout(timer);},[reward]);
  const updateProfile=(next:Profile)=>{
    if(next===profile)return;
    const amount=next.balance-profile.balance,newItem=next.owned.find(id=>!profile.owned.includes(id));
    setProfile(next);
    if(amount>0||newItem){arena.current?.audio.reward();setReward({id:Date.now(),title:amount>0?'REWARD CLAIMED':'UNLOCKED',amount});}
    else {arena.current?.audio.equip(weapon);setReward({id:Date.now(),title:'EQUIPPED',amount:0});}
  };
  const fragSequence = useRef(0);
  const soundedFrag = useRef(0);
  useLayoutEffect(() => {
    const latest = frags.at(-1);
    if (!latest || latest.id <= soundedFrag.current) return;
    soundedFrag.current = latest.id;
    arena.current?.audio.kill();
  }, [frags]);
  const fragTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    );
  useEffect(() => {
    let cancelled = false;
    let instance: Arena | undefined;
    let restored = { ...DEFAULT_SETTINGS };
    try {
      const saved = JSON.parse(
        localStorage.getItem('krage-settings-v03') || 'null',
      );
      if (saved) {
        restored = {
          ...DEFAULT_SETTINGS,
          musicEnabled: saved.musicEnabled !== false,
          effectsEnabled: saved.effectsEnabled !== false,
          bindings: saved.bindings && typeof saved.bindings === 'object' ? Object.fromEntries(Object.entries(saved.bindings).filter((entry) => typeof entry[1] === 'string' && /^[A-Za-z][A-Za-z0-9]+$/.test(entry[1]))) as Record<string, string> : {},
          sensitivity: Math.max(
            0.2,
            Math.min(2.5, Number(saved.sensitivity) || 1),
          ),
          fov: Math.max(75, Math.min(115, Number(saved.fov) || 90)),
          volume: Math.max(
            0,
            Math.min(1, Number.isFinite(saved.volume) ? saved.volume : 0.5),
          ),
          quality: ['potato', 'balanced', 'high'].includes(saved.quality)
            ? saved.quality
            : 'balanced',
          difficulty: ['dummy', 'casual', 'normal', 'hard'].includes(
            saved.difficulty,
          )
            ? saved.difficulty
            : 'casual',
          crosshair: ['#eaffdf', '#7bffff', '#f9fa6d', '#ff78c5'].includes(
            saved.crosshair,
          )
            ? saved.crosshair
            : '#eaffdf',
          cameraMotion: Number.isFinite(saved.cameraMotion) ? Math.max(0, Math.min(1, saved.cameraMotion)) : 0.65,
          invertY: !!saved.invertY,
          crouchKey: BINDABLE_KEYS.includes(saved.crouchKey)
            ? saved.crouchKey
            : 'ShiftLeft',
          slideKey:
            BINDABLE_KEYS.includes(saved.slideKey) &&
            saved.slideKey !== saved.crouchKey
              ? saved.slideKey
              : saved.crouchKey === 'KeyC'
                ? 'KeyV'
                : 'KeyC',
        };
      }
    } catch {}
    const coarse = matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    import('@/lib/game/engine')
      .then(({ Arena }) => {
        if (cancelled || !mount.current) return;
        try {
          setSettings(restored);
          try {
            if(!accountsConfigured)setProfile(loadProfile(localStorage.getItem('krage-practice-v1')));
          } catch {
            setProfile(newProfile());
          }
          setProfileLoaded(true);
          setTouch(coarse);
          instance = new Arena(mount.current);
          let wasStaging=false;
          instance.onSnapshot = (snapshot) => {
            const staging=!!snapshot.network?.lobby;
            if(staging&&!wasStaging)setModal('online');
            wasStaging=staging;
            setSnap(snapshot);
            setChatRoom(instance?.roomClient??null);
            if (snapshot.network && snapshot.phase !== 'menu') setModal(null);
            if (snapshot.network?.removed) setModal(null);
          };
          instance.onMatchComplete = receipt=>handleMatchComplete(receipt);
          instance.onFeed = setFeed;
          instance.onError = setError;
          instance.onScoreboard = setBoard;
          instance.onChatOpen = setInGameChat;
          instance.onFrag = (message) => {
            const notice={id:++fragSequence.current,message};
            setFrags(previous=>[...previous.slice(-2),notice]);
            clearTimeout(fragTimer.current);
            fragTimer.current = setTimeout(() => setFrags([]), 1800);
          };
          instance.touchMode = coarse;
          instance.setSettings(restored);
          arena.current = instance;
          try {
            const saved = JSON.parse(localStorage.getItem('krage-lobby') || '{}');
            if ([60,180,300,600].includes(saved.duration)) setDuration(saved.duration);
            if ([0,1,2,3].includes(saved.mode)) setMode(saved.mode);
            if ([0,1,2,3].includes(saved.map)) { setMap(saved.map); instance.setMap(saved.map); }
            if ([0,1,2].includes(saved.weapon)) { setWeapon(saved.weapon); instance.setPrimaryPreview(saved.weapon); }
          } catch {}
          try { if(!accountsConfigured)setPlayerName(localStorage.getItem('krage-player-name') || `Player${Math.floor(1000+Math.random()*9000)}`); } catch {}
          setChoicesLoaded(true);
          setReady(true);
          if (new URLSearchParams(location.search).has('room')) setModal('online');
        } catch (e) {
          setError(
            `The 3D arena could not start. WebGL 2 is required. ${e instanceof Error ? e.message : ''}`,
          );
        }
      })
      .catch(() =>
        setError('The arena could not load. Refresh the page to try again.'),
      );
    return () => {
      cancelled = true;
      clearTimeout(fragTimer.current);
      instance?.dispose();
      arena.current = null;
    };
  }, []);
  useEffect(() => {
    if (arena.current) {
      arena.current.hud = hud.current ?? undefined;
      arena.current.minimap = radar.current;
    }
    if (snap.phase !== 'menu') {
      // The lobby and match reuse the main element; discard its lobby scroll.
      const shell = mount.current?.parentElement;
      shell?.scrollTo(0, 0);
    }
  }, [snap.phase]);
  useEffect(() => {
    let timer:ReturnType<typeof setTimeout>;
    const refresh=()=>{
      if(!account.active)setProfile(p=>refreshProfile(p));
      clearTimeout(timer);
      const now=Date.now();timer=setTimeout(refresh,86400000-now%86400000+50);
    };
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
    return()=>{clearTimeout(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
  }, [account.active]);
  useEffect(() => {
    if (profileLoaded&&!account.active) {
      try {
        localStorage.setItem('krage-practice-v1', JSON.stringify(profile));
      } catch {}
    }
  }, [profile, profileLoaded, account.active]);
  useEffect(() => {
    if (ready)
      arena.current?.setCosmetics(
        CATALOG.find((i) => i.id === profile.operator)?.variant ?? 0,
        CATALOG.find((i) => i.id === profile.finish)?.variant ?? 0,
        [0, 1, 2, 3].map((id) => weaponFinish(profile, id)),
      );
  }, [profile, ready]);
  useEffect(() => {
    if (choicesLoaded) try { localStorage.setItem('krage-lobby', JSON.stringify({mode,map,weapon,duration})); } catch {}
  }, [choicesLoaded,mode,map,weapon,duration]);
  const lobbyMusic = useRef<HTMLAudioElement | null>(null);
  const musicState = useRef({ menu: snap.phase === 'menu', volume: settings.musicEnabled === false ? 0 : settings.volume });
  useEffect(() => { musicState.current = { menu: snap.phase === 'menu', volume: settings.musicEnabled === false ? 0 : settings.volume }; }, [snap.phase, settings.volume, settings.musicEnabled]);
  useEffect(() => {
    const music = new Audio('/audio/lobby.mp3');
    music.loop = true;
    music.preload = 'none';
    music.volume = 0.2;
    lobbyMusic.current = music;
    const interact = (event: Event) => {
      const audio = arena.current?.audio;
      audio?.start();
      if (event.type === 'pointerdown' && (event.target as Element)?.closest('button, select, summary')) audio?.click();
      music.dataset.unlocked='true';
      if (music.paused && musicState.current.menu && musicState.current.volume > 0) void music.play().catch(() => {});
    };
    document.addEventListener('pointerdown', interact);
    document.addEventListener('keydown', interact);
    return () => { music.pause(); music.src = ''; lobbyMusic.current = null; document.removeEventListener('pointerdown', interact); document.removeEventListener('keydown', interact); };
  }, []);
  useEffect(() => {
    const music = lobbyMusic.current;
    if (!music) return;
    music.volume = Math.min(1, 0.4 * settings.volume);
    if (snap.phase !== 'menu' || settings.musicEnabled === false || settings.volume === 0) music.pause();
    else if(music.paused&&music.dataset.unlocked==='true')void music.play().catch(() => {});
  }, [snap.phase, settings.volume, settings.musicEnabled]);
  const updateSettings = (s: Settings) => {
    const preferences=Object.fromEntries(Object.entries(s).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(settings[k as keyof Settings])));
    account.preferences({preferences});
    setSettings(s);
    arena.current?.setSettings(s);
    try {
      localStorage.setItem('krage-settings-v03', JSON.stringify(s));
    } catch {}
  };
  const copyInvite = async () => {
    if (!snap.network?.room) return;
    const link = new URL(location.href); link.search = ''; link.searchParams.set('room', snap.network.room);
    try { await navigator.clipboard.writeText(link.href); } catch { setError(link.href); }
  };
  const enterFullscreen = () => {void enterGameDisplay();};
  const start = () => {
    enterFullscreen();
    setError('');
    setFrags([]);
    clearTimeout(fragTimer.current);
    setModal(null);
    setBoard(false);
    setPauseSettings(false);
    arena.current?.start(mode, map, bots, settings.difficulty, weapon);
    if(arena.current){arena.current.match.time=arena.current.match.duration=duration;arena.current.match.player.name=playerName;}
  };
  const selectMap = (id: number) => {
    setMap(id);
    arena.current?.setMap(id);
  };
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.defaultPrevented||(e.target as HTMLElement)?.closest('dialog[open]'))return;
      if((modal==='online'||modal==='practice')&&e.code==='Escape'){e.preventDefault();setModal(null);return;}
      if(e.repeat||(e.target as HTMLElement)?.closest('input,textarea,[contenteditable=true]'))return;
      if(modal==='loadout'){
        const i=['Digit1','Digit2','Digit3'].indexOf(e.code);
        if(i>=0){e.preventDefault();setWeapon(i);arena.current?.setPrimaryPreview(i);}
        if(e.code==='Escape'){e.preventDefault();setModal(null);}
      }
      if(snap.phase==='ended'){
        if(e.code==='Tab'){e.preventDefault();setBoard(b=>!b);}
        if(e.code==='Escape'){e.preventDefault();arena.current?.lobby();}
        if(e.code==='Enter'&&!snap.network){e.preventDefault();start();}
      }
    };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const inGame = snap.phase !== 'menu';
  const activeMode = inGame ? snap.mode : mode;
  const result = matchReport(activeMode, snap.leaderboard, snap.teams);
  const totalSeconds = Math.ceil(snap.time),
    minutes = Math.floor(totalSeconds / 60),
    seconds = totalSeconds % 60;
  const teamGame = activeMode >= 2;
  const openTouchEditor=()=>{setResumeTouch(snap.phase==='playing');if(snap.phase==='playing')arena.current?.pause();setTouchEditor(true);};
  const closeTouchEditor=()=>{setTouchEditor(false);if(resumeTouch)arena.current?.resume();};
  const getTouchArena = useCallback(()=>arena.current!,[]);
  const fullscreen = () => {if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});else void enterGameDisplay();};
  return (
    <main data-map={map} data-section={!inGame ? modal==='practice'?'play':modal ?? 'play' : 'game'} className={'game-shell ' + (touch?'touch-device ':'') + (inGame ? 'match-shell' : 'lobby-shell')}>
      <div className="world" ref={mount} />
      {operatorShop&&<div className="map-picker-overlay"><section aria-label="Operators"><header><strong>OPERATORS</strong><button aria-label="Close operators" onClick={()=>setOperatorShop(false)}>×</button></header><div className="operator-shop">{[...OPERATORS].sort((a,b)=>a.cost-b.cost).map(o=>{const owned=profile.owned.includes(o.id);return <button key={o.id} aria-pressed={profile.operator===o.id} disabled={accountBusy||accountBlocked||(!owned&&profile.balance<o.cost)} data-operator={o.id} onClick={handleOperatorAction} style={{borderColor:o.color}}><strong>{o.name}</strong><span>{profile.operator===o.id?'EQUIPPED':owned?'EQUIP':o.cost+' KR'}</span></button>})}</div></section></div>}
      {touchEditor&&<TouchControls getArena={getTouchArena} editor onClose={closeTouchEditor}/>}
      {mapChoosing&&<div className="map-picker-overlay"><section aria-label="Select arena"><header><strong>CHOOSE MAP</strong><button onClick={()=>setMapChoosing(false)} aria-label="Close map selection">×</button></header><MapPicker value={map} onChange={id=>{selectMap(id);setMapChoosing(false)}}/></section></div>}
      {touch&&<div className="rotate-phone">↻<strong>ROTATE TO PLAY</strong><span>Landscape gives you room to aim.</span><button onClick={enterFullscreen}>ENTER LANDSCAPE</button></div>}
      {reward&&<output key={reward.id} className="reward-toast"><KrCredit/><div><small>{reward.title}</small>{reward.amount>0?<strong>+{reward.amount} KR</strong>:<strong>READY TO GO</strong>}</div></output>}
      {!inGame && (
        <>
          <div className="menu-vignette" />
          <header className="topbar">
            <Link href="/" aria-label="krage home" className="topbar-home">
              <KrageLogo />
            </Link>
            <nav aria-label="Main navigation">{[['play','PLAY'],['online','LOBBY'],['locker','LOCKER'],['challenges','CHALLENGES'],['settings','SETTINGS']].map(([id,label])=><Button key={id} aria-current={((modal==='controls'?'settings':modal==='loadout'||modal==='practice'?'play':modal??'play')===id)?'page':undefined} className={'nav-button '+((modal==='controls'?'settings':modal==='loadout'||modal==='practice'?'play':modal??'play')===id?'active':'')} onClick={()=>setModal(id==='play'?null:id as 'online'|'locker'|'challenges'|'settings')}>{label}{id==='challenges'&&claimable>0&&<b className="claim-badge">{claimable}</b>}</Button>)}</nav>
            <div className="topbar-actions">
              <AccountPanel account={account} name={playerName} />
              <button className="nav-wallet" onClick={()=>setModal('challenges')} aria-label="Credits and challenges"><KrCredit/><strong key={profile.balance}>{profile.balance.toLocaleString()}</strong><small>KR</small></button>
            </div>
          </header>
          <section className="lobby lobby-v4">
            <div className="lobby-workspace">
              <section
                className={'arena-stage arena-tone-' + map}
                aria-label="Arena preview"
              >
                <div className="stage-heading">
                  <span className="eyebrow">ARENA</span>
                  <span className="stage-size">
                    {`${maps[map].width} × ${maps[map].depth} M`}
                  </span>
                </div>
                <div className="stage-content">
                  <div className="stage-map">
                    <h1>
                      {maps[map].name}
                      <span>
                        {['PUMP SETTLEMENT','ALPINE RELAY','TRAINING YARD','DUEL YARD'][map]}
                      </span>
                    </h1>
                    <div className="map-switcher"><button className="map-select-trigger" onClick={()=>setMapChoosing(true)} aria-label="Choose map"><MapDiagram id={map}/><span>CHANGE MAP ▾</span></button>
                    </div>
                  </div>
                  <button type="button"
                    className="operator-window"
                    aria-label={`Rotate character. Drag or use arrow keys. ${Math.round(previewRotation)} degrees`}
                    onClick={e=>{if(e.detail===0)rotateCharacter(.15);}}
                    onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.dataset.dragX=String(e.clientX);}}
                    onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const previous=Number(e.currentTarget.dataset.dragX??e.clientX);rotateCharacter((e.clientX-previous)*.012);e.currentTarget.dataset.dragX=String(e.clientX);}}}
                    onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
                    onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotateCharacter(e.key==='ArrowLeft'?-.15:.15);}}}
                  >

                  </button>
                </div>

              </section>
              <div className="hero-actions">
                <div className="character-toggle" aria-label="Character">
                  <button aria-label="Previous character" disabled={accountBusy||accountBlocked} onClick={()=>chooseOperator(-1)}>‹</button><button className="operator-shop-trigger" onClick={()=>setOperatorShop(true)} aria-label="Choose or unlock operator">{OPERATORS.find(o=>o.id===profile.operator)?.name.toUpperCase()} ▾</button><button aria-label="Next character" disabled={accountBusy||accountBlocked} onClick={()=>chooseOperator(1)}>›</button>
                </div>
                <button className="hero-loadout" aria-haspopup="dialog" onClick={() => setModal('loadout')}>LOADOUT <span>{GUNS[weapon].short}</span></button>
              </div>
            </div>
            <section className="play-card" aria-label="Play">
              <header><span className="play-card-mark" aria-hidden="true"><Crosshair size={23}/></span><h2>{modal==='practice'?'PRACTICE':'PLAY'}</h2>{modal==='practice'&&<button className="practice-back" aria-label="Back to online play" onClick={()=>setModal(null)}>×</button>}</header>
              {modal==='practice'?<div className="practice-inline">
                <button className="practice-map" onClick={()=>setMapChoosing(true)} aria-label="Choose practice map"><MapDiagram id={map}/><strong>{maps[map].name} ▾</strong></button>
                <PracticeStep label="Mode" value={modes[mode]} onStep={d=>setMode(((mode+d+4)%4) as Mode)}/>
                <PracticeStep label="Time" value={`${duration/60} MIN`} onStep={d=>{const values=[60,180,300,600];setDuration(values[(values.indexOf(duration)+d+4)%4]);}}/>
                {mode===0&&<PracticeStep label="Bots" value={String(bots)} onStep={d=>{const values=[0,1,3,5,7];setBots(values[(values.indexOf(bots)+d+5)%5]);}}/>}
                <PracticeStep label="Skill" value={{dummy:"TARGETS",casual:"CASUAL",normal:"REGULAR",hard:"VETERAN"}[settings.difficulty]} onStep={d=>{const values:Settings["difficulty"][]=["dummy","casual","normal","hard"];updateSettings({...settings,difficulty:values[(values.indexOf(settings.difficulty)+d+4)%4]});}}/>
                <Button className="deploy-button practice-start" disabled={!ready||accountBlocked||!!snap.network?.lobby} onClick={start}>START PRACTICE <ArrowUpRight size={20}/></Button>
              </div>:<>
              <label className="play-callsign"><span><PlayerAvatar name={playerName}/> PLAYER</span><input aria-label="Your player name" value={playerName} maxLength={16} onChange={e=>savePlayerName(e.target.value)}/></label>
              <Button
                className="deploy-button play-online"
                disabled={!ready || accountBlocked || snap.network?.status==='connecting' || !!snap.network?.lobby}
                onClick={() => { enterFullscreen(); setModal(null); arena.current?.joinRoom({url:defaultRoomURL(),name:playerName,mode,map,primary:weapon,operator:OPERATORS.find(o=>o.id===profile.operator)?.variant??0,duration,weaponFinishes:[0,1,2,3].map(w=>weaponFinish(profile,w)),quickPlay:true}); }}
              >
                {snap.network?.status==='connecting' ? 'JOINING…' : !ready ? 'LOADING…' : accountBlocked ? 'CONNECTING…' : 'PLAY ONLINE'}
                <ArrowUpRight size={23} />
              </Button>

              <div className="play-alternatives"><button disabled={!ready||accountBlocked||!!snap.network?.lobby} onClick={()=>setModal('practice')}>PRACTICE <span aria-hidden="true">›</span></button><button disabled={!ready||accountBlocked} onClick={()=>setModal('online')}>LOBBY <span aria-hidden="true">›</span></button></div>
              </>}
              {snap.network?.status==='failed'&&<output role="alert">{snap.network.message}</output>}
            </section>
          </section>
          {modal === 'online' && <aside className="friend-lobby-panel" aria-label="Custom lobby">
            <header><h2>LOBBY</h2><button className="back-to-play" aria-label="Return to play" onClick={()=>setModal(null)}>← PLAY</button></header>
            <RoomPanel weaponFinishes={[0,1,2,3].map(w=>weaponFinish(profile,w))} mode={mode} map={map} primary={weapon} operator={OPERATORS.find(o=>o.id===profile.operator)?.variant??0} name={playerName} onName={savePlayerName} ready={ready&&!accountBlocked} info={snap.network}
              onConnect={options=>{enterFullscreen();arena.current?.joinRoom(options)}}
              onChange={change=>arena.current?.roomClient?.lobby(change)}
              onKick={id=>arena.current?.roomClient?.kick(id)} onStart={()=>arena.current?.roomClient?.startMatch()}
              onLeave={()=>{arena.current?.disconnectRoom();setModal(null);}} />
          </aside>}
          <footer className="lobby-footer">
            <span className="version-link">
              <MousePointer2 size={14} />
              <a href="https://github.com/lonemagma" target="_blank" rel="noreferrer">v1.10.3</a>
            </span>

            <span className="project-credit"><span>A <a href="https://pacify.site" target="_blank" rel="noreferrer">pacify</a> project</span></span>
          </footer>
        </>
      )}
      {inGame && (
        <>
          <div className="hud" ref={hud}>
            <div className="damage-vignette" />
            <div className="hud-top-left">
              <canvas
                ref={radar}
                width="150"
                height="150"
                className="minimap"
              />
              <div className="map-meta">
                {snap.map}{' '}
                <span>
                  {snap.fps} FPS · {snap.frameMs.toFixed(1)} MS
                </span>
              </div>

            </div>
            {snap.network && (
              <output
                className={'connection-banner status-' + snap.network.status}
              >
                <strong>ROOM {snap.network.room}</strong><button className="invite-button" onClick={() => void copyInvite()}>COPY INVITE</button>
                <span>
                  {snap.network.status !== 'connected'
                    ? snap.network.message || snap.network.status
                    : snap.network.state === 'waiting'
                      ? 'WAITING FOR OPPONENT'
                      : `${snap.network.players} PLAYERS · ${snap.network.ping} ms`}
                </span>
              </output>
            )}
            <div className="match-clock">
              <div className="mode-heading">
                {modes[activeMode]} <span>FIRST TO {snap.fragLimit}</span>
              </div>
              <div className="clock-row">
                <span className="score-blue">
                  {teamGame ? snap.teams[0] : snap.score}
                </span>
                <div className={snap.time < 30 ? 'clock urgent' : 'clock'}>
                  {minutes}:{String(seconds).padStart(2, '0')}
                </div>
                <span className="score-red">
                  {teamGame
                    ? snap.teams[1]
                    : Math.max(
                        0,
                        ...snap.leaderboard
                          .filter((a) => a.id !== 0)
                          .map((a) => a.kills),
                      )}
                </span>
              </div>
              <div className="score-labels">
                <span>{teamGame ? 'YOUR TEAM' : 'YOU'}</span>
                <span>{teamGame ? 'OPPONENTS' : 'TOP RIVAL'}</span>
              </div>
            </div>
            <div className="hud-top-right">
              <div className="hud-actions">
                <Button
                  aria-label="Toggle sound"
                  className="icon-button"
                  onClick={() =>
                    updateSettings({
                      ...settings,
                      volume: settings.volume > 0 ? 0 : 0.5,
                    })
                  }
                >
                  {settings.volume > 0 ? (
                    <Volume2 size={16} />
                  ) : (
                    <VolumeX size={16} />
                  )}
                </Button>
                <Button
                  aria-label="Toggle fullscreen"
                  className="icon-button"
                  onClick={fullscreen}
                >
                  <Maximize size={16} />
                </Button>
                <Button
                  aria-label="Pause match"
                  className="icon-button"
                  onClick={() => arena.current?.pause()}
                >
                  <Pause size={16} />
                </Button>
              </div>
              <div className="kill-feed">
                {feed.map((f) => (
                  <div
                    key={f.id}
                    className={f.own ? 'feed-row own' : 'feed-row'}
                  >
                    <span>{f.killer}</span>
                    <WeaponGlyph id={f.weapon} />
                    {f.head && <Crosshair size={12} />}
                    <span>{f.victim}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={'crosshair ' + (snap.weapon === 2 ? 'shotgun-crosshair' : '')}>
              <i />
              <i />
              <i />
              <i />
              <b />
            </div>
            <div className="hit-marker" aria-hidden="true">
              <svg viewBox="-20 -20 40 40" fill="none">
                <path className="hit-outline" d="M-15-15-8-8M15-15 8-8M-15 15-8 8M15 15 8 8" />
                <path d="M-15-15-8-8M15-15 8-8M-15 15-8 8M15 15 8 8" />
              </svg>
            </div>
            {frags.length>0 && snap.alive && <div className="frag-stack" aria-live="polite">{frags.map((notice)=><div className="frag-notice" key={notice.id}><strong>{notice.message.replace(/ \+\d+$/, '')}</strong><b>{notice.message.match(/\+\d+$/)?.[0]}</b></div>)}</div>}
            {snap.shield > 0 && snap.alive && (
              <div className="spawn-notice">
                SPAWN PROTECTED · FIRING ENDS PROTECTION
              </div>
            )}
            {snap.reload > 0 && snap.alive && (
              <output className="reload-notice">
                RELOADING <span>{snap.reload.toFixed(1)}s</span>
                <i
                  style={{
                    width: `${(1 - snap.reload / GUNS[snap.weapon].reload) * 100}%`,
                  }}
                />
              </output>
            )}
            <div className="hud-bottom-left">
              <div className="health-row">
                <span className="health-plus">+</span>
                <strong className={snap.hp < 30 ? 'low-health' : ''}>
                  {snap.hp}
                </strong>
                <span>HEALTH</span>
              </div>
              <div className={"health-track"+(snap.hp<30?" critical":"")} aria-hidden="true">
                <i style={{ width: `${snap.hp}%` }} />
              </div>
              <div className="movement-readout">
                <span>
                  <MoveUpRight size={14} />
                  {snap.speed.toFixed(1)} <small>M/S</small>
                </span>
                <span
                  className={
                    snap.slideCooldown > 0 ? 'cooldown' : 'slide-ready'
                  }
                >
                  {snap.crouched
                    ? 'CROUCHED'
                    : snap.slideCooldown > 0
                      ? ''
                      : 'STANDING'}
                </span>
              </div>
            </div>
            <div className="hud-bottom-right">
              <div className="weapon-title">
                {snap.equip > 0 ? 'DRAWING / ' : ''}
                {GUNS[snap.weapon].name}
              </div>
              <div className="ammo-row">
                <strong
                  className={
                    snap.ammo < 5 && snap.weapon !== 3 ? 'low-ammo' : ''
                  }
                >
                  {snap.weapon === 3 ? '∞' : String(snap.ammo).padStart(2, '0')}
                </strong>
                <span>
                  /{' '}
                  {snap.weapon === 3
                    ? 'EDGE'
                    : String(GUNS[snap.weapon].mag).padStart(2, '0')}
                  <small>
                    {snap.weapon === 3 ? '' : 'R / RELOAD'}
                  </small>
                </span>
              </div>
              <div className="weapon-slots">
                {[snap.primary, 3].map((id, slot) => (
                  <Button
                    key={slot}
                    aria-label={`Equip ${GUNS[id].short}`}
                    className={
                      'weapon-slot ' + (snap.weapon === id ? 'equipped' : '')
                    }
                    onClick={() => {
                      if (arena.current) arena.current.input.weapon = id;
                    }}
                  >
                    <span>{slot + 1}</span>
                    <WeaponGlyph
                      id={id}
                      finish={
                        weaponFinish(profile, snap.weapon)
                      }
                    />
                  </Button>
                ))}
              </div>
            </div>
            <div className="damage-direction" aria-hidden="true" />
            {snap.dragAim && snap.phase === 'playing' && !snap.benchmark && (
              <div className="drag-aim-hint">
                CLICK TO CAPTURE MOUSE
              </div>
            )}
            {snap.benchmark && !snap.benchmark.complete && (
              <div className="benchmark-running">
                COMBAT BENCHMARK · {Math.ceil(snap.benchmark.remaining)}s{' '}
                <span>Automated controls</span>
              </div>
            )}
            <div className="hud-hints">
              <span>
                W A S D <small>MOVE</small>
              </span>
              <span>
                SPACE <small>JUMP</small>
              </span>
              <span>
                {keyLabel(settings.crouchKey)} <small>CROUCH</small>
              </span>
              <span>
                RMB <small>AIM</small>
              </span>
              <span>
                {keyLabel(settings.slideKey)} <small>SLIDE</small>
              </span><span>
                TAB <small>SCORES</small>
              </span>
            </div>
          </div>
          {!!snap.intro&&snap.phase==='playing'&&<section className="match-intro" key={snap.network?.room+snap.map+snap.mode} aria-live="polite"><small>{snap.network?'ROOM '+snap.network.room:'PRACTICE'}</small>{snap.intro>5&&<b className="match-start-title">MATCH START</b>}<strong>{snap.map}</strong><span>{modes[activeMode]}</span><div className="match-intro-details"><span><b>{snap.fragLimit}</b> FRAGS TO WIN</span><span><b>{minutes}:{String(seconds).padStart(2,'0')}</b> REMAINING</span><span><b>{snap.network?.players??1}</b> {snap.network?'ONLINE':'PLAYER'}</span></div></section>}
          {snap.phase === 'spawning' && !snap.benchmark && (
            <div className="spawn-overlay">
              <section className="spawn-panel">
                <div className="panel-heading">
                  <span className="eyebrow">NEXT SPAWN</span>
                  <span className="small-tag">{snap.respawn>0 ? `${snap.respawn.toFixed(1)}s` : 'READY'}</span>
                </div>
                {snap.lastDeath && (
                  <div className="death-recap">
                    <WeaponGlyph id={snap.lastDeath.weapon} />
                    <div>
                      <span>ELIMINATED BY</span>
                      <strong>{snap.lastDeath.killer}</strong>
                      <small>
                        {GUNS[snap.lastDeath.weapon].short}
                        {snap.lastDeath.head ? ' · HEADSHOT' : ''}
                      </small>
                    </div>
                  </div>
                )}
                <progress className="respawn-progress" aria-label="Respawn ready" max={2} value={2-Math.min(2,snap.respawn)}/>
                <h2>
                  RESPAWN{' '}
                  <small className="spawn-key-hint"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> LOADOUT <kbd>SPACE</kbd> RESPAWN</small>
                </h2>
                <div className="spawn-choices">
                  {GUNS.slice(0, 3).map((g, i) => (
                    <Button
                      key={g.short}
                      aria-pressed={snap.primary === i}
                      className={
                        'spawn-choice weapon-tone-' +
                        i +
                        ' ' +
                        (snap.primary === i ? 'selected' : '')
                      }
                      onClick={() => arena.current?.choosePrimary(i)}
                    >
                      <WeaponGlyph
                        id={i}
                        finish={
                          weaponFinish(profile, i)
                        }
                      />
                      <strong>{g.short}</strong>
                      <kbd>{i+1}</kbd>
                    </Button>
                  ))}
                </div>
                <Button
                  className="deploy-button"
                  disabled={
                    snap.respawn > 0 ||
                    (!!snap.network && snap.network.status !== 'connected')
                  }
                  onClick={() => arena.current?.deploy()}
                >
                  {snap.respawn > 0
                    ? `RESPAWN · ${Math.ceil(snap.respawn)}`
                    : <>RESPAWN <kbd>SPACE</kbd></>}
                  <ArrowUpRight size={22} />
                </Button>

              </section>
            </div>
          )}
          {board && snap.phase === 'playing' && (
            <div className="score-overlay">
              <Scoreboard snap={snap} mode={activeMode} />
              <span className="score-hint">RELEASE TAB TO RETURN</span>
            </div>
          )}
          {snap.phase === 'paused' && (
            <div className="pause-overlay">
              <section className="pause-panel">
                <span className="eyebrow">
                  {snap.network ? 'ROOM ' + snap.network.room : 'PAUSED'}
                </span>
                <h2>
                  {snap.benchmark?.complete
                    ? 'Benchmark complete'
                    : snap.network
                      ? snap.network.removed ? 'REMOVED FROM ROOM' : snap.network.status==='failed' ? 'CONNECTION LOST' : snap.network.status==='reconnecting' ? 'RECONNECTING' : 'PAUSED'
                      : 'PAUSED'}
                </h2>
                {snap.benchmark?.complete && (
                  <div className="performance-report">
                    <div>
                      <strong>
                        {snap.benchmark.report.averageFps.toFixed(0)}
                      </strong>
                      <span>AVERAGE FPS</span>
                    </div>
                    <div>
                      <strong>
                        {snap.benchmark.report.p95Ms.toFixed(1)} ms
                      </strong>
                      <span>95% FRAME TIME</span>
                    </div>
                    <div>
                      <strong>
                        {snap.benchmark.shots} / {snap.benchmark.kills}
                      </strong>
                      <span>SHOTS / FRAGS</span>
                    </div>
                    <div>
                      <strong>{snap.benchmark.maxCorpses}</strong>
                      <span>PEAK RAGDOLLS</span>
                    </div>
                    <p>
                      {snap.benchmark.width} × {snap.benchmark.height} ·{' '}
                      {snap.benchmark.quality} · {snap.benchmark.report.samples}{' '}
                      frames · {snap.benchmark.report.over33Ms} frames over 33
                      ms
                    </p>
                  </div>
                )}
                {snap.network && (
                  <p className="online-pause-note">
                    {snap.network.status === 'connected'
                      ? snap.network.state === 'waiting'
                        ? 'Waiting for players'
                        : 'Match is still live'
                      : snap.network.message}
                  </p>
                )}
                <Button
                  className="deploy-button"
                  disabled={
                    !!snap.network && ['connecting','reconnecting'].includes(snap.network.status)
                  }
                  onClick={() => {
                    setError('');
                    if(snap.network?.removed){arena.current?.lobby();return;}
                    if(snap.network?.status==='failed'){arena.current?.rejoinRoom();return;}
                    if (snap.benchmark?.complete) start();
                    else arena.current?.resume();
                  }}
                >
                  {snap.network?.removed?'BACK TO LOBBY':snap.network?.status==='failed'?'REJOIN MATCH':snap.network?.status==='reconnecting'?'RECONNECTING…':snap.benchmark?.complete ? 'START MATCH' : <>RESUME <kbd>ENTER</kbd></>}
                  <ArrowUpRight size={22} />
                </Button>
                {snap.captureFailed && (
                  <div className="capture-fallback">
                    <p>Mouse capture is unavailable in this browser.</p>
                    <Button
                      className="secondary-button"
                      onClick={() => {
                        setError('');
                        arena.current?.useDragAim();
                      }}
                    >
                      PLAY WITH DRAG AIM
                    </Button>
                  </div>
                )}
                {pauseSettings && (
                  <div className="pause-settings-scroll"><button onClick={openTouchEditor}>MOBILE CONTROLS</button>
                    <SettingsPanel
                      settings={settings}
                      onChange={updateSettings}
                    />
                  </div>
                )}
                <div className="pause-actions">
                  <Button
                    className="secondary-button"
                    onClick={() => setPauseSettings(!pauseSettings)}
                  >
                    <SlidersHorizontal size={15} />
                    {pauseSettings ? 'Hide settings' : 'Settings'}
                  </Button>
                  <Button
                    className="secondary-button"
                    onClick={() => {
                      setError('');
                      arena.current?.lobby();
                    }}
                  >
                    Leave arena
                  </Button>
                </div>
              </section>
            </div>
          )}
          {snap.phase === 'ended' && (
            <div className="end-overlay"><section className={'end-panel outcome-'+result.outcome}>
              <div className="result-header"><span>{snap.map}</span><span>{modes[activeMode]}</span></div>
              <div className="result-hero"><h2>{result.outcome.toUpperCase()}</h2><strong>{result.own}<span> : </span>{result.rival}</strong></div>
              {board?<Scoreboard snap={snap} mode={activeMode}/>:<div className="match-stats"><div><strong>{snap.score}</strong><span>FRAGS</span></div><div><strong>{snap.deaths}</strong><span>DEATHS</span></div><div><strong>+{lastAward}</strong><span>KR</span></div></div>}
              {snap.network?.public&&snap.nextRound&&<div className="next-round"><span>NEXT · {maps[snap.nextRound.map]?.name} · {modes[snap.nextRound.mode]}</span><strong>{snap.nextRound.seconds}s</strong></div>}
              <div className="result-actions">
                {!snap.network?<Button className="deploy-button" onClick={start}>PLAY AGAIN <kbd>ENTER</kbd></Button>:!snap.network.public&&<Button className="deploy-button" disabled={snap.network.status!=='connected'||snap.network.host!==snap.network.you} onClick={()=>arena.current?.playAgain()}>{snap.network.host===snap.network.you?'LOBBY':'WAITING FOR HOST'}</Button>}
                <Button className="secondary-button" aria-pressed={board} onClick={()=>setBoard(b=>!b)}>{board?'RESULTS':'SCORES'} <kbd>TAB</kbd></Button>
                <Button className="secondary-button" onClick={()=>arena.current?.lobby()}>EXIT <kbd>ESC</kbd></Button>
              </div>
            </section></div>
          )}
          {touch && snap.phase === 'playing' && !inGameChat && <TouchControls getArena={getTouchArena} onEdit={openTouchEditor}/> }
        </>
      )}
      {inGame && snap.network?.status==='reconnecting' && <output className="connection-recovery">RECONNECTING · YOUR SLOT IS RESERVED</output>}
      {error && (
        <div role="alert" className="error-notice">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      <ArenaChat name={playerName} room={chatRoom} visible boxVisible={!inGame||snap.phase==='paused'||inGameChat} team={mode>=2} forceOpen={inGameChat} onForceClose={()=>arena.current?.closeChat()} defaultChannel={chatRoom?(mode>=2?'team':'match'):undefined}/><LobbySection open={modal !== null && modal !== 'online' && modal !== 'practice'} playing={inGame} kind={modal ?? 'settings'} title={modal === 'loadout' ? 'LOADOUT' : (modal ?? '').toUpperCase()} onClose={()=>setModal(null)}>
          {(modal === 'settings' || modal === 'controls') && <div className="section-tabs"><button aria-pressed={modal==='settings'} onClick={()=>setModal('settings')}>PREFERENCES</button><button aria-pressed={modal==='controls'} onClick={()=>setModal('controls')}>KEY BINDINGS</button><button disabled={!ready} onClick={openTouchEditor}>MOBILE CONTROLS</button></div>}
          {modal === 'settings' && (
            <>
              <SettingsPanel settings={settings} onChange={updateSettings}>
              <details className="network-diagnostics"><summary>PERFORMANCE</summary><dl>
                <dt>Frame p95</dt><dd>{snap.performance.p95Ms.toFixed(1)} ms</dd>
                <dt>Draw calls / triangles</dt><dd>{snap.diagnostics?.drawCalls ?? 0} / {snap.diagnostics?.triangles ?? 0}</dd>
                <dt>Model rebuilds</dt><dd>{snap.diagnostics?.modelRebuilds ?? 0}</dd>
                <dt>RTT / jitter</dt><dd>{snap.network?.ping ?? 0} / {(snap.network?.jitter ?? 0).toFixed(0)} ms</dd>
                <dt>Retired stale inputs</dt><dd>{snap.network?.droppedInputs ?? 0}</dd>
                <dt>Server step</dt><dd>{(snap.network?.serverStepMs ?? 0).toFixed(2)} ms</dd>
                <dt>Pending / queued inputs</dt><dd>{snap.diagnostics?.pendingInputs ?? 0} / {snap.network?.queuedInputs ?? 0}</dd>
              </dl></details>
              <div className="benchmark-settings">
                {snap.lastBenchmark?.complete && (
                  <p>
                    Last run: {snap.lastBenchmark.report.averageFps.toFixed(0)}{' '}
                    FPS average · {snap.lastBenchmark.report.p95Ms.toFixed(1)}{' '}
                    ms at 95% · {snap.lastBenchmark.quality}
                  </p>
                )}
                <Button
                  className="secondary-button"
                  onClick={() => {
                    setModal(null);
                    setMode(0);
                    setMap(0);
                    setBots(5);
                    setError('');
                    arena.current?.startBenchmark();
                  }}
                >
                  RUN 30s COMBAT BENCHMARK
                </Button>
                <p>
                  Dune · 5 bots · automatic aim and movement. Measures this
                  browser; replaces the current match.
                </p>
              </div>
              </SettingsPanel>
            </>
          )}{' '}
          {modal === 'controls' && (
            <KeyBindings settings={settings} onChange={updateSettings} />
          )}
          {modal === 'challenges' && <Challenges profile={profile} onChange={updateProfile} onAction={account.active?cloudAction:undefined} busy={accountBusy||accountBlocked}/>}
          {modal === 'locker' && (
            <Locker profile={profile} onChange={updateProfile} onAction={account.active?cloudAction:undefined} busy={accountBusy||accountBlocked}/>
          )}
          {modal === 'loadout' && (
            <div className="loadout-grid">
              {GUNS.slice(0, 3).map((g, i) => (
                <Button
                  key={g.short}
                  className={
                    'loadout-card weapon-tone-' +
                    i +
                    ' ' +
                    (weapon === i ? 'selected' : '')
                  }
                  onClick={() => {
                    setWeapon(i);
                    arena.current?.setPrimaryPreview(i);
                  }}
                >
                  <div className="loadout-card-top">
                    <kbd>{i+1}</kbd>
                    <span>{weapon === i ? 'SELECTED' : ''}</span>
                  </div>
                  <WeaponGlyph
                    id={i}
                    finish={
                      weaponFinish(profile, i)
                    }
                  />
                  <h3>{g.short}</h3>

                </Button>
              ))}
            </div>
          )}
      </LobbySection>
    </main>
  );
}

function PracticeStep({label,value,onStep}:{label:string;value:string;onStep:(direction:number)=>void}){return <div className="practice-step"><span>{label}</span><div><button aria-label={`Previous ${label.toLowerCase()}`} onClick={()=>onStep(-1)}>‹</button><strong aria-live="polite">{value}</strong><button aria-label={`Next ${label.toLowerCase()}`} onClick={()=>onStep(1)}>›</button></div></div>;}
