/** Must be invoked from a user's Play/Fullscreen click. Unsupported browsers stay usable. */
export async function enterGameDisplay(){
 try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();}catch{}
 if(matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0){
  try{await (screen.orientation as ScreenOrientation & {lock?:(v:string)=>Promise<void>})?.lock?.('landscape');}catch{}
 }
}

/** Follow the visible viewport when browser chrome or the software keyboard changes. */
export function observeVisualViewport(){
 const root=document.documentElement,viewport=window.visualViewport;
 const update=()=>{root.style.setProperty('--visible-height',`${viewport?.height??innerHeight}px`);root.style.setProperty('--visible-top',`${viewport?.offsetTop??0}px`);};
 update();window.addEventListener('resize',update);viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);
 return()=>{window.removeEventListener('resize',update);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);root.style.removeProperty('--visible-height');root.style.removeProperty('--visible-top');};
}
