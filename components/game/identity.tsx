import Image from 'next/image';
import { useId } from 'react';
import { WEAPON_COLORS } from '@/lib/game/palette';

/** Front-facing 3D cube mark — square toward camera, K stamp above. */
export function KrageBlockMark({ size = 52 }: { size?: number }) {
  return (
    <svg
      className="krage-block-mark"
      width={size}
      height={size * (148 / 128)}
      viewBox="0 0 128 148"
      fill="none"
      aria-hidden="true"
    >
      <g transform="translate(64 22)">
        <path
          d="M-20 -12 L20 -12 L24 -4 L20 10 L-20 10 L-24 -4 Z"
          fill="none"
          stroke="#E8956A"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M-9 -7 L-9 6 M-9 0 L7 -7 M-9 0 L7 6"
          stroke="#E8ECF0"
          strokeWidth="3"
          strokeLinecap="square"
        />
        <circle cx="13" cy="-1" r="2.2" fill="#E8956A" />
      </g>
      <g transform="translate(64 86)">
        <ellipse cx="2" cy="42" rx="40" ry="7" fill="#000" opacity="0.3" />
        <path d="M-36 -36 L0 -52 L36 -36 L0 -20 Z" fill="#5a6874" />
        <path d="M36 -36 L36 20 L0 36 L0 -20 Z" fill="#2a343e" />
        <path d="M-36 -36 L0 -20 L0 36 L-36 20 Z" fill="#3a4550" />
        <path d="M-28 -24 L-6 -14 L-6 18 L-28 8 Z" fill="#1a222b" />
        <path d="M-28 -24 L-6 -14 L-6 18 L-28 8 Z" fill="none" stroke="#E8956A" strokeWidth="1.8" />
        <path d="M-17 -12 V8 M-26 -2 H-8" stroke="#E8956A" strokeWidth="1.7" strokeLinecap="square" />
        <path d="M-14 -40 L0 -46 L14 -40" fill="none" stroke="#E8956A" strokeWidth="2" strokeLinecap="square" />
        <path d="M-32 12 L-4 24 L-4 28 L-32 16 Z" fill="#E8956A" />
        <path
          d="M-36 -36 L0 -20 L36 -36 M0 -20 L0 36 M-36 20 L0 36 L36 20"
          fill="none"
          stroke="#1a222b"
          strokeWidth="1"
          opacity="0.5"
        />
      </g>
    </svg>
  );
}

export function KrageLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="krage-logo" aria-label="kRAGE">
      <Image
        unoptimized
        src="/krage-logo.png"
        width={compact ? 40 : 52}
        height={compact ? 40 : 52}
        alt=""
        className="krage-logo-mark"
        priority
      />
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
      <g stroke="#101b24" strokeWidth="1.6" strokeLinejoin="round">
        {id===0 ? <>
          <path d="M16 32H58V44H29V60H16Z" fill={wood}/>
          <path d="M53 26H159L171 35V51H120L111 60H78L70 50H53Z" fill={`url(#${key})`}/>
          <path d="M88 49H109V78H88ZM64 49H78L73 70H60Z" fill="#26353d"/>
          <path d="M167 33H208V45H167ZM208 31H220V47H208Z" fill={steel}/>
          <path d="M62 21H143V27H62ZM150 20H156V31H150Z" fill="#26353d"/>
          <path d="M70 34H108M124 35H149" stroke={finish?accent:'#b6c6ce'} strokeWidth="3"/>
          <path d="M94 55V72M102 55V72" stroke="#60757e"/>
        </> : id===1 ? <>
          <path d="M9 39 46 27 60 34 55 55 38 54 9 68Z" fill={wood}/>
          <path d="M56 30H139V52H58ZM63 24H131V31H63Z" fill={`url(#${key})`}/>
          <path d="M138 31H181V50H138ZM72 51H88L81 76H68Z" fill={wood}/>
          <path d="M103 51H121Q122 68 138 77L125 85Q107 74 103 51Z" fill="#2b3d45"/>
          <path d="M180 35H231V42H180ZM199 21H204V35H199ZM139 24H185V29H139Z" fill={steel}/>
          <path d="M110 56Q114 71 129 79M67 35H125" fill="none" stroke="#9eafb3"/>
          <path d="M146 35V46M159 35V46M172 35V46" stroke="#403329" strokeWidth="2"/>
          <path d="M86 52Q93 65 103 52" fill="none" stroke={steel}/>
        </> : id===2 ? <>
          <path d="M10 43 47 29 66 36 61 57 42 55 10 73Z" fill={wood}/>
          <path d="M61 31H102V53H62Z" fill={`url(#${key})`}/>
          <path d="M101 27H225V39H101ZM101 40H225V50H101Z" fill={steel}/>
          <path d="M104 49H181L173 59H110Z" fill={wood}/>
          <path d="M111 30H218M112 43H218" stroke="#d0dce0" strokeWidth="2"/>
          <path d="M216 27V49" stroke="#17272e" strokeWidth="4"/>
          <path d="M72 53Q82 70 99 53M86 52V61" fill="none" stroke={steel}/>
          <path d="M202 21H208V27H202Z" fill="#d9c5a4"/>
        </> : finish===6 ? <>
          <circle cx="30" cy="44" r="16" fill="none" stroke="#d9b166" strokeWidth="6"/>
          <path d="M47 31 117 35 115 57 47 53Z" fill="#263840"/>
          <path d="M115 35C170 4 219 30 219 73C200 49 166 41 115 57Z" fill="#d9b166"/>
          <path d="M136 35Q175 22 204 45" fill="none" stroke="#fff0ca"/>
          <path d="M63 35V51M82 36V53M101 38V54" stroke="#667d83" strokeWidth="3"/>
        </> : <>
          <path d="M94 34 198 28 231 38 203 53H94Z" fill={finish===4?'#647e89':'#b8c9dc'}/>
          <path d="M104 42 224 39 202 49H104Z" fill="#e5eff0" stroke="none"/>
          <path d="M15 33H86V55H15ZM85 24H95V64H85Z" fill={finish===4?'#263c45':'#314459'}/>
          <path d="M27 37V51M42 37V51M57 37V51M72 37V51" stroke={finish===4?'#659c9b':'#7f969e'} strokeWidth="3"/>
          <path d="M107 36 188 33" stroke="#9bbfc0" strokeWidth="2"/>
        </>}
      </g>
      {finish===5&&id<3&&<g stroke={['#85f4dd','#f5ce78','#e7d8b2'][id]} fill="none"><path d="M82 34H149M88 38H144" strokeWidth="2"/><path d="M109 42l5 4-5 4-5-4Z" strokeWidth="2"/><path d="M157 47l5-6m1 6 5-6m1 6 5-6" strokeWidth="1.5"/></g>}
    </svg>
  );
}

/** A stamped K inside an open credit token. */
export function KrCredit(){return <svg className="kr-credit" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28 9v14l-12 7L4 23V9Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M10 9h4v6l6-6h5l-8 8 8 7h-6l-5-5v5h-4Z" fill="currentColor"/><path d="M26 5v5M23 7.5h6" stroke="currentColor" strokeWidth="1.5"/></svg>;}

export function QualityPreview({level}:{level:0|1|2}){
 return <svg className="quality-scene" viewBox="0 0 92 48" aria-hidden="true"><rect width="92" height="48" rx="5" fill={level===0?'#34464b':level===1?'#5c777c':'#81999b'}/><path d="M0 34 22 16 44 31 68 13 92 30V48H0Z" fill="#9aa89e"/><path d="M0 41 30 30 54 39 92 28V48H0Z" fill="#6e8176"/><path d="M36 25 50 19 65 25V42H36Z" fill="#d2b789"/><path d="M50 19V42H65V25Z" fill="#8b765f"/>{level>0&&<><path d="M65 42 85 35 70 30 60 34Z" fill="#23323c" opacity=".45"/><path d="M41 32H46V38H41ZM55 28H60V33H55Z" fill="#384a51"/></>}{level===2&&<><circle cx="74" cy="10" r="4" fill="#f3dab0"/><path d="M12 12 20 10 30 12M38 7 50 6 57 8" stroke="#e0e7dc" strokeWidth="2"/><path d="M39 28H47M53 35H62M40 40H47" stroke="#bba17b"/></>}</svg>;
}
export function CrosshairPreview({color}:{color:string}){
 return <svg className="aim-preview" viewBox="0 0 40 28" aria-hidden="true"><g stroke={color} strokeWidth="2"><path d="M20 4v6m0 8v6M10 14h6m8 0h6"/></g><circle cx="20" cy="14" r="1" fill={color}/></svg>;
}
