import Image from 'next/image';
import { useId } from 'react';
import { WEAPON_COLORS } from '@/lib/game/palette';

export function KrageLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="krage-logo" aria-label="kRAGE">
      <Image unoptimized src="/krage-logo.png" width="52" height="52" alt="" />
      {!compact && <span className="brand-name">KRAGE</span>}
    </span>
  );
}

/** Detailed, scalable side elevations used consistently in lobby, spawn and HUD. */
export function WeaponGlyph({
  id,
  finish = 0,
}: {
  id: number;
  finish?: number;
}) {
  const key = useId().replace(/:/g, ''),
    accent = WEAPON_COLORS[id],
    wood = finish === 6 ? ['#273239','#394748','#c5d1ca','#39434a'][id] : finish === 5 ? ['#25414a','#292d32','#26363f'][id] : finish === 4 ? '#24363b' : finish === 1 ? '#dce7ec' : finish === 2 ? '#e78851' : finish === 3 ? '#ac8cf5' : '#a6643f',
    steel = finish === 6 ? ['#acbeba','#ded6be','#adcbd0','#d9b166'][id] : finish === 5 ? ['#d7e4e0','#d5ad62','#c3ced2'][id] : finish === 4 ? '#657c83' : finish === 1 ? '#bacbdc' : finish === 2 ? '#8e614d' : finish === 3 ? '#726494' : '#65778e';
  return (
    <svg viewBox="0 0 240 88" aria-hidden="true" className="weapon-glyph">
      <defs>
        <linearGradient id={key} x2="0" y2="1">
          <stop stopColor="#b6c5d8" />
          <stop offset="0.48" stopColor={steel} />
          <stop offset="1" stopColor="#293a50" />
        </linearGradient>
      </defs>
      {finish===4&&id<3&&<path d="M92 39H154M97 43H145" stroke={accent} strokeWidth="3"/>}
      <path d="M18 78H222" stroke="#a4bacb" opacity="0.15"/>
      <g stroke="#101b2c" strokeWidth="1.5" strokeLinejoin="round">
        {id === 3 && finish===6 ? (
          <><circle cx="31" cy="43" r="17" fill="none" stroke="#d9b166" strokeWidth="7"/>
          <path fill="#293a42" d="M49 30 117 34 115 57 47 53z"/>
          <path fill="#d9b166" d="M114 33C174 1 220 31 219 73C204 49 173 39 115 57z"/>
          <path d="M132 36Q178 17 207 45" fill="none" stroke="#fff0c2"/>
          <path d="M63 34v17m16-16v17m16-16v17" stroke="#718287" strokeWidth="4"/></>
        ) : id === 3 ? (
          <>
            <path fill={finish===4?'#647e89':'#b8c9dc'} d="m93 36 113-8 25 10-26 13H93z" />
            <path fill="#e9f3ff" stroke="none" d="m103 38 118 1-21 7h-97z" />
            <path fill={finish===4?'#263c45':'#314459'} d="M14 34h72v20H14zM85 24h10v39H85z" />
            {finish===4&&<path d="M105 35 194 32" stroke="#9bbfc0" strokeWidth="2"/>}
            {[24, 36, 48, 60, 72].map((x) => (
              <path key={x} d={`M${x} 36v15`} stroke={finish===4?'#659c9b':'#a9b9cd'} />
            ))}
          </>
        ) : (
          <>
            {id === 0 ? (
              <>
                <path fill="#4a6078" d="M13 27h44v10H24v18H13z" />
                <path
                  fill={`url(#${key})`}
                  d="M54 25h96l12 9v16h-40l-5 14H89l-5-14H54z"
                />
                <path fill="#273b52" d="m90 46 24 1-3 31H92z" />
                <path fill="#71859b" d="M151 32h50v13h-50zM201 30h14v17h-14z" />
                <path fill={accent} d="M59 28h7v18h-7zM128 29h23v7h-23z" />
                <path fill="#344961" d="M80 18h58v7H80zM150 19h6v12h-6z" />
                <path d="M72 32h35v9H72z" fill="#142330"/>
                {[82,92,102,112,122,132].map(x=><path key={x} d={`M${x} 18v5`} stroke="#c9d5df"/>) }
                <path d="M20 31h30M20 52l28-14" stroke="#a8b9c8" fill="none"/>
                <path d="M95 53v18M101 53v18M107 53v18" stroke="#576e83"/>
              </>
            ) : id === 1 ? (
              <>
                <path fill={wood} d="m10 37 44-11 13 7-4 21H41L10 65z" />
                <path fill={`url(#${key})`} d="M59 30h82v22H61z" />
                <path fill={wood} d="M139 30h43v20h-43z" />
                <path fill="#65798e" d="M180 35h48v8h-48zM193 20h6v16h-6z" />
                <path
                  fill="#33465c"
                  d="m109 50 16-1 3 16 12 11-11 8-15-15zM79 50h17l-7 27H75z"
                />
                <path fill="#92a3b6" d="M66 24h68v6H66z" />
                <path d="M70 27h58M67 48h35M183 37h40" stroke="#d5dedc" opacity="0.6"/>
                <path d="M98 37h26v6H98z" fill="#23333c"/>
                <circle cx="90" cy="43" r="1.8" fill="#cad0ca"/>
                <path d="m17 43 25-8M18 48l23-8" stroke="#c49c73" opacity="0.65"/>
                <path fill={accent} d="M144 32h32v4h-32z" />
                {[149, 158, 167].map((x) => (
                  <path key={x} d={`M${x} 39v8`} stroke="#523927" />
                ))}
                <path
                  d="m115 56 4 13 12 10M77 33h40"
                  fill="none"
                  stroke="#98a9bd"
                />
              </>
            ) : (
              <>
                <path fill={wood} d="m9 42 49-14 15 9-3 23-20-3L9 72z" />
                <path
                  fill={`url(#${key})`}
                  d="M61 31h41v25H64zM101 28h124v10H101zM101 40h124v10H101z"
                />
                <path fill={wood} d="M100 51h81l-12 12h-58z" />
                <path d="M108 30h111M108 42h111" stroke="#dbe3e6" opacity="0.7"/>
                <path d="m69 39 15-4 9 6-10 9-13-4z" fill="none" stroke="#bda77f"/>
                <path d="M217 29v8M217 41v8" stroke="#263441" strokeWidth="3"/>
                <path fill="#2b3c52" d="m72 54 16 3-9 20H65z" />
                <path fill={accent} d="M65 35h30v5H65z" />
                <path fill="#b9cadd" d="M208 23h6v5h-6z" />
                <path d="M111 55h57" stroke="#d6ab7b" />
              </>
            )}
            <path
              d="M95 53q15 15 24 0"
              fill="none"
              stroke="#a3b5c9"
              strokeWidth="2"
            />
            <path d="M73 34h12" stroke="#e2eaf3" strokeWidth="2" />
            <circle cx="72" cy="44" r="2" fill="#d5e0ec" />
          </>
        )}
      </g>
      {finish===5&&id<3&&<g stroke={['#85f4dd','#f5ce78','#e7d8b2'][id]} fill="none"><path d="M82 34H149M88 38H144" strokeWidth="2"/><path d="M109 42l5 4-5 4-5-4Z" strokeWidth="2"/><path d="M157 47l5-6m1 6 5-6m1 6 5-6" strokeWidth="1.5"/></g>}
    </svg>
  );
}

/** A stamped K inside an open credit token. */
export function KrCredit(){return <svg className="kr-credit" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28 9v14l-12 7L4 23V9Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M10 9h4v6l6-6h5l-8 8 8 7h-6l-5-5v5h-4Z" fill="currentColor"/><path d="M26 5v5M23 7.5h6" stroke="currentColor" strokeWidth="1.5"/></svg>;}

export function QualityPreview({level}:{level:0|1|2}){
 return <svg className="quality-scene" viewBox="0 0 92 48" aria-hidden="true"><rect width="92" height="48" rx="6" fill={level===0?'#243b47':level===1?'#466d79':'#6c94a0'}/><path d="M0 34 24 16 42 31 68 13 92 31V48H0z" fill="#8b9e99"/><path d="M0 40 30 30 54 39 92 28V48H0z" fill="#677a6f"/><path d="m36 25 14-6 15 6v17H36z" fill="#d2b789"/><path d="M50 19v23h15V25z" fill="#8b765f"/>{level>0&&<><path d="M65 42 85 35 70 30 60 34z" fill="#23323c" opacity=".45"/><path d="M41 32h5v6h-5zm14-4h5v5h-5z" fill="#384a51"/></>}{level===2&&<><circle cx="73" cy="10" r="4" fill="#f3dab0"/><path d="m12 12 8-2 10 2m8-5 12-1 7 2" stroke="#d4e4df" strokeWidth="3"/><path d="M38 39h10m6-2h8M38 29h10" stroke="#ead4b0" strokeWidth="1.4"/></>}</svg>;
}
export function CrosshairPreview({color}:{color:string}){
 return <svg className="aim-preview" viewBox="0 0 70 48" aria-hidden="true"><rect width="70" height="48" rx="6" fill="#14232e"/><path d="m0 40 25-12 45 12M35 28V6" stroke="#34505b" strokeWidth="1"/><g stroke="#071017" strokeWidth="5"><path d="M35 12v7m0 10v7M22 24h7m12 0h7"/></g><g stroke={color} strokeWidth="2"><path d="M35 12v7m0 10v7M22 24h7m12 0h7"/></g><circle cx="35" cy="24" r="1.4" fill={color}/></svg>;
}
