/** Must be invoked from a user's Play/Fullscreen click. Unsupported browsers stay usable. */
export async function enterGameDisplay(){
 try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();}catch{}
 if(matchMedia('(pointer: coarse)').matches){
  try{await (screen.orientation as ScreenOrientation & {lock?:(v:string)=>Promise<void>})?.lock?.('landscape');}catch{}
 }
}
