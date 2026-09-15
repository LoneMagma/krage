import Image from 'next/image';
import { useId } from 'react';
import { WEAPON_COLORS } from '@/lib/game/palette';

export function KrageLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="krage-logo" aria-label="kRAGE">
      <Image unoptimized src="/krage-logo.png" width="52" height="52" alt="" />
      {!compact && <span className="brand-name">kRAGE</span>}
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
    wood = finish === 4 ? '#24363b' : finish === 1 ? '#dce7ec' : finish === 2 ? '#e78851' : finish === 3 ? '#ac8cf5' : '#a6643f',
    steel = finish === 4 ? '#657c83' : finish === 1 ? '#bacbdc' : finish === 2 ? '#8e614d' : finish === 3 ? '#726494' : '#65778e';
  return (
    <svg viewBox="0 0 240 88" aria-hidden="true" className="weapon-glyph">
      <defs>
        <linearGradient id={key} x2="0" y2="1">
          <stop stopColor="#b6c5d8" />
          <stop offset="0.48" stopColor={steel} />
          <stop offset="1" stopColor="#293a50" />
        </linearGradient>
      </defs>
      {finish===4&&<path d="M92 39H154M97 43H145" stroke={accent} strokeWidth="3"/>}
      <path d="M18 78H222" stroke="#a4bacb" opacity="0.15"/>
      <g stroke="#101b2c" strokeWidth="1.5" strokeLinejoin="round">
        {id === 3 ? (
          <>
            <path fill="#b8c9dc" d="m93 36 113-8 25 10-26 13H93z" />
            <path fill="#e9f3ff" stroke="none" d="m103 38 118 1-21 7h-97z" />
            <path fill="#314459" d="M14 34h72v20H14zM85 24h10v39H85z" />
            {[24, 36, 48, 60, 72].map((x) => (
              <path key={x} d={`M${x} 36v15`} stroke="#a9b9cd" />
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
    </svg>
  );
}
