/** Device-local practice progression. Never accepted as a paid/server balance. */
export type Metric = 'kills' | 'headshots' | 'meleeKills' | 'matches' | 'wins';
export type Counts = Record<Metric, number>;
export type MatchReceipt = Counts & {
  id: string;
  seconds: number;
  eligible: boolean;
};
export const CATALOG = [
  { id: 'skin-echo-corona', kind: 'finish', name: 'ECHO / Glacier', note: 'PRESTIGE', cost: 2800, variant: 5, color: '#85f4dd', weapon: 0 },
  { id: 'skin-kilo-regent', kind: 'finish', name: 'KILO / Regent', note: 'PRESTIGE', cost: 3200, variant: 5, color: '#e1b55e', weapon: 1 },
  { id: 'skin-mica-nebula', kind: 'finish', name: 'MICA / Nebula', note: 'PRESTIGE', cost: 3600, variant: 5, color: '#8399a3', weapon: 2 },
  { id: 'skin-echo-carbon', kind: 'finish', name: 'ECHO / Circuit', note: '', cost: 750, variant: 4, color: '#85d9cf', weapon: 0 },
  { id: 'skin-kilo-carbon', kind: 'finish', name: 'KILO / Blackout', note: '', cost: 900, variant: 4, color: '#d8b68a', weapon: 1 },
  { id: 'skin-mica-carbon', kind: 'finish', name: 'MICA / Nightfall', note: '', cost: 1000, variant: 4, color: '#b4a0dc', weapon: 2 },
  {
    id: 'op-scout',
    kind: 'operator',
    name: 'Rook',
    note: 'Light field kit',
    cost: 0,
    variant: 0,
    color: '#73869d',
  },
  {
    id: 'op-warden',
    kind: 'operator',
    name: 'Vera',
    note: 'Reinforced helmet',
    cost: 0,
    variant: 1,
    color: '#d5dfe9',
  },
  {
    id: 'op-spectre',
    kind: 'operator',
    name: 'Blake',
    note: 'Dark reconnaissance kit',
    cost: 0,
    variant: 2,
    color: '#726ca3',
  },
  {
    id: 'finish-factory',
    kind: 'finish',
    name: 'Factory',
    note: 'Original steel and wood',
    cost: 0,
    variant: 0,
    color: '#a6643f',
  },
  {
    id: 'finish-frost',
    kind: 'finish',
    name: 'Frost',
    note: 'Ceramic white / blue steel',
    cost: 120,
    variant: 1,
    color: '#b8d7f0',
  },
  {
    id: 'finish-ember',
    kind: 'finish',
    name: 'Ember',
    note: 'Graphite / copper',
    cost: 160,
    variant: 2,
    color: '#f78a50',
  },
] as const;
const ZERO = (): Counts => ({
  kills: 0,
  headshots: 0,
  meleeKills: 0,
  matches: 0,
  wins: 0,
});
export type Profile = {
  version: 1;
  balance: number;
  owned: string[];
  operator: string;
  finish: string;
  weaponFinishes?: string[];
  day: number;
  week: number;
  daily: Counts;
  weekly: Counts;
  lifetime: Counts;
  claimed: string[];
  receipts: string[];
  ledger: { id: string; amount: number; reason: string }[];
};
export const DAY = 86400000;
export const periods = (now: number) => ({
  day: Math.floor(now / DAY),
  week: Math.floor((now / DAY + 3) / 7),
});
export function newProfile(now = Date.now()): Profile {
  return {
    version: 1,
    balance: 200,
    owned: ['op-scout', 'op-warden', 'op-spectre', 'finish-factory'],
    operator: 'op-scout',
    finish: 'finish-factory',
    ...periods(now),
    daily: ZERO(),
    weekly: ZERO(),
    lifetime: ZERO(),
    claimed: [],
    receipts: [],
    ledger: [{ id: 'starter', amount: 200, reason: 'Practice starter grant' }],
  };
}
export function refreshProfile(profile: Profile, now = Date.now()): Profile {
  const { day, week } = periods(now),
    p = { ...profile, owned: Array.from(new Set([...profile.owned,'op-scout','op-warden','op-spectre'])) };
  if (day > p.day) {
    p.day = day;
    p.daily = ZERO();
  }
  if (week > p.week) {
    p.week = week;
    p.weekly = ZERO();
  }
  // Retired finishes are refunded exactly once, including saved equipped copies.
  const retired:Record<string,number>={'skin-echo':300,'skin-kilo':350,'skin-mica':400};
  for(const [id,cost] of Object.entries(retired))if(p.owned.includes(id)){
    const receipt=`retired:${id}`;
    if(!p.ledger.some(e=>e.id===receipt)){p.balance+=cost;p.ledger=[{id:receipt,amount:cost,reason:'Retired finish refund'},...p.ledger];}
    p.owned=p.owned.filter(owned=>owned!==id);
  }
  p.weaponFinishes=p.weaponFinishes?.map(id=>id in retired?'finish-factory':id);
  if(p.finish in retired)p.finish='finish-factory';
  return p;
}
type Challenge = {
  id: string;
  title: string;
  metric: Metric;
  target: number;
  reward: number;
  period: 'daily' | 'weekly';
  expires: number;
};
// Authored rotation is shipped in advance; selection depends only on UTC period.
const dailyDeck: [string, Metric, number, number][] = [
  ['Clean dozen', 'kills', 12, 60],
  ['Stay in the fight', 'matches', 2, 45],
  ['On the mark', 'headshots', 4, 60],
  ['Close the gap', 'meleeKills', 3, 70],
  ['Take the round', 'wins', 1, 60],
  ['Frag rhythm', 'kills', 18, 80],
  ['Warm streak', 'kills', 15, 70],
  ['Second round', 'matches', 3, 65],
  ['Steady aim', 'headshots', 5, 70],
  ['Blade work', 'meleeKills', 2, 50],
];
const weeklyDeck: [string, Metric, number, number][] = [
  ['Arena regular', 'matches', 8, 180],
  ['Eighty down', 'kills', 80, 220],
  ['Sharp focus', 'headshots', 20, 200],
  ['Winning run', 'wins', 5, 220],
  ['Close quarters', 'meleeKills', 12, 200],
  ['Centurion', 'kills', 100, 260],
  ['Weekend regular', 'matches', 10, 220],
  ['Precision run', 'headshots', 25, 240],
];
export function challenges(p: Profile): Challenge[] {
  const make = (
    deck: typeof dailyDeck,
    period: 'daily' | 'weekly',
    epoch: number,
    count: number,
  ) => {
    // Stable UTC-seeded shuffle; unique objectives in each set, no server cron needed.
    let seed=(epoch^(period==='daily'?0x51f15e:0x9e3779b9))>>>0;
    const order=deck.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
    const metrics=new Set<Metric>();
    return order.filter(i=>{const metric=deck[i][1];if(metrics.has(metric))return false;metrics.add(metric);return true;}).slice(0,count).map(index=>{
      const [title,metric,target,reward]=deck[index];
      return {id:`${period}:${epoch}:${index}`,title,metric,target,reward,period,
        expires:period==='daily'?(epoch+1)*DAY:((epoch+1)*7-3)*DAY};
    });
  };
  return [...make(dailyDeck,'daily',p.day,3),...make(weeklyDeck,'weekly',p.week,4)];
}

function credit(p: Profile, id: string, amount: number, reason: string) {
  if (p.ledger.some((l) => l.id === id)) return p;
  return {
    ...p,
    balance: p.balance + amount,
    ledger: [{ id, amount, reason }, ...p.ledger].slice(0, 200),
  };
}
export function matchReward(receipt:Pick<MatchReceipt,'kills'|'headshots'|'wins'>){
 return 20+Math.min(40,Math.max(0,Math.floor(receipt.kills||0))*2)+Math.min(10,Math.max(0,Math.floor(receipt.headshots||0)))+(receipt.wins>0?10:0);
}
export function recordMatch(
  profile: Profile,
  receipt: MatchReceipt,
  now = Date.now(),
): Profile {
  let p = refreshProfile(profile, now);
  if (
    !receipt.eligible ||
    receipt.seconds < 30 ||
    !receipt.id ||
    p.receipts.includes(receipt.id)
  )
    return p;
  const count = ZERO();
  for (const metric of Object.keys(count) as Metric[])
    count[metric] = Math.max(
      0,
      Math.min(
        metric === 'matches' || metric === 'wins' ? 1 : 100,
        Math.floor(receipt[metric] || 0),
      ),
    );
  count.matches = 1;
  const sum = (a: Counts): Counts =>
    Object.fromEntries(
      Object.keys(a).map((k) => [k, a[k as Metric] + count[k as Metric]]),
    ) as Counts;
  p = {
    ...p,
    daily: sum(p.daily),
    weekly: sum(p.weekly),
    lifetime: sum(p.lifetime),
    receipts: [receipt.id, ...p.receipts],
  };
  return credit(
    p,
    `match:${receipt.id}`,
    matchReward(count),
    'Completed match',
  );
}
export function claimChallenge(
  profile: Profile,
  id: string,
  now = Date.now(),
): Profile {
  const p = refreshProfile(profile, now),
    challenge = challenges(p).find((c) => c.id === id);
  if (
    !challenge ||
    p.claimed.includes(id) ||
    p[challenge.period][challenge.metric] < challenge.target
  )
    return p;
  let earned=credit({ ...p, claimed: [...p.claimed,id] },`challenge:${id}`,challenge.reward,challenge.title);
  const set=challenges(p).filter(c=>c.period===challenge.period);
  if(set.every(c=>earned.claimed.includes(c.id)))earned=credit(earned,`set:${challenge.period}:${challenge.period==='daily'?p.day:p.week}`,challenge.period==='daily'?50:150,`${challenge.period} set complete`);
  return earned;
}
export function purchase(profile: Profile, id: string): Profile {
  const item = CATALOG.find((i) => i.id === id);
  if (!item || profile.owned.includes(id) || profile.balance < item.cost)
    return profile;
  return credit(
    { ...profile, owned: [...profile.owned, id] },
    `purchase:${id}`,
    -item.cost,
    item.name,
  );
}
export function equipCosmetic(profile: Profile, id: string): Profile {
  const item = CATALOG.find((i) => i.id === id);
  if (!item || !profile.owned.includes(id)) return profile;
  if ('weapon' in item) {
    const weaponFinishes = [...(Array.isArray(profile.weaponFinishes) ? profile.weaponFinishes : [])];
    weaponFinishes[item.weapon] = id;
    return { ...profile, weaponFinishes };
  }
  return { ...profile, [item.kind === 'operator' ? 'operator' : 'finish']: id };
}
export function loadProfile(value: string | null, now = Date.now()): Profile {
  try {
    const p = JSON.parse(value ?? 'null');
    if (
      p?.version !== 1 ||
      !Number.isSafeInteger(p.balance) ||
      p.balance < 0 ||
      !Array.isArray(p.owned) ||
      !Array.isArray(p.receipts) ||
      !Array.isArray(p.ledger) ||
      !Array.isArray(p.claimed) ||
      ![...p.owned, ...p.receipts, ...p.claimed].every(
        (id) => typeof id === 'string',
      ) ||
      !p.ledger.every(
        (event: Profile['ledger'][number]) =>
          event &&
          typeof event.id === 'string' &&
          Number.isSafeInteger(event.amount) &&
          typeof event.reason === 'string',
      )
    )
      return newProfile(now);
    for (const key of ['daily', 'weekly', 'lifetime'])
      for (const metric of Object.keys(ZERO()))
        if (!Number.isFinite(p[key]?.[metric]) || p[key][metric] < 0)
          return newProfile(now);
    if (!Number.isInteger(p.day) || !Number.isInteger(p.week))
      return newProfile(now);
    if (
      !CATALOG.some((i) => i.id === p.operator && i.kind === 'operator') ||
      !p.owned.includes(p.operator)
    )
      p.operator = 'op-scout';
    if (
      !CATALOG.some((i) => i.id === p.finish && i.kind === 'finish') ||
      !p.owned.includes(p.finish)
    )
      p.finish = 'finish-factory';
    return refreshProfile(p, now);
  } catch {
    return newProfile(now);
  }
}

export function weaponFinish(profile: Profile, weapon: number) {
  if(profile.weaponFinishes?.[weapon]==='finish-factory')return 0;
  const item = CATALOG.find(i => i.id === profile.weaponFinishes?.[weapon] && 'weapon' in i && i.weapon === weapon && profile.owned.includes(i.id));
  return item?.variant ?? CATALOG.find(i => i.id === profile.finish)?.variant ?? 0;
}

/** Equip only an owned finish belonging to this primary. Factory is always available. */
export function equipWeaponFinish(profile: Profile, weapon: number, id: string): Profile {
  if(![0,1,2].includes(weapon))return profile;
  if(id!=='finish-factory'&&!CATALOG.some(item=>item.id===id&&'weapon' in item&&item.weapon===weapon&&profile.owned.includes(id)))return profile;
  const weaponFinishes=Array.from({length:3},(_,i)=>profile.weaponFinishes?.[i]??'finish-factory');
  weaponFinishes[weapon]=id;
  return {...profile,weaponFinishes};
}
export function claimableCount(profile: Profile) {
  return challenges(profile).filter(c=>!profile.claimed.includes(c.id)&&profile[c.period][c.metric]>=c.target).length;
}
