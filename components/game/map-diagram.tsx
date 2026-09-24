import { makeMap } from '@/lib/game/core';
const maps = [makeMap(0), makeMap(1), makeMap(2), makeMap(3)];
export function MapDiagram({ id }: { id: number }) {
  const map = maps[id];
  return (
    <svg
      className={'map-diagram diagram-' + id}
      viewBox={`0 0 ${map.width} ${map.depth}`}
      aria-label={`${map.name} layout`}
    >
      {map.blocks
        .filter((b) => b.kind !== 'step' && b.kind !== 'detail-collision' && b.kind !== 'ceiling')
        .map((b, i) => (
          <rect
            key={i}
            x={b.x + map.width / 2 - b.w / 2}
            y={b.z + map.depth / 2 - b.d / 2}
            width={b.w}
            height={b.d}
            fill={b.color}
            opacity={['roof','canopy','lintel','platform','pipebridge'].includes(b.kind??'') ? .24 : 1}
            stroke={id !== 1 ? '#d5ae77' : '#b9e2f2'}
            strokeWidth=".2"
          />
        ))}
    </svg>
  );
}
