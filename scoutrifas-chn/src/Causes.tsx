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
    <span className="chn-cause-tag"><Heart size={14}/> {c.status==='pending'?t('En revisión','In review'):c.status==='paused'?t('Pausada','Paused'):c.status==='cancelled'?t('Cancelada','Cancelled'):t('Causa comunitaria','Community cause')}</span>
   </div>
   <div className="chn-cause-copy"><span className="chn-cause-category">{c.category} · Grupo 4 CHN</span>
    <h3>{c.title}</h3><p>{c.description}</p>
    <div className="chn-cause-amount"><span>{t("Apoyo sugerido por registro","Suggested support per entry")}</span><strong>{format(c.fixed_support_amount,'MXN')}{c.fixed_support_amount_usd!=null&&<> · {format(c.fixed_support_amount_usd,'USD')}</>}</strong></div>
    <div className="chn-cause-meta"><span><Users size={15}/> {c.intention_count} / {c.max_intentions} intenciones</span><span><Clock3 size={15}/> {remaining(c.end_at)}</span></div>
    <div className="chn-intentions-progress" role="progressbar" aria-label={'Intenciones de '+c.title} aria-valuenow={c.intention_count} aria-valuemin={0} aria-valuemax={c.max_intentions}>
     <span style={{width:intentionProgress(c)+'%'}}/>
    </div><small className="chn-intentions-caption">{c.intention_count>=c.max_intentions?t('Cupo completo','Capacity reached'):c.max_intentions-c.intention_count+' espacios disponibles'}</small>
    <span className="chn-cause-action">Conocer la causa <ArrowRight size={17}/></span>
   </div>
  </button>)}
  {approved.length===0&&<div className="chn-cause-empty"><Heart size={35}/><h3>{t("Próximamente: causas del Grupo 4","Group 4 causes coming soon")}</h3><p>{t("Las nuevas iniciativas aparecerán aquí cuando sean revisadas por administración.","New initiatives will appear here after administrative review.")}</p></div>}
 </div>;
}

export function AckPanel({data,onClose}:{data:AckDisplay;onClose:()=>void}){
 const {t,format,date}=usePreferences();
 return <div className="chn-ack-modal">
  <div className="chn-ack-print">
   <div className="chn-ack-heading"><Heart size={35}/><div><strong>{t("SCOUTAPOYA · GRUPO 4 CHN","SCOUTAPOYA · GROUP 4 CHN")}</strong><small>{t("Acuse de intención de apoyo","Support intention acknowledgment")}</small></div></div>
   <p className="chn-ack-notice">{t("Este documento confirma un registro en la plataforma. No representa una compra, un pago recibido, una donación deducible ni un CFDI.","This confirms a record in the platform. It is not a purchase, received payment, tax-deductible donation, or tax invoice.")}</p>
   <div className="chn-ack-no">{ackLabel(data.ack_no)}</div>
   <div className="chn-ack-details">
    <div><span>{t("Causa","Cause")}</span><strong>{data.cause_title}</strong></div>
    <div><span>{t("Monto previsto","Planned amount")}</span><strong>{format(data.amount_value,data.currency_code)}</strong></div>
    <div><span>{t("Cuenta destinataria seleccionada","Selected recipient account")}</span><strong>{data.recipient_name||'Grupo 4 · Chihuahua Norte'}</strong></div>
    <div><span>{t("Fecha de registro","Date registered")}</span><strong>{date(data.issued_at)}</strong></div>
    <div><span>{t("Estado de revisión","Review status")}</span><strong>{data.intent_status==='approved'?t('Aprobada por administración','Approved by admin'):data.intent_status==='rejected'?t('Rechazada','Rejected'):data.intent_status==='pending'?t('Pendiente de aprobación','Pending approval'):t('Intención registrada','Intention registered')} · Sin pago</strong></div>
   </div>
   <div className="chn-ack-footer">{t("El folio es único. No proporciona contraprestaciones. Si se efectúa una donación real, su comprobante correspondiente debe ser emitido por la entidad receptora conforme a la normativa aplicable.","This acknowledgment number is unique and grants no benefits in return. Any receipt for a genuine donation must be issued by the recipient entity under applicable rules.")}</div>
  </div>
  <div className="chn-ack-actions"><button type="button" className="primary" onClick={()=>window.print()}><Printer size={18}/> Imprimir / guardar PDF</button><button className="secondary" type="button" onClick={onClose}>{t("Cerrar","Close")}</button></div>
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
   <span className="kicker">{t("CAUSA PARA EL GRUPO 4","CAUSE FOR GROUP 4")}</span><h2>{cause.title}</h2>
   <p className="chn-cause-description">{cause.description}</p>
   <div className="chn-cause-amount-box"><span>{t("Monto fijado por el organizador para cada intención","Amount set by the organizer for each intention")}</span><strong>{format(cause.fixed_support_amount,'MXN')}{cause.fixed_support_amount_usd!=null&&<> / {format(cause.fixed_support_amount_usd,'USD')}</>}</strong><small>{t("Puedes registrar varias intenciones mientras haya cupo disponible. No hay cobros en esta página.","You may register multiple intentions while capacity remains. No payments are collected here.")}</small></div>
   <div className="chn-cause-metrics"><span><Heart size={16}/> {cause.intention_count} / {cause.max_intentions} intenciones registradas</span><span><Clock3 size={16}/> {remaining(cause.end_at)}</span></div>
   <div className="chn-intentions-progress chn-intentions-progress-large" role="progressbar" aria-label={t("Cupo de intenciones","Intention capacity")} aria-valuenow={cause.intention_count} aria-valuemin={0} aria-valuemax={cause.max_intentions}>
    <span style={{width:intentionProgress(cause)+'%'}}/>
   </div>
   <p className="chn-intentions-detail">{cause.intention_count>=cause.max_intentions?t('Límite de intenciones alcanzado.','Intention capacity reached.'):(cause.max_intentions-cause.intention_count)+t(' espacios restantes. Incluye intenciones pendientes y aprobadas.',' remaining spots. Includes pending and approved intentions.')}</p>
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
      {recipients.length===0&&<option value="">{t("Cargando miembros aprobados…","Loading approved members…")}</option>}
      {recipients.map(r=><option key={r.id} value={r.id}>{r.id===cause.owner_id?t('Organizador · ','Organizer · '):r.role==='admin'?t('Administración · ','Admin · '):t('Otro miembro · ','Other member · ')}{r.display_name}</option>)}
     </select>
    </label>
    <p className="chn-intentions-caption">{t("Solo se registra la persona destinataria. No se piden cuentas bancarias ni se realizan transferencias. La administración revisa cada solicitud.","Only the intended recipient is recorded. We don't request bank details or process transfers. Each request is reviewed by an administrator.")}</p>
    <label>{t("Mensaje para la causa (opcional)","Message for this cause (optional)")}<textarea maxLength={240} rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder={t("Un mensaje de apoyo para Grupo 4…","A message of support for Group 4…")}/></label>
    <button className="primary full" type="submit" disabled={busy||!open||!recipients.some(r=>r.id===recipientId)}>{busy?t('Registrando…','Registering…'):cause.intention_count>=cause.max_intentions?t('Cupo completo','Capacity reached'):open?t('Solicitar intención por ','Submit intention for ')+format(causeAmount(cause,currency)||0,currency):t('No disponible','Unavailable')} <ArrowRight size={17}/></button>
   </form>
   <p className="chn-cause-disclaimer"><ShieldCheck size={17}/> El folio entregado es un acuse de intención, no comprobante de donativo pagado. No proporciona premios ni contraprestaciones.</p>
  </div>
 </div>;
}

export function CauseEditor({user,onClose,onSaved,notify}:{user:Profile;onClose:()=>void;onSaved:()=>Promise<void>;notify:Notify}){
 const {t}=usePreferences();
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
 return <div className="chn-cause-editor"><span className="kicker">{t("PROYECTOS · GRUPO 4 CHN","PROJECTS · GROUP 4 CHN")}</span><h2>{t("Crear una causa","Create a cause")}</h2>
  <p>{t("Comparte una necesidad concreta y define un monto fijo por intención de apoyo. Es una iniciativa comunitaria sin contraprestaciones.","Describe a real need and define fixed support intention amounts. This is a community initiative without benefits in return.")}</p>
  <form className="form-col" onSubmit={submit}>
   <label>{t("Nombre de la causa","Cause title")}<input required minLength={5} maxLength={110} value={draft.title} onChange={e=>change('title',e.target.value)} placeholder={t("Ej. Transporte para campamento","E.g., camp transportation")}/></label>
   <label>{t("¿Para qué se usarían los recursos?","How would the funds be used?")}<textarea required minLength={20} maxLength={2500} rows={4} value={draft.description} onChange={e=>change('description',e.target.value)} placeholder={t("Describe el proyecto y cómo beneficiaría al Grupo 4.","Describe your project and how it helps Group 4.")}/></label>
   <div className="two-fields"><label>{t("Categoría","Category")}<select value={draft.category} onChange={e=>change('category',e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>{t("Cierre de la causa","Cause closing date")}<input required type="datetime-local" value={draft.endAt} onChange={e=>change('endAt',e.target.value)}/></label></div>
   <div className="two-fields"><label>{t("Importe por intención (MXN)","Amount per intention (MXN)")}<input required type="number" min={20} max={100000} step={1} value={draft.amount} onChange={e=>change('amount',Number(e.target.value))}/></label>
    <label>{t("Meta prevista (MXN)","Target amount (MXN)")}<input required type="number" min={0} max={100000000} step={1} value={draft.target} onChange={e=>change('target',Number(e.target.value))}/></label></div>
   <div className="two-fields"><label>{t('Importe por intención (USD)','Amount per intention (USD)')}<input required type="number" min={1} max={100000} step={1} value={draft.amountUsd} onChange={e=>change('amountUsd',Number(e.target.value))}/></label>
    <label>{t('Meta prevista (USD)','Target (USD)')}<input required type="number" min={0} max={100000000} step={1} value={draft.targetUsd} onChange={e=>change('targetUsd',Number(e.target.value))}/></label></div>
   <p className="chn-intentions-caption">{t('Define los montos en ambas monedas. No se aplican conversiones automáticas.','Set amounts in both currencies. No automatic conversion is applied.')}</p>
   <label>Límite máximo de intenciones para esta causa
    <input type="number" required min={1} max={100000} step={1} value={draft.maxIntentions} onChange={e=>change('maxIntentions',Number(e.target.value))}/>
    <small>{t("El cupo lo define el organizador al crear la causa. Cada registro pendiente o aprobado utiliza un espacio.","The organizer sets the capacity when creating the cause. Pending or approved intentions each use one spot.")}</small>
   </label>
   <div className="chn-intentions-progress" role="progressbar" aria-label={t("Progreso de nuevas intenciones","New intention progress")} aria-valuemin={0} aria-valuemax={Math.max(1,draft.maxIntentions)} aria-valuenow={0}><span style={{width:'0%'}}/></div>
   <p className="chn-intentions-caption">Al publicarse comenzará en 0 / {draft.maxIntentions.toLocaleString('es-MX')} intenciones.</p>
   <div className="chn-cause-projector"><small>{t("Intenciones necesarias para igualar la meta","Intentions needed to meet the goal")}</small><strong>{draft.amount>0?Math.ceil(draft.target/draft.amount).toLocaleString('es-MX'):'—'}</strong><span>{t("Esto es planificación; no representa dinero recibido.","Planning only; this does not represent money received.")}</span></div>
   <label>Fotos de la causa ({photos.length}/10)<div className="upload-zone"><ImagePlus size={25}/><b>{t("Elegir fotos","Choose photos")}</b><small>{t("1 a 10 imágenes · 5 MB máximo cada una","1 to 10 photos · up to 5 MB each")}</small><input disabled={busy||photos.length>=10} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>{addPhotos(Array.from(e.target.files||[]));e.target.value=''}}/></div></label>
   {!!preview.length&&<div className="chn-upload-previews">{preview.map((pic,i)=><div className="chn-preview" key={pic.url}><img src={pic.url} alt={'Foto '+(i+1)}/><button type="button" aria-label={'Quitar '+pic.name} onClick={()=>setPhotos(current=>current.filter((_,index)=>index!==i))}><X size={16}/></button></div>)}</div>}
   <div className="notice"><ShieldCheck size={18}/> Los registros generan acuses de intención. No se cobra dinero ni se emiten facturas fiscales.</div>
   <button className="primary full" type="submit" disabled={busy}>{busy?t('Publicando…','Publishing…'):t('Enviar causa para aprobación','Submit cause for approval')} <ArrowRight size={17}/></button>
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
    {(c.status==='pending'||c.status==='paused')&&<button type="button" className="small-approve" disabled={!!busy} onClick={()=>{void act(c,'active')}}>{t("Aprobar","Approve")}</button>}
    {c.status==='active'&&<button type="button" disabled={!!busy} onClick={()=>{void act(c,'paused')}}>{t("Pausar","Pause")}</button>}
    {['active','pending','paused'].includes(c.status)&&<button type="button" className="danger" disabled={!!busy} onClick={()=>{void act(c,'cancelled')}}>{t("Cancelar","Cancel")}</button>}
   </div>
  </div>)}
  {!causes.length&&<div className="empty-small">{t("No hay causas creadas todavía.","No causes created yet.")}</div>}
 </div>;
}
