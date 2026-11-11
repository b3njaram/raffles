import {useEffect,useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowRight,Clock3,Heart,ImagePlus,Printer,ShieldCheck,Users,X} from 'lucide-react';
import {backend,friendlyError,imageUrl} from './backend';
import type {Cause,CauseAcknowledgment,CauseDraft,Category,Profile} from './types';
import {ackLabel,categories,causeIsActive,money,remaining} from './types';
import './causes.css';

type Notify=(message:string,isError?:boolean)=>void;
export type AckDisplay={ack_no:number;amount_mxn:number;cause_title:string;issued_at:string};

export function CauseGallery({causes,onOpen}:{causes:Cause[];onOpen:(cause:Cause)=>void}){
 const approved=causes.filter(c=>c.status==='active'||c.status==='finished');
 return <div className="chn-causes-grid">
  {approved.map(c=><button key={c.id} type="button" className="chn-cause-card" onClick={()=>onOpen(c)}>
   <div className="chn-cause-cover">{c.image_paths[0]&&imageUrl(c.image_paths[0])?<img loading="lazy" src={imageUrl(c.image_paths[0])} alt={c.title}/>:<span className="chn-cause-cover-fallback"><Heart size={42}/></span>}
    <span className="chn-cause-tag"><Heart size={14}/> Causa comunitaria</span>
   </div>
   <div className="chn-cause-copy"><span className="chn-cause-category">{c.category} · Grupo 4 CHN</span>
    <h3>{c.title}</h3><p>{c.description}</p>
    <div className="chn-cause-amount"><span>Apoyo sugerido por registro</span><strong>{money(c.fixed_support_amount)}</strong></div>
    <div className="chn-cause-meta"><span><Users size={15}/> {c.intention_count} intenciones</span><span><Clock3 size={15}/> {remaining(c.end_at)}</span></div>
    <span className="chn-cause-action">Conocer la causa <ArrowRight size={17}/></span>
   </div>
  </button>)}
  {approved.length===0&&<div className="chn-cause-empty"><Heart size={35}/><h3>Próximamente: causas del Grupo 4</h3><p>Las nuevas iniciativas aparecerán aquí cuando sean revisadas por administración.</p></div>}
 </div>;
}

export function AckPanel({data,onClose}:{data:AckDisplay;onClose:()=>void}){
 return <div className="chn-ack-modal">
  <div className="chn-ack-print">
   <div className="chn-ack-heading"><Heart size={35}/><div><strong>SCOUTAPOYA · GRUPO 4 CHN</strong><small>Acuse de intención de apoyo</small></div></div>
   <p className="chn-ack-notice">Este documento confirma un registro en la plataforma. No representa una compra, un pago recibido, una donación deducible ni un CFDI.</p>
   <div className="chn-ack-no">{ackLabel(data.ack_no)}</div>
   <div className="chn-ack-details">
    <div><span>Causa</span><strong>{data.cause_title}</strong></div>
    <div><span>Monto previsto</span><strong>{money(data.amount_mxn)}</strong></div>
    <div><span>Destino previsto</span><strong>Grupo 4 · Chihuahua Norte</strong></div>
    <div><span>Fecha de registro</span><strong>{new Date(data.issued_at).toLocaleString('es-MX')}</strong></div>
    <div><span>Estado</span><strong>Intención registrada · Sin pago</strong></div>
   </div>
   <div className="chn-ack-footer">El folio es único. No otorga participaciones, premios ni ventajas en sorteos. Si se efectúa una donación real, su comprobante correspondiente debe ser emitido por la entidad receptora conforme a la normativa aplicable.</div>
  </div>
  <div className="chn-ack-actions"><button type="button" className="primary" onClick={()=>window.print()}><Printer size={18}/> Imprimir / guardar PDF</button><button className="secondary" type="button" onClick={onClose}>Cerrar</button></div>
 </div>;
}

export function CauseDetail({cause,onClose,onUpdated,onAcknowledged,notify}:{cause:Cause;onClose:()=>void;onUpdated:()=>Promise<void>;onAcknowledged:(d:CauseAcknowledgment)=>void;notify:Notify}){
 const [photo,setPhoto]=useState(0),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>setPhoto(0),[cause.id]);
 const open=causeIsActive(cause);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy||!open)return;setBusy(true);
  try{const result=await backend.registerCauseIntent(cause.id,note);
   notify('Acuse '+ackLabel(result.ack_no)+' creado. No se realizó ningún cobro.');
   await onUpdated();onClose();onAcknowledged(result);
  }catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}
 };
 return <div className="chn-cause-detail">
  <div className="chn-cause-detail-gallery">
   <img src={imageUrl(cause.image_paths[photo])||''} alt={cause.title}/>
   {cause.image_paths.length>1&&<div className="chn-cause-photos">{cause.image_paths.map((path,index)=><button key={path} className={index===photo?'active':''} aria-label={'Ver imagen '+(index+1)} type="button" onClick={()=>setPhoto(index)}><img src={imageUrl(path)} alt=""/></button>)}</div>}
  </div>
  <div className="chn-cause-detail-info">
   <span className="kicker">CAUSA PARA EL GRUPO 4</span><h2>{cause.title}</h2>
   <p className="chn-cause-description">{cause.description}</p>
   <div className="chn-cause-amount-box"><span>Monto fijado por el organizador para cada intención</span><strong>{money(cause.fixed_support_amount)}</strong><small>Puedes registrar intenciones adicionales cuantas veces quieras. No hay cobro en esta página.</small></div>
   <div className="chn-cause-metrics"><span><Heart size={16}/> {cause.intention_count} intenciones registradas</span><span><Clock3 size={16}/> {remaining(cause.end_at)}</span></div>
   {cause.target_amount>0&&<div className="chn-cause-goal">
    <div><b>Meta orientativa: {money(cause.target_amount)}</b><span>{money(cause.intention_total)} en intenciones, NO cobrado</span></div>
    <div className="chn-cause-progress"><span style={{width:Math.min(100,100*cause.intention_total/cause.target_amount)+'%'}}/></div>
   </div>}
   <form onSubmit={submit} className="form-col">
    <label>Mensaje para la causa (opcional)<textarea maxLength={240} rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Un mensaje de apoyo para Grupo 4…"/></label>
    <button className="primary full" type="submit" disabled={busy||!open}>{busy?'Registrando…':open?'Registrar intención por '+money(cause.fixed_support_amount):'No disponible'} <ArrowRight size={17}/></button>
   </form>
   <p className="chn-cause-disclaimer"><ShieldCheck size={17}/> El folio entregado es un acuse de intención, no comprobante de donativo pagado. No se vincula a sorteos ni genera beneficios de participación.</p>
  </div>
 </div>;
}

export function CauseEditor({user,onClose,onSaved,notify}:{user:Profile;onClose:()=>void;onSaved:()=>Promise<void>;notify:Notify}){
 const [draft,setDraft]=useState<CauseDraft>({title:'',description:'',category:'Aventura',endAt:'',amount:100,target:3000});
 const [photos,setPhotos]=useState<File[]>([]),[busy,setBusy]=useState(false);
 const preview=useMemo(()=>photos.map(file=>({name:file.name,url:URL.createObjectURL(file)})),[photos]);
 useEffect(()=>()=>{preview.forEach(p=>URL.revokeObjectURL(p.url))},[preview]);
 const change=<K extends keyof CauseDraft>(key:K,value:CauseDraft[K])=>setDraft(d=>({...d,[key]:value}));
 const addPhotos=(files:File[])=>{
  const valid=files.filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type)&&f.size<=5*1024*1024);
  if(valid.length!==files.length)notify('Solo JPG, PNG o WebP, máximo 5 MB por foto.',true);
  if(photos.length+valid.length>10)notify('El máximo es 10 fotografías.',true);
  setPhotos(previous=>[...previous,...valid.slice(0,10-previous.length)]);
 };
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;
  if(new Date(draft.endAt).getTime()<=Date.now()+3600000){notify('El cierre debe ser al menos una hora en el futuro.',true);return}
  if(photos.length<1||photos.length>10){notify('Agrega de 1 a 10 fotos.',true);return}
  setBusy(true);const uploaded:string[]=[];
  try{
   for(const photo of photos)uploaded.push(await backend.upload(photo,user.id,'listings'));
   await backend.createCause({...draft,endAt:new Date(draft.endAt).toISOString()},uploaded);
   notify('Causa enviada a revisión. Las aportaciones no están habilitadas como pagos.');
   await onSaved();onClose();
  }catch(err){if(uploaded.length)await backend.removeUploaded(uploaded,'listings').catch(()=>{});notify(friendlyError(err),true)}
  finally{setBusy(false)}
 };
 return <div className="chn-cause-editor"><span className="kicker">PROYECTOS · GRUPO 4 CHN</span><h2>Crear una causa</h2>
  <p>Comparte una necesidad concreta y define un monto fijo por intención de apoyo. No contiene premios ni participaciones en sorteos.</p>
  <form className="form-col" onSubmit={submit}>
   <label>Nombre de la causa<input required minLength={5} maxLength={110} value={draft.title} onChange={e=>change('title',e.target.value)} placeholder="Ej. Transporte para campamento"/></label>
   <label>¿Para qué se usarían los recursos?<textarea required minLength={20} maxLength={2500} rows={4} value={draft.description} onChange={e=>change('description',e.target.value)} placeholder="Describe el proyecto y cómo beneficiaría al Grupo 4."/></label>
   <div className="two-fields"><label>Categoría<select value={draft.category} onChange={e=>change('category',e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Cierre de la causa<input required type="datetime-local" value={draft.endAt} onChange={e=>change('endAt',e.target.value)}/></label></div>
   <div className="two-fields"><label>Importe por intención (MXN)<input required type="number" min={20} max={100000} step={1} value={draft.amount} onChange={e=>change('amount',Number(e.target.value))}/></label>
    <label>Meta prevista (MXN)<input required type="number" min={0} max={100000000} step={1} value={draft.target} onChange={e=>change('target',Number(e.target.value))}/></label></div>
   <div className="chn-cause-projector"><small>Intenciones necesarias para igualar la meta</small><strong>{draft.amount>0?Math.ceil(draft.target/draft.amount).toLocaleString('es-MX'):'—'}</strong><span>Esto es planificación; no representa dinero recibido.</span></div>
   <label>Fotos de la causa ({photos.length}/10)<div className="upload-zone"><ImagePlus size={25}/><b>Elegir fotos</b><small>1 a 10 imágenes · 5 MB máximo cada una</small><input disabled={busy||photos.length>=10} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>{addPhotos(Array.from(e.target.files||[]));e.target.value=''}}/></div></label>
   {!!preview.length&&<div className="chn-upload-previews">{preview.map((pic,i)=><div className="chn-preview" key={pic.url}><img src={pic.url} alt={'Foto '+(i+1)}/><button type="button" aria-label={'Quitar '+pic.name} onClick={()=>setPhotos(current=>current.filter((_,index)=>index!==i))}><X size={16}/></button></div>)}</div>}
   <div className="notice"><ShieldCheck size={18}/> Los registros generan acuses de intención. No se cobra dinero ni se emiten facturas fiscales.</div>
   <button className="primary full" type="submit" disabled={busy}>{busy?'Publicando…':'Enviar causa para aprobación'} <ArrowRight size={17}/></button>
  </form>
 </div>;
}

export function CauseAdmin({causes,onUpdate,notify}:{causes:Cause[];onUpdate:()=>Promise<void>;notify:Notify}){
 const [busy,setBusy]=useState<string|null>(null);
 const act=async(cause:Cause,action:'active'|'paused'|'cancelled')=>{
  setBusy(cause.id);try{await backend.reviewCause(cause.id,action);await onUpdate();notify('Estado de causa actualizado.')}
  catch(err){notify(friendlyError(err),true)}finally{setBusy(null)}
 };
 return <div className="admin-list">
  {causes.map(c=><div className="admin-line" key={c.id}><img src={imageUrl(c.image_paths[0])} alt=""/>
   <div className="grow"><b>{c.title}</b><p>{c.owner?.display_name||'Organizador'} · {money(c.fixed_support_amount)} por intención · {c.status}</p>
    <small>{c.intention_count} intenciones · {money(c.intention_total)} previstos, no cobrados · Meta {money(c.target_amount)}</small></div>
   <div className="admin-actions">
    {(c.status==='pending'||c.status==='paused')&&<button type="button" className="small-approve" disabled={!!busy} onClick={()=>{void act(c,'active')}}>Aprobar</button>}
    {c.status==='active'&&<button type="button" disabled={!!busy} onClick={()=>{void act(c,'paused')}}>Pausar</button>}
    {['active','pending','paused'].includes(c.status)&&<button type="button" className="danger" disabled={!!busy} onClick={()=>{void act(c,'cancelled')}}>Cancelar</button>}
   </div>
  </div>)}
  {!causes.length&&<div className="empty-small">No hay causas creadas todavía.</div>}
 </div>;
}
