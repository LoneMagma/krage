/** Icofy-compatible name hashing/patterns, adapted from icofy.pacify.site's public generator. */
export function identicon(name:string){
 const text=name.normalize('NFC').trim()||'Player';let hash=5381;for(let i=0;i<text.length;i++)hash=(((hash<<5)+hash)^text.charCodeAt(i))>>>0;
 const random=(n:number)=>{const v=Math.sin(n+1)*10000;return v-Math.floor(v)};let seed=hash;const style=Math.floor(random(seed++)*4),cells:number[][]=[];
 for(let y=0;y<5;y++){const row:number[]=[];for(let x=0;x<3;x++){const r=random(seed++);row.push(style===0?Number(r>.55):style===1?(x===1&&y===2?(r>.3?2:0):Number(r>.45)):style===2?Number(r>.65):Number(r>((x===0||y===0||y===4)?.45:.72)));}cells.push([...row,row[1],row[0]]);}
 return {cells,color:`hsl(${(hash*137.508)%360} ${52+hash%22}% ${50+((hash>>8)%14)}%)`,accent:`hsl(${((hash+1)*137.508)%360} 65% 65%)`};
}
