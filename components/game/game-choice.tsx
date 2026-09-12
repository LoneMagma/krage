import { Children, isValidElement, useRef, type ReactNode, type SelectHTMLAttributes } from 'react';
type Props=Omit<SelectHTMLAttributes<HTMLSelectElement>,'onChange'> & {onChange?:(value:string)=>void};
/** Compact keyboard-accessible choices, with no browser dropdown popup. */
export function GameChoice({children,value,onChange,disabled,className,'aria-label':label}:Props){
 const host=useRef<HTMLFieldSetElement>(null);
 const options=Children.toArray(children).filter(isValidElement<{value?:string|number;disabled?:boolean;children?:ReactNode}>).map(child=>({value:String(child.props.value??(typeof child.props.children==='string'||typeof child.props.children==='number'?child.props.children:'')),label:child.props.children,disabled:child.props.disabled}));
 return <fieldset ref={host} className={'game-choice '+(className??'')} aria-label={label??'Selection'}>{options.map((o,i)=><button type="button" key={o.value} disabled={disabled||o.disabled} aria-pressed={String(value)===o.value} tabIndex={String(value)===o.value||(!options.some(x=>x.value===String(value))&&i===0)?0:-1} onClick={()=>onChange?.(o.value)} onKeyDown={e=>{
  if(disabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();const available=options.filter(o=>!o.disabled);if(!available.length)return;
  const index=Math.max(0,available.findIndex(o=>o.value===String(value)));
  const next=e.key==='Home'?0:e.key==='End'?available.length-1:(index+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+available.length)%available.length;
  onChange?.(available[next].value);host.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')[next]?.focus();
 }}>{o.label}</button>)}</fieldset>;
}
