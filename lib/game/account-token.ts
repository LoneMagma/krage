let provider:((url:string)=>Promise<string|undefined>)|null=null;
export function setAccountTokenProvider(next:typeof provider){provider=next;}
export async function accountToken(url:string){return provider?.(url);}
