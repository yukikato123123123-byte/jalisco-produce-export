import {NopalAtmosphere} from './NopalAtmosphere';
import {NopalVoiceForm} from './NopalVoiceForm';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {nopalProduct,nopalRitual,nopalOrigin} from '../nopalContent';
import {NopalLaunchForm} from './NopalLaunchForm';
import {translate} from '../i18n';
import {useLanguage} from '../localization';
import './nopal-home.css';

// Native SVG viewports show only the photographic regions of the supplied reference.
// All typography, navigation, numbering and section layout are live HTML.
function ReferenceArt({viewBox,label,className=''}:{viewBox:string;label:string;className?:string}){
 return <svg className={`nopal-art ${className}`} viewBox={viewBox} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
  <image href="/images/nopal-reference.png" width="1671" height="941"/>
 </svg>;
}
function NopalLanguage(){
 const {language,setLanguage}=useLanguage();
 return <div className="nopal-language" role="group" aria-label="Language / Idioma" data-no-translate>
  <button type="button" lang="es" aria-label="Español" aria-pressed={language==='es'} onClick={()=>setLanguage('es')}>ES</button>
  <span aria-hidden="true">/</span>
  <button type="button" lang="en" aria-label="English" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button>
 </div>;
}
function NopalLinks({footer=false}:{footer?:boolean}){
 const {language}=useLanguage();const t=(text:string)=>translate(text,language);
 return <nav className="nopal-nav" aria-label={t(footer?'Footer navigation':'Main navigation')}>
  <a href="#producto">{t('PRODUCT')}</a><span aria-hidden="true">·</span>
  <a href="#ritual" data-no-translate>RITUAL</a><span aria-hidden="true">·</span>
  <a href="#origen">{t('ORIGIN')}</a><span aria-hidden="true">·</span><a href="#voice">{t('CUSTOMER VOICE')}</a><span aria-hidden="true">·</span><a href="/login">{t('Sign in')}</a>
 </nav>;
}
export function NopalHomePage(){
 const {language}=useLanguage();const t=(text:string)=>translate(text,language);
 const [activeStage,setActiveStage]=useState(0);
 const stageButtons=useRef<(HTMLButtonElement|null)[]>([]);
 const title=t('NopaHua · Powder and water');
 const description=t('Explore NopaHua: a powder-and-water care concept, an interactive ritual, private customer feedback and launch updates.');
 useEffect(()=>{document.title=title;const meta=document.querySelector('meta[name="description"]');const previous=meta?.getAttribute('content')||'';meta?.setAttribute('content',description);document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#080f10');return()=>{meta?.setAttribute('content',previous);};},[title,description]);
 // The first React render can occur after the browser has tried its native fragment jump.
 // Resolve direct links after DOM commit, before paint; regular in-page links stay native.
 useLayoutEffect(()=>{
  const id=window.location.hash.slice(1);
  if(['top','concepto','producto','ritual','origen','launch','voice'].includes(id))document.getElementById(id)?.scrollIntoView({behavior:'instant',block:'start'});
 },[]);
 const stages=nopalRitual.map(stage=>({...stage,title:t(stage.title),alt:t(stage.alt),description:t(stage.description)}));
 function selectStage(event:KeyboardEvent<HTMLButtonElement>,index:number){
  const next=(event.key==='ArrowRight'||event.key==='ArrowDown')?(index+1)%stages.length:(event.key==='ArrowLeft'||event.key==='ArrowUp')?(index+stages.length-1)%stages.length:event.key==='Home'?0:event.key==='End'?stages.length-1:null;
  if(next===null)return;event.preventDefault();setActiveStage(next);stageButtons.current[next]?.focus();
 }
 return <div className="nopal-page" id="top">
  <a className="nopal-skip" href="#concepto">{t('Skip to content')}</a>
  <header className="nopal-header"><div className="nopal-frame nopal-bar">
   <a className="nopal-wordmark" href="/" aria-label={t('NopaHua home')} data-no-translate>NopaHua</a>
   <NopalLinks/><a className="nopal-detail-link" href="/research/nopahua">{t('MARKET RESEARCH')}</a><a className="nopal-nav-launch" href="#launch">{t('LAUNCH UPDATES')}</a><NopalLanguage/>
  </div></header>
  <main>
   <section className="nopal-hero" aria-labelledby="nopal-title"><NopalAtmosphere/>
    <ReferenceArt className="nopal-hero-art" viewBox="720 57 850 329" label={t('Conceptual sculpture of clear flowing water and suspended powder')}/>
    <div className="nopal-frame nopal-hero-copy">
     <p className="nopal-eyebrow nopal-hero-kicker">{t('ORIGIN · RITUAL · POSSIBILITY')}</p><p className="nopal-hero-word" data-no-translate aria-hidden="true">NopaHua</p><h1 id="nopal-title">{t('IT IS NOT A CREAM.')}<br/>{t('IT IS AN ENCOUNTER.')}</h1>
     <p>{t('Two elements. A new experience.')}</p>
     <div className="nopal-hero-actions"><a className="nopal-cta" href="#producto">{t('DISCOVER THE CONCEPT')}<span aria-hidden="true">⟶</span></a><a className="nopal-detail-link" href="#ritual">{t('ENTER THE RITUAL')}</a></div>
    </div>
   </section>
   <section className="nopal-ritual nopal-frame" id="ritual" aria-label={t('The ritual in three moments')}>
    <ol role="tablist" aria-label={t('Choose a ritual stage')}>{stages.map((stage,i)=><li role="presentation" key={stage.box}>
     <button type="button" role="tab" id={`nopal-stage-${i}`} aria-label={`0${i+1} ${stage.title}`} aria-controls="nopal-ritual-panel" aria-selected={i===activeStage} tabIndex={i===activeStage?0:-1} ref={el=>{stageButtons.current[i]=el;}} onClick={()=>setActiveStage(i)} onKeyDown={e=>selectStage(e,i)}>
     <div className="nopal-stage-image"><ReferenceArt viewBox={stage.box} label={stage.alt}/></div>
     <span className="nopal-stage-number" aria-hidden="true">0{i+1}</span>
     <span className="nopal-stage-title"><span aria-hidden="true"/>{stage.title}</span>
     </button>
    </li>)}</ol>
    <div className="nopal-ritual-panel" id="nopal-ritual-panel" role="tabpanel" aria-labelledby={`nopal-stage-${activeStage}`} tabIndex={0}>
     <ReferenceArt key={activeStage} viewBox={stages[activeStage].box} label={stages[activeStage].alt}/>
     <div><p className="nopal-eyebrow">0{activeStage+1} / 03</p><h2>{stages[activeStage].title}</h2><p>{stages[activeStage].description}</p><p className="nopal-concept-note">{t('A visual concept, not final directions for skin application.')}</p><div className="nopal-ritual-progress"><span>{t('MOMENT')} 0{activeStage+1} / 03</span>{activeStage<2?<button type="button" onClick={()=>{setActiveStage(v=>v+1);stageButtons.current[activeStage+1]?.focus();}}>{t('NEXT MOMENT')}</button>:<a href="#producto">{t('CONTINUE TO THE CONCEPT')}</a>}</div></div>
    </div>
   </section>
   <section className="nopal-editorial" id="concepto" aria-label={t('The proposal and the origin of the concept')}>
    <figure className="nopal-product-art">
     <ReferenceArt viewBox="120 411 477 121" label={t('Powder texture study; not a photograph of a finished product')}/>
     <figcaption>{t('CONCEPT VISUALIZATION')}</figcaption>
    </figure>
    <article className="nopal-proposal">
     <p className="nopal-eyebrow">{t('OUR PROPOSAL')}</p>
     <h2>{t('A care concept.')}<br/>{t('Powder, activated by water.')}</h2>
     <p>{t('A concept proposal. Not available for purchase.')}</p>
     <span className="nopal-rule" aria-hidden="true"/>
    </article>
    <figure className="nopal-origin-art"><ReferenceArt viewBox="1126 628 168 245" label={t('Light and shadow on a mineral-textured arch')}/></figure>
    <article className="nopal-story">
     <p className="nopal-eyebrow">{t('THE ORIGIN OF THE CONCEPT')}</p>
     <h2>{t('NopaHua, an encounter')}<br/>{t('between matter')}<br/>{t('and movement.')}</h2>
     <span className="nopal-rule nopal-rule-dark" aria-hidden="true"/>
     <p>{t('Water and powder inspire an exploration of texture, light and transformation. Two elements, a new perspective.')}</p>
     <span className="nopal-rule" aria-hidden="true"/>
    </article>
   </section>
   <section className="nopal-product-details nopal-frame" id="producto" aria-labelledby="nopal-product-title">
    <figure><ReferenceArt viewBox="120 411 477 121" label={t('Powder texture study; not a photograph of a finished product')}/><figcaption>{t('CONCEPT VISUALIZATION')}</figcaption></figure>
    <div><p className="nopal-eyebrow">{t('COMING SOON')}</p><h2 id="nopal-product-title">{t('Powder. Water. Possibility.')}</h2><p>{t('A powder-and-water care concept in development. There is no product available to buy and no confirmed launch date.')}</p>
     <dl><div><dt>{t('Development status')}</dt><dd>{t('Concept development')}</dd></div><div><dt>{t('Formula and ingredients')}</dt><dd>{nopalProduct.ingredients?.join(', ')||t('Not yet confirmed')}</dd></div><div><dt>{t('Directions for use')}</dt><dd>{nopalProduct.directions||t('Not yet confirmed')}</dd></div></dl>
     <p>{t('The intended concept brings powder and water together. Exact quantities, application and safety instructions will only be shared once confirmed.')}</p>
     <a className="nopal-detail-link" href="#ritual">{t('EXPLORE THE RITUAL')}</a><a className="nopal-detail-link" href="#launch">{t('GET LAUNCH UPDATES')}</a>
    </div>
   </section>
   <section className="nopal-origin-details nopal-frame" id="origen" aria-labelledby="nopal-origin-title">
    <figure className="nopal-origin-botanical"><ReferenceArt viewBox="551 676 190 196" label={t('Botanical and mineral forms in the concept artwork; not verified ingredients or a sourcing claim')}/><figcaption>{t('VISUAL INSPIRATION · NOT SOURCING EVIDENCE')}</figcaption></figure><div><p className="nopal-eyebrow">{t('THE ORIGIN OF THE CONCEPT')}</p><h2 id="nopal-origin-title">{t('An idea shaped by an encounter.')}</h2></div>
    <div><p>{t('NopaHua begins here as a study of two materials: water in motion and powder in suspension. Their encounter is the starting point for the visual identity.')}</p><p>{t('Light, mineral textures and open space give the concept its rhythm. The imagery explores a direction; it does not establish a formula, manufacturing origin or product benefit.')}</p><p className="nopal-concept-note">{t('Confirmed brand and product details will be added as they become available.')}</p><blockquote>{t('Two elements. A new perspective.')}</blockquote><div className="nopal-origin-actions"><a className="nopal-detail-link" href="#producto">{t('RETURN TO THE PRODUCT')}</a><a className="nopal-detail-link" href="#launch">{t('JOIN THE LAUNCH LIST')}</a></div>{Object.entries(nopalOrigin).filter(([,value])=>value!==null).map(([key,value])=><p key={key}>{value}</p>)}</div>
   </section>
   <NopalVoiceForm/>
   <NopalLaunchForm/>
  </main>
  <footer className="nopal-footer"><div className="nopal-frame nopal-bar">
   <a className="nopal-wordmark" href="#top" aria-label={t('NopaHua back to top')} data-no-translate>NopaHua</a>
   <NopalLinks footer/><NopalLanguage/>
  </div></footer>
 </div>;
}
