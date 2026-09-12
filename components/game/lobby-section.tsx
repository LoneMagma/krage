import { useEffect, useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export function LobbySection({open,playing,title,kind,onClose,children}: {open:boolean;playing:boolean;title:string;kind:string;onClose:()=>void;children:ReactNode}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(open&&!playing) heading.current?.focus();},[open,playing,kind]);
  useEffect(()=>{if(!open||playing)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented)onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[open,playing,onClose]);
  if(playing)return <Dialog open={open} onOpenChange={v=>{if(!v)onClose();}}><DialogContent className={'rift-dialog '+kind+'-dialog'}><DialogTitle>{title}</DialogTitle><DialogDescription className="sr-only">{title}</DialogDescription>{children}</DialogContent></Dialog>;
  if(!open)return null;
  return <section className={'lobby-section section-'+kind} aria-label={title}><header><div><span className="eyebrow">kRAGE</span><h2 tabIndex={-1} ref={heading}>{title}</h2></div><button onClick={onClose} aria-label="Return to play">BACK TO PLAY ↗</button></header><div className="lobby-section-body" key={kind}>{children}</div></section>;
}
