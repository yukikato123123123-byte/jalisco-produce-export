import {useEffect,useRef} from 'react';
import {startHomeAtmosphere} from '../homeAtmosphere';
export function NopalAtmosphere(){const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);useEffect(()=>{if(!host.current||!canvas.current)return;return startHomeAtmosphere(host.current,canvas.current);},[]);return <div className="nopal-atmosphere" aria-hidden="true" ref={host}><canvas ref={canvas}/></div>;}
