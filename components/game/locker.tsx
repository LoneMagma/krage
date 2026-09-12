import { useState } from 'react';
import { WeaponInspector } from './weapon-inspector';
import {
  CATALOG,
  challenges,
  claimChallenge,
  equipCosmetic,
  purchase,
  type Profile,
} from '@/lib/game/progression';
import { WeaponGlyph } from './identity';
export function Locker({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}) {
  const [selected,setSelected]=useState(0),[showChallenges,setChallenges]=useState(false);
  const skins=CATALOG.filter(item=>'weapon' in item);
  const item=skins[selected], equipped=profile.weaponFinishes?.[selected]===item.id;
  return (
    <div className="locker">
      <div className="wallet">
        <div>
          <span>PRACTICE MARKS</span>
          <strong>
            {profile.balance.toLocaleString()} <small>KM</small>
          </strong>
        </div>

      </div>
      <div className="locker-focus">
        <div className="locker-rail" aria-label="Choose weapon">{skins.map((skin,i)=><button key={skin.id} aria-pressed={selected===i} onClick={()=>setSelected(i)}><WeaponGlyph id={i} finish={skin.variant}/><strong>{['ECHO','KILO','MICA'][i]}</strong><small>{profile.weaponFinishes?.[i]===skin.id?'EQUIPPED':'AVAILABLE'}</small></button>)}</div>
        <div className="locker-inspection"><WeaponInspector weapon={selected} finish={item.variant}/><div className="inspection-caption"><div><span className="eyebrow">{equipped?'EQUIPPED FINISH':'PREVIEW'}</span><h3>{item.name.split(' / ')[1]}</h3></div><button disabled={equipped || (!profile.owned.includes(item.id) && profile.balance<item.cost)} onClick={()=>onChange(equipCosmetic(profile.owned.includes(item.id)?profile:purchase(profile,item.id),item.id))}>{equipped?'EQUIPPED':'EQUIP'}</button></div></div>
      </div>
      <button className="challenge-toggle" aria-expanded={showChallenges} onClick={()=>setChallenges(!showChallenges)}>CHALLENGES {showChallenges?'−':'+'}</button>
      {showChallenges && <>
      <h3>CHALLENGES</h3>

      <div className="challenge-list">
        {challenges(profile).map((c) => {
          const progress = Math.min(c.target, profile[c.period][c.metric]),
            claimed = profile.claimed.includes(c.id);
          return (
            <article key={c.id}>
              <div>
                <span className="eyebrow">
                  {c.period} · {c.reward} KM
                </span>
                <strong>{c.title}</strong>
                <small>
                  {progress} / {c.target}{' '}
                  {c.metric === 'meleeKills' ? 'EDGE frags' : c.metric} · resets{' '}
                  {new Date(c.expires)
                    .toISOString()
                    .slice(0, 16)
                    .replace('T', ' ')}{' '}
                  UTC
                </small>
                <progress max={c.target} value={progress} />
              </div>
              <button
                disabled={claimed || progress < c.target}
                onClick={() => onChange(claimChallenge(profile, c.id))}
              >
                {claimed ? 'CLAIMED' : 'CLAIM'}
              </button>
            </article>
          );
        })}
      </div>
      </>}
    </div>
  );
}
