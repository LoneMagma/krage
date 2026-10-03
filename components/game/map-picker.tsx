import {MapDiagram} from './map-diagram';
const names=['DUNE','SNOW','CELL I','CELL II'];
export function MapPicker({value,onChange,disabled=false}:{value:number;onChange:(id:number)=>void;disabled?:boolean}){return <div className="map-cards" aria-label="Choose map">{names.map((name,id)=><button key={name} disabled={disabled} aria-pressed={value===id} onClick={()=>onChange(id)} className={'map-card map-card-'+id}><MapDiagram id={id}/><strong>{name}</strong></button>)}</div>}
