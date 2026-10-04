import { Children, isValidElement, useRef, type ReactNode, type SelectHTMLAttributes } from 'react';
type Props=Omit<SelectHTMLAttributes<HTMLSelectElement>,'onChange'> & {compact?:boolean;onChange?:(value:string)=>void};
/** Compact keyboard-accessible choices, with no browser dropdown popup. */
export function GameChoice({compact=false,children,value,onChange,disabled,className,'aria-label':label}:Props){
 const host=useRef<HTMLFieldSetElement>(null);
 const options=Children.toArray(children).filter(isValidElement<{value?:string|number;disabled?:boolean;children?:ReactNode}>).map(child=>({value:String(child.props.value??(typeof child.props.children==='string'||typeof child.props.children==='number'?child.props.children:'')),label:child.props.children,disabled:child.props.disabled}));
 if(compact){
 const available=options.filter(o=>!o.disabled),index=Math.max(0,available.findIndex(o=>o.value===String(value))),current=available[index];
 const step=(direction:number)=>{if(!disabled&&available.length)onChange?.(available[(index+direction+available.length)%available.length].value);};
 return <fieldset className={'choice-stepper '+(className??'')} aria-label={label??'Selection'}>
 <details className="choice-menu"><summary aria-label={label??'Choose value'} aria-disabled={disabled} onClick={e=>{if(disabled)e.preventDefault();}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}}}>{current?.label}<svg className="choice-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></summary><div className="choice-options">{options.map(o=><button type="button" key={o.value} disabled={disabled||o.disabled} aria-pressed={String(value)===o.value} onClick={e=>{onChange?.(o.value);e.currentTarget.closest('details')?.removeAttribute('open');}}>{o.label}</button>)}</div></details>
 </fieldset>;
 }
 return <fieldset ref={host} className={'game-choice '+(className??'')} aria-label={label??'Selection'}>{options.map((o,i)=><button type="button" key={o.value} disabled={disabled||o.disabled} aria-pressed={String(value)===o.value} tabIndex={String(value)===o.value||(!options.some(x=>x.value===String(value))&&i===0)?0:-1} onClick={()=>onChange?.(o.value)} onKeyDown={e=>{
  if(disabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();const available=options.filter(o=>!o.disabled);if(!available.length)return;
  const index=Math.max(0,available.findIndex(o=>o.value===String(value)));
  const next=e.key==='Home'?0:e.key==='End'?available.length-1:(index+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+available.length)%available.length;
  onChange?.(available[next].value);host.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')[next]?.focus();
 }}>{o.label}</button>)}</fieldset>;
}
