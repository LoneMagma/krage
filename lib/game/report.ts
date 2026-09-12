export type Standing = {
  id: number;
  team: number;
  kills: number;
  deaths: number;
};
/** Outcome follows frag rules only; bonus points cannot turn a draw into a win. */
export function matchReport(mode: number, rows: Standing[], teams: number[]) {
  const player = rows.find((a) => a.id === 0);
  const own = mode >= 2 ? (teams[0] ?? 0) : (player?.kills ?? 0);
  const rival =
    mode >= 2
      ? (teams[1] ?? 0)
      : Math.max(0, ...rows.filter((a) => a.id !== 0).map((a) => a.kills));
  const top = Math.max(0, ...rows.map((a) => a.kills));
  const tiedLeaders = rows.filter((a) => a.kills === top).length > 1;
  const outcome =
    mode >= 2
      ? own === rival
        ? 'draw'
        : own > rival
          ? 'victory'
          : 'defeat'
      : tiedLeaders
        ? 'draw'
        : own >= rival
          ? 'victory'
          : 'defeat';
  return {
    outcome,
    own,
    rival,
    rank: 1 + rows.filter((a) => a.kills > (player?.kills ?? 0)).length,
    kd: (player?.kills ?? 0) / Math.max(1, player?.deaths ?? 0),
  };
}
