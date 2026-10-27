// Bounded Canvas renderer; presentation strings remain in the React component.
export type PortalSceneState={focused:boolean;burst:number;burstAt:number};
const bits=['01001110','01001111','01010000','01000001','01001100'];
export function startPortalScene(node:HTMLDivElement,c:HTMLCanvasElement,k:HTMLDivElement,options:{current:PortalSceneState}){
  const ctx=c.getContext('2d',{alpha:true});if(!ctx){node.dataset.motion='unavailable';return {dispose(){},repaint(){}};}
  const media=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)');
  const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory??8;
  let w=1,h=1,dpr=1,frame=0,raf=0,last=0,reduced=media.matches,low=false;
  let anchor={x:0,y:0},pointer={x:-1000,y:-1000,active:false},tilt={x:0,y:0};
  const seeds=Array.from({length:260},(_,i)=>({x:((i*731)%997)/997,y:((i*347+93)%991)/991,z:.3+((i*173)%100)/100}));
  function resize(){
   w=node!.clientWidth;h=node!.clientHeight;low=w<700||navigator.hardwareConcurrency<=4||memory<=4;dpr=Math.min(devicePixelRatio||1,low?1.25:1.5);
   c!.width=Math.round(w*dpr);c!.height=Math.round(h*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);
   const rect=k!.getBoundingClientRect(),origin=node!.getBoundingClientRect();anchor={x:rect.left+rect.width/2-origin.left,y:rect.top+rect.height/2-origin.top};
   node!.dataset.quality=low?'limited':'full';draw(performance.now());
  }
  function draw(now:number){
   if(!ctx)return;const t=reduced?0:now*.001,progress=(now-options.current.burstAt)/1500;
   const pulse=reduced||progress<0||progress>1?0:progress<.2?progress/.2:(1-progress)/.8,wave=Math.max(0,(progress-.2)/.8);
   const pulseState=pulse>0?'active':'idle';if(node.dataset.pulse!==pulseState)node.dataset.pulse=pulseState;
   const rect=node!.getBoundingClientRect(),px=pointer.x-rect.left,py=pointer.y-rect.top;
   const near=pointer.active&&!reduced?Math.max(0,1-Math.hypot(px-anchor.x,py-anchor.y)/320):0;
   const targetX=pointer.active&&!reduced?Math.max(-9,Math.min(9,(py-anchor.y)*-.025)):0,targetY=pointer.active&&!reduced?Math.max(-12,Math.min(12,(px-anchor.x)*.025)):0;
   tilt.x+=(targetX-tilt.x)*.075;tilt.y+=(targetY-tilt.y)*.075;
   k!.style.setProperty('--tilt-x',`${tilt.x.toFixed(2)}deg`);k!.style.setProperty('--tilt-y',`${tilt.y.toFixed(2)}deg`);k!.style.setProperty('--key-glow',`${8+near*18+(options.current.focused?10:0)+pulse*15}px`);
   k!.dataset.near=near>.3?'true':'false';ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
   const aura=ctx.createRadialGradient(anchor.x,anchor.y,8,anchor.x,anchor.y,Math.min(w,850)*.55);aura.addColorStop(0,`rgba(79,202,175,${.07+near*.05+pulse*.04})`);aura.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=aura;ctx.fillRect(0,0,w,h);
   // Holographic water: layered, continuously deforming helix strips with spectral highlights.
   ctx.globalCompositeOperation='lighter';const spread=low?108:170,top=low?45:70,bottom=low?440:Math.min(h-70,820);
   // A translucent refractive membrane, with the thin spectral contours above it.
   const membrane=ctx.createLinearGradient(anchor.x-spread,top,anchor.x+spread,bottom);membrane.addColorStop(0,'rgba(178,181,243,.12)');membrane.addColorStop(.4,'rgba(186,236,228,.07)');membrane.addColorStop(.65,'rgba(238,250,245,.20)');membrane.addColorStop(1,'rgba(184,219,125,.07)');
   ctx.fillStyle=membrane;ctx.beginPath();
   for(let side=0;side<2;side++)for(let n=0;n<=90;n++){const u=side===0?n/90:1-n/90,phase=u*Math.PI*4.3+t*.24,y=top+u*(bottom-top),x=anchor.x+Math.sin(phase)*spread*(.7+.25*Math.sin(u*3))+Math.sin(u*16-t*.4)*8+(side===0?-1:1)*(8+9*Math.cos(phase)**2)+(pointer.active&&!reduced?(px-anchor.x)*.018*Math.sin(u*Math.PI):0);if(side===0&&n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();
   for(let layer=0;layer<(low?5:8);layer++){
    const gradient=ctx.createLinearGradient(anchor.x-spread,top,anchor.x+spread,bottom);gradient.addColorStop(0,'rgba(162,167,247,.18)');gradient.addColorStop(.35,'rgba(166,249,231,.50)');gradient.addColorStop(.55,'rgba(206,237,245,.75)');gradient.addColorStop(.8,'rgba(185,221,95,.27)');gradient.addColorStop(1,'rgba(95,218,230,.14)');
    ctx.strokeStyle=gradient;ctx.lineWidth=layer===0?15:layer===1?7:1.1;ctx.globalAlpha=layer<2?.22:1;ctx.beginPath();
    for(let n=0;n<=90;n++){const u=n/90,y=top+u*(bottom-top),phase=u*Math.PI*4.3+t*.24+layer*.06;let x=anchor.x+Math.sin(phase)*spread*(.7+.25*Math.sin(u*3))+Math.sin(u*16-t*.4)*8;
     if(pointer.active&&!reduced)x+=(px-anchor.x)*.018*Math.sin(u*Math.PI);x+=(layer-3)*2.2*Math.cos(phase);if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
    ctx.stroke();
   }
   ctx.globalAlpha=1;
   // Depth-coded binary streams: drift, pointer repulsion, and a transient key convergence.
   ctx.font=`${low?9:10}px ui-monospace,monospace`;
   for(let i=0;i<(low?11:24);i++){
    const s=seeds[i],depth=s.z,drift=(s.y*h+t*(8+depth*13))%(h+70)-35;let x=s.x*w,y=drift;
    if(pointer.active&&!reduced){const dx=x-px,dy=y-py,d=Math.max(1,Math.hypot(dx,dy)),force=Math.max(0,1-d/170)*22;x+=dx/d*force;y+=dy/d*force;}
    const d=Math.hypot(x-anchor.x,y-anchor.y),pull=Math.max(0,1-d/380)*(.035+near*.10)+pulse*.65;x+=(anchor.x-x)*pull;y+=(anchor.y-y)*pull;
    ctx.globalAlpha=(.08+depth*.12)*(.55+.45*Math.sin(t*.45+i)**2);ctx.fillStyle=i%3===0?'#d7e894':i%3===1?'#91c9c6':'#b5abdd';ctx.fillText(bits[i%5],x,y);
   }
   // Bounded powder/droplet particles are drawn in Canvas, never hundreds of DOM nodes.
   for(let i=0;i<(low?65:260);i++){
    const s=seeds[i];let x=i<40?s.x*w:anchor.x+65+(s.x-.5)*(low?210:360)+Math.sin(s.y*9+t*.13)*40,y=(s.y*h-t*(5+s.z*8)+h*20)%h;
    const d=Math.hypot(x-anchor.x,y-anchor.y),pull=Math.max(0,1-d/420)*(.04+near*.1)+pulse*.58;x+=(anchor.x-x)*pull;y+=(anchor.y-y)*pull;
    if(pointer.active&&!reduced){const dx=x-px,dy=y-py,dist=Math.max(1,Math.hypot(dx,dy)),push=Math.max(0,1-dist/110)*12;x+=dx/dist*push;y+=dy/dist*push;}
    ctx.globalAlpha=.12+s.z*.36;ctx.fillStyle=i%4===0?'#e5deaf':i%4===1?'#b9f9e3':'#b7c5ee';ctx.beginPath();ctx.arc(x,y,.5+s.z*.7,0,Math.PI*2);ctx.fill();
   }
   ctx.globalAlpha=1;
   // Quiet floor reflections and ripples connect the object to the environment.
   if(!low)for(let i=0;i<12;i++){const y=h-75+i*6;ctx.strokeStyle=`rgba(133,208,193,${.015+i*.003})`;ctx.lineWidth=1;ctx.beginPath();for(let n=0;n<=36;n++){const x=n*w/36,yy=y+Math.sin(n*.6+t*.35+i)*2;if(n===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();}
   if(pulse>0&&progress>=.2){ctx.strokeStyle=`rgba(172,245,220,${pulse*.45})`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(anchor.x,anchor.y,wave*460+30,wave*230+15,0,0,Math.PI*2);ctx.stroke();}
   ctx.globalCompositeOperation='source-over';frame++;if(frame%12===0)node!.dataset.frame=String(frame);
  }
  function tick(now:number){if(document.hidden||reduced)return;const interval=low?50:33;if(now-last>=interval){draw(now);last=now;}raf=requestAnimationFrame(tick);}
  function restart(){cancelAnimationFrame(raf);reduced=media.matches;node!.dataset.motion=reduced?'reduced':document.hidden?'paused':'running';if(reduced){tilt={x:0,y:0};draw(performance.now());}else if(!document.hidden){last=0;raf=requestAnimationFrame(tick);}}
  function move(e:PointerEvent){if(!fine.matches||e.pointerType==='touch'||reduced)return;pointer={x:e.clientX,y:e.clientY,active:true};}
  function leave(){pointer.active=false;}
  const observer=new ResizeObserver(resize);observer.observe(node);window.addEventListener('pointermove',move,{passive:true});document.documentElement.addEventListener('pointerleave',leave);media.addEventListener('change',restart);document.addEventListener('visibilitychange',restart);
  resize();restart();
  return {repaint(){if(reduced)draw(performance.now());},dispose(){cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',leave);media.removeEventListener('change',restart);document.removeEventListener('visibilitychange',restart);}};
}
