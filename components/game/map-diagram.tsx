import { makeMap } from '@/lib/game/core';
const maps = [makeMap(0), makeMap(1), makeMap(2), makeMap(3)];
const palettes=[['#342c23','#ad956d','#e4ce9d','#638b80'],['#253b4b','#93aebd','#e1edf0','#d39265'],['#253c37','#83a899','#d8dcc4','#dcaf76'],['#28364c','#8da4c2','#dce3ed','#bca0ce']];
/** The actual shared collision layout, with route surfaces and distinct biome palettes. */
export function MapDiagram({ id }: { id: number }) {
 const map=maps[id]??maps[0], [ground,wall,edge,accent]=palettes[map.id];
 const offset=`translate(${map.width/2} ${map.depth/2})`;
 return <svg className={'map-diagram diagram-'+map.id} viewBox={`-2 -2 ${map.width+4} ${map.depth+4}`} aria-label={`${map.name} arena layout`}>
  <title>{map.name}: {map.id===0?'pump courtyard, market and reservoir':map.id===1?'warehouse, exterior gallery and snow route':'compact arena'}</title>
  <rect width={map.width} height={map.depth} rx="2" fill={ground}/>
  <g transform={offset}>
   {map.id===0&&<g fill="none" stroke={accent} strokeWidth="3" opacity=".35"><path d="M-26 -13V10L-17 16H4L11 7V-10L8 -16H-18Z"/><path d="M-3 0V16H-9V26"/></g>}
   {map.id===1&&<g fill="none" stroke={accent} strokeWidth="3" opacity=".4"><path d="M-6 -25V10L-8 23H10L27 12V-14"/><path d="M-24 12V-6H6"/></g>}
   {map.blocks.filter(b=>!['detail-collision','roof','ceiling','canopy','lintel','beam'].includes(b.kind??'')).map((b,i)=>{
    const raised=['platform','pipebridge','bridge'].includes(b.kind??'');
    return <rect key={i} x={b.x-b.w/2} y={b.z-b.d/2} width={b.w} height={b.d} fill={raised?accent:b.kind==='step'?edge:wall} opacity={raised?.6:b.kind==='step'?.45:1} stroke={edge} strokeWidth={raised?.2:.12}/>;
   })}
   {map.id===0&&<g fill="none" stroke={edge} strokeWidth=".45"><circle cx="-1" cy="-10" r="1.1"/><circle cx="20.5" cy="-17" r="1"/></g>}
   {map.id===1&&<g fill="none" stroke={edge} strokeWidth=".45"><rect x="-9" y="-9" width="6" height="6"/><path d="M-21.5 -9V-13H-6" stroke={accent} strokeWidth="1"/></g>}
  </g>
  <rect width={map.width} height={map.depth} rx="2" fill="none" stroke={edge} strokeWidth=".45" opacity=".75"/>
 </svg>;
}
