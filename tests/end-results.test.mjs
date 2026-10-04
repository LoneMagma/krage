import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
// Run the real snapshot handler without allocating WebGL or an audio device.
const source=fs.readFileSync(new URL('../lib/game/engine.ts',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  receiveRoom(snapshot:'),source.indexOf('  stepOnline(dt:'));
const compiled=ts.transpileModule(`class Harness {${method}};globalThis.Harness=Harness;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
test('ended snapshots do not close a player-opened scoreboard',()=>{
 const context={document:{pointerLockElement:null}};vm.runInNewContext(compiled,context);
 const arena=new context.Harness();let visible=true,resets=0;
 Object.assign(arena,{phase:'playing',network:{accept:()=>true},match:{ended:true,player:{alive:true}},processEvents(){},completeMatch(){},emit(){},onScoreboard(value){visible=value;resets++;}});
 arena.receiveRoom({});assert.equal(visible,false);assert.equal(resets,1);
 visible=true;for(let i=0;i<120;i++)arena.receiveRoom({});
 assert.equal(visible,true);assert.equal(resets,1);
});
