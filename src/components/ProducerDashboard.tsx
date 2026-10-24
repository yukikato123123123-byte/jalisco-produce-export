import {ProductImages} from './ProductImages';
import {ProductPhotoEditor,saveProductPhotos} from './ProductPhotoEditor';
import type {PhotoDraft} from './ProductPhotoEditor';
import type {ProductImage} from '../productImages';
import {Localized} from '../localization';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { accountRequest } from './AccountPages';
type Item = {images?:ProductImage[];image_version?:number; id?: string; name: string; description: string; category: string; quantity: number | string; unit: string; price: number | string | null; currency: string; availability: string; status: string; approval_state?:string };
type Profile = { company: string; country: string; region: string; bio: string; business_email: string; business_phone: string; public_contact: number };
type Workspace = { registration_review?:string;profile: Profile; items: Item[]; summary: {total:number; public:number; quantities:Record<string,number>; profileCompletion:number} };
const empty: Item = {name:'',description:'',category:'',quantity:'',unit:'kg',price:'',currency:'',availability:'',status:'draft'};
export function ProducerDashboard() {
  const [data,setData]=useState<Workspace|null>(null), [item,setItem]=useState<Item>(empty), [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('');
  const [query,setQuery]=useState(''),[status,setStatus]=useState('all');
  const lock=useRef(false),photoDraft=useRef<PhotoDraft|null>(null),uploadController=useRef<AbortController|null>(null);
  const [editorKey,setEditorKey]=useState(0),[uploadProgress,setUploadProgress]=useState<number|null>(null);
  useEffect(()=>()=>uploadController.current?.abort(),[]);
  function edit(next:Item){setItem(next);photoDraft.current=null;setEditorKey(k=>k+1);setMessage('');}
  async function submitItem(e:FormEvent<HTMLFormElement>){
   e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');const draft=photoDraft.current;let savedId=item.id;
   try{
    const {images:unusedImages,image_version:unusedVersion,...fields}=item;void unusedImages;void unusedVersion;
    const result=await accountRequest('/api/producer/items',{...fields});setData(result);savedId=result.saved_item_id;
    if(!savedId)throw new Error('Product save could not be confirmed.');
    setItem(current=>({...current,id:savedId}));
    if(draft?.dirty){const controller=new AbortController();uploadController.current=controller;setUploadProgress(0);await saveProductPhotos(savedId,draft,controller.signal,setUploadProgress);setData(await accountRequest('/api/producer/dashboard'));}
    edit(empty);setMessage('Product and photos saved. Photo changes require another review.');
   }catch(e){if(savedId)setItem(current=>({...current,id:savedId}));setError(e instanceof Error?e.message:'Photo upload failed. Existing photos were preserved.');}
   finally{setBusy(false);setUploadProgress(null);lock.current=false;uploadController.current=null;}
  }
  useEffect(()=>{let active=true; accountRequest('/api/producer/dashboard').then(v=>{if(active)setData(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function save(path:string, values:Record<string,unknown>, done?:()=>void) {
    if(lock.current)return; lock.current=true;setBusy(true);setError('');setMessage('');
    try { const result=await accountRequest(path,values);setData(result);done?.();setMessage('Changes saved.'); }
    catch(e){setError(e instanceof Error?e.message:'Unable to save.');}
    finally{lock.current=false;setBusy(false);}
  }
  function profileSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;void save('/api/producer/profile',{...Object.fromEntries(new FormData(form)),public_contact:new FormData(form).has('public_contact')});}
  return <Localized><section className="producer-workspace" aria-label="Producer workspace">
    {error&&<p role="alert" className="account-error">{error}</p>}{message&&<p role="status" className="account-success">{message}</p>}
    <p>Public visibility requires approval of your producer registration and each product. Editing registration details requires another review.</p>{data&&<p><span>Registration review</span>: <span>{data.registration_review??'pending'}</span></p>}{!data ? !error&&<p role="status">Loading workspace…</p> : <>
      <dl className="producer-summary"><div><dt>Registered items</dt><dd>{data.summary.total}</dd></div><div><dt>Public items</dt><dd>{data.summary.public}</dd></div><div><dt>Available public supply</dt><dd>{Object.entries(data.summary.quantities).map(([unit,n])=>`${n} ${unit}`).join(' · ')||'No public supply'}</dd></div><div><dt>Profile completion</dt><dd>{data.summary.profileCompletion}%</dd></div></dl>
      <nav className="workspace-nav" aria-label="Producer workspace sections"><a href="#farm-profile">Farm profile</a><a href="#my-produce">My produce</a><a href="/producers">Public directory </a></nav><h3 id="farm-profile">Company or farm profile</h3><p>Company, country, region and introduction appear with your public items. Business contact details are shared only when you select the option below.</p>
      <form onSubmit={profileSubmit} aria-busy={busy}><fieldset disabled={busy} className="account-fields workspace-fields">
        {(['company','country','region','bio','business_email','business_phone'] as const).map(k=><label className={k==='bio'?'field-wide':undefined} key={k}>{({company:'Company or farm',country:'Country',region:'Region',bio:'Introduction',business_email:'Business email',business_phone:'Business phone'})[k]}{k==='bio'?<textarea name={k} defaultValue={data.profile[k]} maxLength={2000} rows={4}/>:<input name={k} defaultValue={data.profile[k]} required={k==='company'||k==='country'} type={k==='business_email'?'email':'text'} maxLength={k==='business_email'?254:k==='business_phone'?80:120}/>}</label>)}
        <label className="field-wide"><input className="producer-check" type="checkbox" name="public_contact" defaultChecked={!!data.profile.public_contact}/> Publish my business email and phone with public items</label><button>Save profile</button>
      </fieldset></form>
      <h3 id="my-produce">Produce items</h3><p>Share your harvest when you’re ready. Public items appear in Explore Produce; drafts and private items stay in your workspace. Supply totals are grouped by unit. Orders, payments and logistics are not available.</p>
      <div className="workspace-filter"><label>Find your produce<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name or variety"/></label><label>Publication filter<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All items</option><option value="draft">Draft</option><option value="public">Public</option><option value="private">Private</option></select></label></div>{!data.items.length&&<p>No produce registered yet. Add your first item below.</p>}{data.items.length>0&&!data.items.some(i=>(status==='all'||i.status===status)&&(i.name+' '+i.category).toLowerCase().includes(query.toLowerCase()))&&<p role="status">No items match your filters.</p>}<div className="workspace-item-grid">{data.items.filter(i=>(status==='all'||i.status===status)&&(i.name+' '+i.category).toLowerCase().includes(query.toLowerCase())).map(i=><article className="producer-item" key={i.id}><ProductImages images={i.images} name={i.name} compact/><h4 data-no-translate>{i.name}</h4><p>{i.quantity} {i.unit} · {i.status}{i.price!==null?` · ${i.price} ${i.currency}`:''}</p><p><span>Registration review</span>: <span>{i.approval_state??'pending'}</span></p><button className="button-secondary" disabled={busy} onClick={()=>{edit(i);}}>Edit {i.name}</button><button className="button-danger" disabled={busy} onClick={()=>{if(window.confirm(`Delete ${i.name}?`))void save('/api/producer/items',{id:i.id,action:'delete'},()=>{if(item.id===i.id)setItem(empty);});}}>Delete {i.name}</button></article>)}</div>
      <h3>{item.id?'Edit item':'Register item'}</h3><form onSubmit={submitItem}><fieldset disabled={busy} className="account-fields workspace-fields">
        {(['name','description','category','quantity','unit','price','currency','availability'] as const).map(k=><label className={k==='description'?'field-wide':undefined} key={k}>{({name:'Item name',description:'Description',category:'Variety or category',quantity:'Available quantity',unit:'Unit',price:'Price (optional)',currency:'Currency (e.g. USD)',availability:'Harvest or availability (optional)'})[k]}{k==='description'?<textarea name={k} value={item.description} maxLength={2000} rows={4} onChange={e=>setItem({...item,description:e.target.value})}/>:<input name={k} value={item[k]??''} type={k==='quantity'||k==='price'?'number':'text'} min={k==='quantity'||k==='price'?0:undefined} max={k==='quantity'||k==='price'?1e12:undefined} step="any" pattern={k==='currency'?'[A-Z]{3}':undefined} title={k==='currency'?'Use three uppercase letters, for example USD':undefined} maxLength={k==='currency'?3:k==='unit'?30:k==='availability'?200:120} required={['name','category','quantity','unit'].includes(k)} onChange={e=>setItem({...item,[k]:e.target.value})}/>}</label>)}
        <ProductPhotoEditor key={editorKey} resetKey={String(editorKey)} images={item.images} version={item.image_version||0} disabled={busy} onChange={draft=>{photoDraft.current=draft;}}/>
        <label>Status<select value={item.status} onChange={e=>setItem({...item,status:e.target.value})}><option value="draft">Draft</option><option value="public">Public</option><option value="private">Private</option></select><small>Draft: still preparing. Public: visible after producer and product approval. Private: only you can see it.</small></label><button>Save item</button><button className="button-secondary" type="button" onClick={()=>edit(empty)}>Start a new item</button>
      </fieldset>{uploadProgress!==null&&<div role="status"><p>Uploading product photos…</p><progress aria-label="Uploading product photos…" className="photo-progress" value={uploadProgress} max={100}/><button type="button" className="button-secondary" onClick={()=>uploadController.current?.abort()}>Cancel photo upload</button></div>}</form>
    </>}
  </section></Localized>;
}
