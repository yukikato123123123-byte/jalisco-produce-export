// Lightweight public-brand scene; no authentication, data access or external assets.
export function startHomeAtmosphere(host:HTMLDivElement,canvas:HTMLCanvasElement){
 const ctx=canvas.getContext('2d');if(!ctx)return()=>{};
 const media=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)');
 let w=1,h=1,raf=0,last=0,frame=0,reduced=media.matches,visible=true,low=false,depth=0,pointer={x:.7,y:.5},pulse=-10000;
 const seeds=Array.from({length:100},(_,i)=>({x:((i*617+53)%997)/997,y:((i*397+97)%991)/991,z:.3+((i*37)%100)/100}));
 function draw(now:number){if(!ctx)return;const t=reduced?0:now*.001;ctx.clearRect(0,0,w,h);const center=w*.7,spread=low?90:170;
  const glow=ctx.createRadialGradient(pointer.x*w,pointer.y*h,0,pointer.x*w,pointer.y*h,w*.55);glow.addColorStop(0,'rgba(80,204,189,.13)');glow.addColorStop(.45,'rgba(117,97,195,.04)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
  const gradient=ctx.createLinearGradient(center-spread,0,center+spread,h);gradient.addColorStop(0,'rgba(158,167,239,.22)');gradient.addColorStop(.4,'rgba(195,236,237,.4)');gradient.addColorStop(.7,'rgba(103,225,192,.22)');gradient.addColorStop(1,'rgba(204,224,153,.1)');ctx.strokeStyle=gradient;
  for(let j=0;j<(low?4:7);j++){ctx.lineWidth=j===0?18:1;ctx.globalAlpha=j===0?.16:.45;ctx.beginPath();for(let k=0;k<=70;k++){const u=k/70,y=u*h,x=center+Math.sin(u*7+t*.16+depth*.4+j*.03)*spread+Math.sin(u*14-t*.3)*9+(pointer.x-.5)*18+j*2;if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
  for(let i=0;i<(low?30:100);i++){const s=seeds[i];let x=s.x*w,y=(s.y*h-t*(4+s.z*7)+h*20)%h;const dx=x-pointer.x*w,dy=y-pointer.y*h,d=Math.max(1,Math.hypot(dx,dy)),push=Math.max(0,1-d/130)*12;x+=dx/d*push;y+=dy/d*push;ctx.globalAlpha=.1+s.z*.26;ctx.fillStyle=i%3===0?'#d7e9b1':i%3===1?'#b0dcd7':'#b1afdf';ctx.beginPath();ctx.arc(x,y,.4+s.z*.6,0,Math.PI*2);ctx.fill();}
  const p=(now-pulse)/1100;if(!reduced&&p>=0&&p<1){ctx.globalAlpha=(1-p)*.3;ctx.strokeStyle='#b4eadb';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(w*.65,h*.5,p*w*.5+10,p*h*.45+10,0,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';frame++;if(frame%12===0)host.dataset.frame=String(frame);
 }
 function tick(now:number){if(reduced||!visible||document.hidden)return;if(now-last>=(low?62:42)){draw(now);last=now;}raf=requestAnimationFrame(tick);}
 function restart(){cancelAnimationFrame(raf);reduced=media.matches;host.dataset.motion=reduced?'reduced':!visible||document.hidden?'paused':'running';if(reduced)draw(0);else if(visible&&!document.hidden)raf=requestAnimationFrame(tick);}
 function resize(){w=host.clientWidth;h=host.clientHeight;low=w<700||navigator.hardwareConcurrency<=4;const dpr=Math.min(devicePixelRatio||1,low?1.25:1.5);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);host.dataset.quality=low?'limited':'full';draw(reduced?0:performance.now());}
 function scroll(){const box=host.getBoundingClientRect();depth=Math.max(0,Math.min(1,-box.top/Math.max(h,1)));host.style.setProperty('--scene-scroll',String(reduced?0:depth));}
 function move(e:PointerEvent){if(reduced||!fine.matches||e.pointerType==='touch')return;const r=host.getBoundingClientRect();pointer={x:Math.max(0,Math.min(1,(e.clientX-r.left)/w)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/h))};}
 function click(e:MouseEvent){if((e.target as Element).closest('a'))pulse=performance.now();}
 const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;restart();});io.observe(host);
 host.parentElement?.addEventListener('pointermove',move,{passive:true});host.parentElement?.addEventListener('click',click);window.addEventListener('scroll',scroll,{passive:true});document.addEventListener('visibilitychange',restart);media.addEventListener('change',restart);resize();scroll();restart();
 return()=>{cancelAnimationFrame(raf);ro.disconnect();io.disconnect();host.parentElement?.removeEventListener('pointermove',move);host.parentElement?.removeEventListener('click',click);window.removeEventListener('scroll',scroll);document.removeEventListener('visibilitychange',restart);media.removeEventListener('change',restart);};
}
