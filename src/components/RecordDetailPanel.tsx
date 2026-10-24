import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import {Localized} from '../localization';

/** Inline review workspace. Keeps the existing page URL and normal Back navigation. */
export function RecordDetailPanel({title,onClose,children}:{title:ReactNode;onClose:()=>void;children:ReactNode}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
 return <Localized><section id="record-detail-panel" className="record-detail-panel" aria-labelledby="record-detail-title" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}}}>
  <header><h3 id="record-detail-title" ref={heading} tabIndex={-1}>{title}</h3><button type="button" className="button-secondary" onClick={onClose}>Close details</button></header>
  <div className="record-detail-layout">{children}</div>
 </section></Localized>;
}
