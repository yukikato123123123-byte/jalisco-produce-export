import {useEffect,useRef} from 'react';
import {startPortalScene} from '../adminPortalEngine';

type SceneOptions={focused:boolean;burst:number};

export function AdminPortalScene({focused,burst}:SceneOptions){
 const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),key=useRef<HTMLDivElement>(null);
 const options=useRef({focused:false,burst:0,burstAt:-10000});const repaint=useRef<(()=>void)|null>(null);
 useEffect(()=>{
  if(options.current.burst!==burst)options.current.burstAt=performance.now();
  options.current.focused=focused;options.current.burst=burst;repaint.current?.();
 },[focused,burst]);
 useEffect(()=>{
  const node=host.current,c=canvas.current,k=key.current;if(!node||!c||!k)return;
  const engine=startPortalScene(node,c,k,options);repaint.current=engine.repaint;
  return()=>{engine.dispose();repaint.current=null;};
 },[]);
 return <div className="portal-visual" ref={host} aria-hidden="true"><canvas ref={canvas}/><div className="portal-key" ref={key}><svg className="portal-key-object" viewBox="0 0 240 520" fill="none">
  <defs><linearGradient id="portal-glass" x1="50" y1="70" x2="180" y2="430" gradientUnits="userSpaceOnUse"><stop stopColor="#d6f6fb" stopOpacity=".12"/><stop offset=".2" stopColor="#f5ffff" stopOpacity=".9"/><stop offset=".33" stopColor="#8294da" stopOpacity=".23"/><stop offset=".46" stopColor="#d9ffe3" stopOpacity=".75"/><stop offset=".58" stopColor="#607990" stopOpacity=".08"/><stop offset=".77" stopColor="#eafaff" stopOpacity=".9"/><stop offset="1" stopColor="#dcf28a" stopOpacity=".5"/></linearGradient><linearGradient id="portal-edge"><stop stopColor="#a5a3e8"/><stop offset=".3" stopColor="#f0fffa"/><stop offset=".7" stopColor="#79decf"/><stop offset="1" stopColor="#d8ed81"/></linearGradient><linearGradient id="portal-shaft"><stop stopColor="#b7eff7" stopOpacity=".12"/><stop offset=".24" stopColor="#f5ffe5" stopOpacity=".9"/><stop offset=".43" stopColor="#a1e5ce" stopOpacity=".1"/><stop offset=".8" stopColor="#e9f8ff" stopOpacity=".8"/><stop offset="1" stopColor="#c8dd79" stopOpacity=".2"/></linearGradient></defs>
  <g transform="translate(9 7)" opacity=".5" stroke="#6da0a4" strokeWidth="3"><ellipse cx="120" cy="130" rx="72" ry="91"/><path d="M103 216h34v129h37v24h-23v28h32v26h-46v57h-34Z"/></g>
  <ellipse cx="120" cy="130" rx="72" ry="91" stroke="url(#portal-glass)" strokeWidth="22"/>
  <ellipse cx="120" cy="130" rx="82" ry="101" stroke="url(#portal-edge)" strokeWidth="1.5"/>
  <ellipse cx="120" cy="130" rx="60" ry="79" stroke="#d9f3e9" strokeOpacity=".8" strokeWidth="2"/>
  <path d="M103 216h34v129h37v24h-23v28h32v26h-46v57h-34Z" fill="url(#portal-shaft)" stroke="url(#portal-edge)" strokeWidth="2"/>
  <path d="M112 224v247m16-245v114m0 90v41M142 351h25m-20 54h28" stroke="#f6ffe5" strokeOpacity=".8"/>
  <path d="M115 238v212" stroke="#d7ef81" strokeWidth="3" opacity=".8"/>
  <path d="M54 111c3-32 24-62 50-70m-34 126c8 22 24 37 40 42m31-158c18 10 36 33 40 57" stroke="#f4ffff" strokeWidth="3" strokeLinecap="round" opacity=".8"/>
  <path d="m120 2 12 28-12 12-12-12Z" fill="url(#portal-shaft)" stroke="#ddf59b"/>
  <path d="M120 4v35" stroke="#f4ffd9"/>
 </svg></div></div>;
}
