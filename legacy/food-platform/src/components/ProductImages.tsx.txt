import {useState} from 'react';
import {Localized} from '../localization';
import type {ProductImage} from '../productImages';
import './product-images.css';
function Photo({src,name,full=false}:{src:string;name:string;full?:boolean}){const [failed,setFailed]=useState(false);return <Localized>{failed?<span className="product-photo-empty">Photo unavailable</span>:<img data-no-translate src={src} alt={name} loading="lazy" decoding="async" className={full?'product-photo-full':''} onError={()=>setFailed(true)}/>}</Localized>;}
export function ProductImages({images=[],name,gallery=false,compact=false}:{images?:ProductImage[];name:string;gallery?:boolean;compact?:boolean}){
 const [selected,setSelected]=useState('');const photo=images.find(i=>i.id===selected)||images[0];
 return <Localized><div className={`product-photos ${compact?'product-photos-compact':''}`}>
 {!photo?<div className="product-photo-empty">No product photo</div>:<><div className="product-photo-frame"><Photo key={gallery?photo.url:photo.thumbnail} src={gallery?photo.url:photo.thumbnail} name={name} full={gallery}/></div>{gallery&&images.length>1&&<div className="product-photo-thumbnails" aria-label="Product photos">{images.map((image,i)=><button type="button" className="button-secondary" key={image.id} aria-pressed={image.id===photo.id} onClick={()=>setSelected(image.id)}><Photo src={image.thumbnail} name={name}/><span>{i+1}</span></button>)}</div>}</>}
 </div></Localized>;
}
