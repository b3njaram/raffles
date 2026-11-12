import {useEffect,useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowRight,Clock3,Heart,ImagePlus,Printer,ShieldCheck,Users,X} from 'lucide-react';
import {backend,friendlyError,imageUrl} from './backend';
import type {Cause,CauseAcknowledgment,CauseDraft,Category,Currency,Profile,RecipientOption} from './types';
import {ackLabel,categories,causeAmount,causeIsActive,causeTarget,causeTotal,intentionProgress,remaining} from './types';
import {usePreferences} from './Preferences';
import './causes.css';

type Notify=(message:string,isError?:boolean)=>void;
export type AckDisplay={intent_id?:string;ack_no:number;amount_value:number;currency_code:Currency;cause_title:string;issued_at:string;intent_status?:'intent'|'pending'|'approved'|'rejected';recipient_name?:string|null};

export function CauseGallery({causes,onOpen,includeDrafts=false}:{causes:Cause[];onOpen:(cause:Cause)=>void;includeDrafts?:boolean}){
 const {t,format}=usePreferences();
 const approved=includeDrafts?causes:causes.filter(c=>c.status==='active'||c.status==='finished');
 return <div className="chn-causes-grid">
  {approved.map(c=><button key={c.id} type="button" className="chn-cause-card" onClick={()=>onOpen(c)}>
   <div className="chn-cause-cover">{c.image_paths[0]&&imageUrl(c.image_paths[0])?<img loading="lazy" src={imageUrl(c.image_paths[0])} alt={c.title}/>:<span className="chn-cause-cover-fallback"><Heart size={42}/></span>}
    <span className="chn-cause-tag"><Heart size={14}/> {c.status==='pending'?'En revisión':c.status==='paused'?'Pausada':c.status==='cancelled'?'Cancelada':'Causa comunitaria'}</span>
   </div>
   <div className="chn-cause-copy"><span className="chn-cause-category">{c.category} · Grupo 4 CHN</span>
    <h3>{c.title}</h3><p>{c.description}</p>
    <div className="chn-cause-amount"><span>Apoyo sugerido por registro</span><strong>{format(c.fixed_support_amount,'MXN')}{c.fixed_support_amount_usd!=null&&<> · {format(c.fixed_support_amount_usd,'USD')}</>}</strong></div>
    <div className="chn-cause-meta"><span><Users size={15}/> {c.intention_count} / {c.max_intentions} intenciones</span><span><Clock3 size={15}/> {remaining(c.end_at)}</span></div>
    <div className="chn-intentions-progress" role="progressbar" aria-label={'Intenciones de '+c.title} aria-valuenow={c.intention_count} aria-valuemin={0} aria-valuemax={c.max_intentions}>
     <span style={{width:intentionProgress(c)+'%'}}/>
    </div><small className="chn-intentions-caption">{c.intention_count>=c.max_intentions?'Cupo completo':c.max_intentions-c.intention_count+' espacios disponibles'}</small>
    <span className="chn-cause-action">Conocer la causa <ArrowRight size={17}/></span>
   </div>
  </button>)}
  {approved.length===0&&<div className="chn-cause-empty"><Heart size={35}/><h3>Próximamente: causas del Grupo 4</h3><p>Las nuevas iniciativas aparecerán aquí cuando sean revisadas por administración.</p></div>}
 </div>;
}

export function AckPanel({data,onClose}:{data:AckDisplay;onClose:()=>void}){
 const {t,format,date}=usePreferences();
 return <div className="chn-ack-modal">
  <div className="chn-ack-print">
   <div className="chn-ack-heading"><Heart size={35}/><div><strong>SCOUTAPOYA · GRUPO 4 CHN</strong><small>Acuse de intención de apoyo</small></div></div>
   <p className="chn-ack-notice">Este documento confirma un registro en la plataforma. No representa una compra, un pago recibido, una donación deducible ni un CFDI.</p>
   <div className="chn-ack-no">{ackLabel(data.ack_no)}</div>
   <div className="chn-ack-details">
    <div><span>Causa</span><strong>{data.cause_title}</strong></div>
    <div><span>Monto previsto</span><strong>{format(data.amount_value,data.currency_code)}</strong></div>
    <div><span>Cuenta destinataria seleccionada</span><strong>{data.recipient_name||'Grupo 4 · Chihuahua Norte'}</strong></div>
    <div><span>Fecha de registro</span><strong>{date(data.issued_at)}</strong></div>
    <div><span>Estado de revisión</span><strong>{data.intent_status==='approved'?'Aprobada por administración':data.intent_status==='rejected'?'Rechazada':data.intent_status==='pending'?'Pendiente de aprobación':'Intención registrada'} · Sin pago</strong></div>
   </div>
   <div className="chn-ack-footer">El folio es único. No proporciona contraprestaciones. Si se efectúa una donación real, su comprobante correspondiente debe ser emitido por la entidad receptora conforme a la normativa aplicable.</div>
  </div>
  <div className="chn-ack-actions"><button type="button" className="primary" onClick={()=>window.print()}><Printer size={18}/> Imprimir / guardar PDF</button><button className="secondary" type="button" onClick={onClose}>Cerrar</button></div>
 </div>;
}

export function CauseDetail({cause,onClose,onUpdated,onAcknowledged,notify}:{cause:Cause;onClose:()=>void;onUpdated:()=>Promise<void>;onAcknowledged:(d:CauseAcknowledgment)=>void;notify:Notify}){
 const {t,format}=usePreferences();
 const [currency,setCurrency]=useState<Currency>('MXN');
 const [photo,setPhoto]=useState(0),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const [recipients,setRecipients]=useState<RecipientOption[]>([]),[recipientId,setRecipientId]=useState(cause.owner_id);
 useEffect(()=>{setPhoto(0);setCurrency('MXN')},[cause.id]);
 useEffect(()=>{let mounted=true;setRecipientId(cause.owner_id);
  void backend.availableRecipients().then(options=>{if(!mounted)return;setRecipients(options);
   setRecipientId(current=>options.some(x=>x.id===current)?current:(options.find(x=>x.role==='admin')?.id||options[0]?.id||''));
  }).catch(err=>notify(friendlyError(err),true));
  return()=>{mounted=false};
 },[cause.id,cause.owner_id,notify]);
 const open=causeIsActive(cause)&&cause.intention_count<cause.max_intentions;
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy||!open)return;setBusy(true);
  try{const result=await backend.registerCauseIntent(cause.id,recipientId,currency,note);
   notify('Acuse '+ackLabel(result.ack_no)+' emitido. La intención queda pendiente de tu aprobación; no se realizó ningún cobro.');
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
   <div className="chn-cause-amount-box"><span>Monto fijado por el organizador para cada intención</span><strong>{format(cause.fixed_support_amount,'MXN')}{cause.fixed_support_amount_usd!=null&&<> / {format(cause.fixed_support_amount_usd,'USD')}</>}</strong><small>Puedes registrar varias intenciones mientras haya cupo disponible. No hay cobros en esta página.</small></div>
   <div className="chn-cause-metrics"><span><Heart size={16}/> {cause.intention_count} / {cause.max_intentions} intenciones registradas</span><span><Clock3 size={16}/> {remaining(cause.end_at)}</span></div>
   <div className="chn-intentions-progress chn-intentions-progress-large" role="progressbar" aria-label="Cupo de intenciones" aria-valuenow={cause.intention_count} aria-valuemin={0} aria-valuemax={cause.max_intentions}>
    <span style={{width:intentionProgress(cause)+'%'}}/>
   </div>
   <p className="chn-intentions-detail">{cause.intention_count>=cause.max_intentions?'Límite de intenciones alcanzado.':(cause.max_intentions-cause.intention_count)+' espacios restantes. Incluye intenciones pendientes y aprobadas.'}</p>
   {causeTarget(cause,currency)>0&&<div className="chn-cause-goal">
    <div><b>{t('Meta orientativa','Indicative goal')}: {format(causeTarget(cause,currency),currency)}</b>
     <span>{format(causeTotal(cause,currency),currency)} {t('en intenciones, NO cobrado','in intentions, NOT collected')}</span></div>
    <div className="chn-cause-progress"><span style={{width:Math.min(100,100*causeTotal(cause,currency)/causeTarget(cause,currency))+'%'}}/></div>
   </div>}
   <form onSubmit={submit} className="form-col">
    <fieldset className="chn-currency-choices">
     <legend>{t('Moneda de tu intención','Your intention currency')}</legend>
     <button type="button" className={currency==='MXN'?'active':''} aria-pressed={currency==='MXN'} onClick={()=>setCurrency('MXN')}>MXN · {format(cause.fixed_support_amount,'MXN')}</button>
     <button type="button" disabled={cause.fixed_support_amount_usd==null} className={currency==='USD'?'active':''} aria-pressed={currency==='USD'} onClick={()=>setCurrency('USD')}>USD · {cause.fixed_support_amount_usd!=null?format(cause.fixed_support_amount_usd,'USD'):t('No configurado','Not configured')}</button>
    </fieldset>
    <p className="chn-intentions-caption">{t('Se registra la moneda que elijas, sin conversión automática ni movimiento de dinero.','We record the chosen currency without automatic conversion or money movement.')}</p>
    <label>Cuenta a la que diriges esta intención
     <select required value={recipientId} onChange={e=>setRecipientId(e.target.value)}>
      {recipients.length===0&&<option value="">Cargando miembros aprobados…</option>}
      {recipients.map(r=><option key={r.id} value={r.id}>{r.id===cause.owner_id?'Organizador · ':r.role==='admin'?'Administración · ':'Otro miembro · '}{r.display_name}</option>)}
     </select>
    </label>
    <p className="chn-intentions-caption">Solo se registra la persona destinataria. No se piden cuentas bancarias ni se realizan transferencias. La administración revisa cada solicitud.</p>
    <label>Mensaje para la causa (opcional)<textarea maxLength={240} rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Un mensaje de apoyo para Grupo 4…"/></label>
    <button className="primary full" type="submit" disabled={busy||!open||!recipients.some(r=>r.id===recipientId)}>{busy?'Registrando…':cause.intention_count>=cause.max_intentions?'Cupo completo':open?'Solicitar intención por '+format(causeAmount(cause,currency)||0,currency):'No disponible'} <ArrowRight size={17}/></button>
   </form>
   <p className="chn-cause-disclaimer"><ShieldCheck size={17}/> El folio entregado es un acuse de intención, no comprobante de donativo pagado. No proporciona premios ni contraprestaciones.</p>
  </div>
 </div>;
}

export function CauseEditor({user,onClose,onSaved,notify}:{user:Profile;onClose:()=>void;onSaved:()=>Promise<void>;notify:Notify}){
 const {t,format}=usePreferences();
 const [draft,setDraft]=useState<CauseDraft>({title:'',description:'',category:'Aventura',endAt:'',amount:100,amountUsd:10,target:3000,targetUsd:300,maxIntentions:100});
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
  if(!Number.isInteger(draft.maxIntentions)||draft.maxIntentions<1||draft.maxIntentions>100000){notify('El límite debe estar entre 1 y 100,000 intenciones.',true);return}
  if(!Number.isInteger(draft.amount)||draft.amount<20||draft.amount>100000||!Number.isInteger(draft.amountUsd)||draft.amountUsd<1||draft.amountUsd>100000){notify('Revisa los montos por moneda.',true);return}
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
  <p>Comparte una necesidad concreta y define un monto fijo por intención de apoyo. Es una iniciativa comunitaria sin contraprestaciones.</p>
  <form className="form-col" onSubmit={submit}>
   <label>Nombre de la causa<input required minLength={5} maxLength={110} value={draft.title} onChange={e=>change('title',e.target.value)} placeholder="Ej. Transporte para campamento"/></label>
   <label>¿Para qué se usarían los recursos?<textarea required minLength={20} maxLength={2500} rows={4} value={draft.description} onChange={e=>change('description',e.target.value)} placeholder="Describe el proyecto y cómo beneficiaría al Grupo 4."/></label>
   <div className="two-fields"><label>Categoría<select value={draft.category} onChange={e=>change('category',e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Cierre de la causa<input required type="datetime-local" value={draft.endAt} onChange={e=>change('endAt',e.target.value)}/></label></div>
   <div className="two-fields"><label>Importe por intención (MXN)<input required type="number" min={20} max={100000} step={1} value={draft.amount} onChange={e=>change('amount',Number(e.target.value))}/></label>
    <label>Meta prevista (MXN)<input required type="number" min={0} max={100000000} step={1} value={draft.target} onChange={e=>change('target',Number(e.target.value))}/></label></div>
   <div className="two-fields"><label>{t('Importe por intención (USD)','Amount per intention (USD)')}<input required type="number" min={1} max={100000} step={1} value={draft.amountUsd} onChange={e=>change('amountUsd',Number(e.target.value))}/></label>
    <label>{t('Meta prevista (USD)','Target (USD)')}<input required type="number" min={0} max={100000000} step={1} value={draft.targetUsd} onChange={e=>change('targetUsd',Number(e.target.value))}/></label></div>
   <p className="chn-intentions-caption">{t('Define los montos en ambas monedas. No se aplican conversiones automáticas.','Set amounts in both currencies. No automatic conversion is applied.')}</p>
   <label>Límite máximo de intenciones para esta causa
    <input type="number" required min={1} max={100000} step={1} value={draft.maxIntentions} onChange={e=>change('maxIntentions',Number(e.target.value))}/>
    <small>El cupo lo define el organizador al crear la causa. Cada registro pendiente o aprobado utiliza un espacio.</small>
   </label>
   <div className="chn-intentions-progress" role="progressbar" aria-label="Progreso de nuevas intenciones" aria-valuemin={0} aria-valuemax={Math.max(1,draft.maxIntentions)} aria-valuenow={0}><span style={{width:'0%'}}/></div>
   <p className="chn-intentions-caption">Al publicarse comenzará en 0 / {draft.maxIntentions.toLocaleString('es-MX')} intenciones.</p>
   <div className="chn-cause-projector"><small>Intenciones necesarias para igualar la meta</small><strong>{draft.amount>0?Math.ceil(draft.target/draft.amount).toLocaleString('es-MX'):'—'}</strong><span>Esto es planificación; no representa dinero recibido.</span></div>
   <label>Fotos de la causa ({photos.length}/10)<div className="upload-zone"><ImagePlus size={25}/><b>Elegir fotos</b><small>1 a 10 imágenes · 5 MB máximo cada una</small><input disabled={busy||photos.length>=10} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>{addPhotos(Array.from(e.target.files||[]));e.target.value=''}}/></div></label>
   {!!preview.length&&<div className="chn-upload-previews">{preview.map((pic,i)=><div className="chn-preview" key={pic.url}><img src={pic.url} alt={'Foto '+(i+1)}/><button type="button" aria-label={'Quitar '+pic.name} onClick={()=>setPhotos(current=>current.filter((_,index)=>index!==i))}><X size={16}/></button></div>)}</div>}
   <div className="notice"><ShieldCheck size={18}/> Los registros generan acuses de intención. No se cobra dinero ni se emiten facturas fiscales.</div>
   <button className="primary full" type="submit" disabled={busy}>{busy?'Publicando…':'Enviar causa para aprobación'} <ArrowRight size={17}/></button>
  </form>
 </div>;
}

export function CauseAdmin({causes,onUpdate,notify}:{causes:Cause[];onUpdate:()=>Promise<void>;notify:Notify}){
 const {t,format}=usePreferences();
 const [busy,setBusy]=useState<string|null>(null);
 const act=async(cause:Cause,action:'active'|'paused'|'cancelled')=>{
  setBusy(cause.id);try{await backend.reviewCause(cause.id,action);await onUpdate();notify('Estado de causa actualizado.')}
  catch(err){notify(friendlyError(err),true)}finally{setBusy(null)}
 };
 return <div className="admin-list">
  {causes.map(c=><div className="admin-line" key={c.id}><img src={imageUrl(c.image_paths[0])} alt=""/>
   <div className="grow"><b>{c.title}</b><p>{c.owner?.display_name||'Organizador'} · {format(c.fixed_support_amount,'MXN')} / {c.fixed_support_amount_usd==null?'USD —':format(c.fixed_support_amount_usd,'USD')} {t('por intención','per intention')} · {c.status}</p>
    <small>{c.intention_count} / {c.max_intentions} intenciones · {format(c.intention_total,'MXN')} + {format(c.intention_total_usd,'USD')} {t('previstos, no cobrados','planned, not collected')} · {t('Meta','Goal')} {format(c.target_amount,'MXN')} / {format(c.target_amount_usd,'USD')}</small>
    <div className="chn-intentions-progress"><span style={{width:intentionProgress(c)+'%'}}/></div></div>
   <div className="admin-actions">
    {(c.status==='pending'||c.status==='paused')&&<button type="button" className="small-approve" disabled={!!busy} onClick={()=>{void act(c,'active')}}>Aprobar</button>}
    {c.status==='active'&&<button type="button" disabled={!!busy} onClick={()=>{void act(c,'paused')}}>Pausar</button>}
    {['active','pending','paused'].includes(c.status)&&<button type="button" className="danger" disabled={!!busy} onClick={()=>{void act(c,'cancelled')}}>Cancelar</button>}
   </div>
  </div>)}
  {!causes.length&&<div className="empty-small">No hay causas creadas todavía.</div>}
 </div>;
}
