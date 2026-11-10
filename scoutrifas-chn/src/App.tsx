import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {ArrowLeft,ArrowRight,BarChart3,Check,CheckCircle2,ChevronDown,Clock3,Compass,Flag,Heart,ImagePlus,LogIn,LogOut,Menu,Mountain,Plus,Search,ShieldCheck,Sparkles,Ticket,Upload,Users,X} from 'lucide-react';
import {backend,cloud,friendlyError,imageUrl,supabase} from './backend';
import type {AccessRequest,Category,FreeDrawEntry,Listing,MemberType,Profile,SupportIntent,SupportPurpose} from './types';
import {canPublish,canViewCatalogue,categories,formatId,freeDrawReady,isLive,isScoutId,money,remaining,supportPurposes} from './types';
import './style.css';

type Screen='explore'|'setup'|'mine'|'activity'|'profile'|'admin';
type AuthMode='login'|'signup';
const sampleHero='https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1600&q=80';
const categoryIcons:Record<Category,string>={Aventura:'⛺',Equipo:'🎒',Coleccionables:'🏅',Experiencias:'🏕️',Arte:'🎨',Otros:'✨'};
const emptyReport:AdminReport={orders:[],tickets:[],confirmed:0,pending:0,totalTickets:0,totalOrders:0,totalReference:0,memberCount:0,pendingMembers:0,supportersCount:0};
function Fleur({size=30}:{size?:number}){return <span className="fleur" style={{fontSize:size}} aria-hidden="true">⚜</span>}
function Avatar({user,size=38}:{user?:Profile|null;size?:number}){
 const src=imageUrl(user?.avatar_path),letters=(user?.display_name||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
 return <span className="avatar" style={{width:size,height:size,fontSize:size*.32}}>{src?<img src={src} alt="Foto de perfil"/>:letters}</span>;
}
function Status({status}:{status:Listing['status']}){
 const names={pending:'En revisión',active:'Publicada',paused:'Pausada',finished:'Finalizada',cancelled:'Cancelada'};
 return <span className={'status status-'+status}>{names[status]}</span>;
}
function Card({item,onOpen}:{item:Listing;onOpen:()=>void}){
 const img=imageUrl(item.image_paths[0]),percent=Math.min(100,Math.round(100*item.free_entry_count/item.max_entries));
 return <button className="listing-card" type="button" onClick={onOpen} aria-label={'Ver '+item.title}>
  <div className="listing-cover">{img?<img src={img} alt={item.title} loading="lazy"/>:<div className="placeholder"><Mountain size={48}/></div>}
   <span className="type-mark raffle"><span className="dot"/> Sorteo sin costo</span>
   {!isLive(item)&&<span className="closed-tag">{item.status==='pending'?'En revisión':'No disponible'}</span>}</div>
  <div className="listing-info">
   <div className="card-eyebrow"><span>{categoryIcons[item.category]} {item.category}</span><span><Clock3 size={13}/>{remaining(item.end_at)}</span></div>
   <h3>{item.title}</h3>
   <div className="host"><Avatar user={item.owner} size={25}/><span>Por <b>{item.owner?.display_name||'Organizador'}</b></span></div>
   <div className="ticket-price-row"><div><small>Participación</small><strong>Gratuita</strong></div><div><small>Participantes</small><strong>{item.free_entry_count} / {item.max_entries}</strong></div></div>
   <div className="progress-track chn-card-progress"><span style={{width:percent+'%'}}/></div>
   <div className="ticket-card-bottom"><span>{freeDrawReady(item)?'Participación abierta':item.status==='finished'?'Resultado registrado':'En preparación legal'}</span><span className="round-arrow"><ArrowRight size={19}/></span></div>
  </div>
 </button>;
}
function Modal({children,onClose,width='560px'}:{children:ReactNode;onClose:()=>void;width?:string}){
 useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[onClose]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation">
  <div className="modal" style={{maxWidth:width}} role="dialog" aria-modal="true">
   <button type="button" className="modal-close icon-button" aria-label="Cerrar" onClick={onClose}><X size={20}/></button>{children}
  </div></div>;
}
function KindPicker({kind,setKind}:{kind:MemberType;setKind:(k:MemberType)=>void}){
 return <div className="mode-cards chn-kind-picker">
  <button type="button" className={kind==='scout'?'active':''} onClick={()=>setKind('scout')}><Fleur size={24}/><b>Soy Scout</b><small>Miembro de la provincia</small></button>
  <button type="button" className={kind==='supporter'?'active':''} onClick={()=>setKind('supporter')}><Heart size={23}/><b>Quiero apoyar</b><small>Amigos y simpatizantes</small></button>
 </div>;
}
function Authentication({mode,setMode,onClose,onSuccess,notify,onApply}:{mode:AuthMode;setMode:(m:AuthMode)=>void;onClose:()=>void;onSuccess:()=>Promise<void>;notify:(s:string,e?:boolean)=>void;onApply:()=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
 const [id,setId]=useState('CHN-'),[group,setGroup]=useState(''),[referral,setReferral]=useState('');
 const [kind,setKind]=useState<MemberType>('supporter'),[adult,setAdult]=useState(false),[busy,setBusy]=useState(false);
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;
  if(mode==='signup'&&kind==='scout'&&!isScoutId(id)){notify('El ID scout no tiene el formato correcto.',true);return;}
  if(mode==='signup'&&kind==='supporter'&&!adult){notify('Este registro es para mayores de edad.',true);return;}
  setBusy(true);
  try{
   if(mode==='signup'){
    const session=await backend.signup(email.trim(),password,name.trim(),kind,formatId(id),group.trim(),adult,referral.trim());
    if(session){await onSuccess();notify('Registro recibido. La comunidad revisará tu solicitud.');onClose();}
    else{notify('Revisa tu correo de confirmación, después inicia sesión.');setMode('login');}
   }else{await backend.login(email.trim(),password);await onSuccess();notify('Sesión iniciada correctamente.');onClose();}
  }catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}
 };
 return <div className="auth-content">
  <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">RIFAS</span> <sup>CHN</sup></span></div>
  <h2>{mode==='signup'?'Crear cuenta aprobada':'Bienvenido de vuelta'}</h2>
  <p className="subtle">{mode==='signup'?'Utiliza el mismo correo y tipo de miembro que autorizó administración.':'Inicia sesión para ver las actividades.'}</p>
  <div className="switcher"><button type="button" className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Iniciar sesión</button><button type="button" className={mode==='signup'?'selected':''} onClick={()=>setMode('signup')}>Crear cuenta</button></div>
  <form className="form-col" onSubmit={submit}>
   {mode==='signup'&&<><KindPicker kind={kind} setKind={setKind}/>
    <label>Nombre a mostrar<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
    {kind==='scout'?<>
      <label>ID scout<input required maxLength={16} value={id} onChange={e=>setId(e.target.value.toUpperCase())} pattern="CHN-?[A-Za-z0-9]{4,12}" placeholder="CHN-000123"/></label>
      <label>Grupo scout<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)} placeholder="Grupo y sección"/></label>
     </>:<label>¿Quién te invitó? (opcional)<input maxLength={120} value={referral} onChange={e=>setReferral(e.target.value)} placeholder="Nombre o grupo que conoces"/></label>}
    <label className="chn-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> Confirmo que tengo 18 años o más{kind==='scout'?' (necesario para solicitar boletos)':''}.</label>
   </>}
   <label>Correo electrónico<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label>
   <label>Contraseña<input required minLength={8} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button className="primary full" type="submit" disabled={busy}>{busy?'Procesando…':mode==='signup'?'Crear mi cuenta':'Entrar a ScoutRifas'}<ArrowRight size={17}/></button>
  </form>
  {mode==='login'&&<button className="chn-forgot-button" type="button" disabled={busy} onClick={async()=>{
    try{setBusy(true);await backend.sendPasswordReset(email);notify('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.');onClose();}
    catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}
   }}>¿Olvidaste tu contraseña?</button>}
  <p className="auth-foot">La cuenta solo se crea después de la aprobación previa. No se procesan pagos en este sitio.</p>
  <button className="chn-forgot-button" type="button" onClick={onApply}>Solicitar acceso por primera vez</button>
 </div>;
}
function AccessApplication({onClose,notify,onRegister}:{onClose:()=>void;notify:(s:string,error?:boolean)=>void;onRegister:()=>void}){
 const [kind,setKind]=useState<MemberType>('supporter'),[name,setName]=useState(''),[email,setEmail]=useState('');
 const [scoutId,setScoutId]=useState('CHN-'),[group,setGroup]=useState(''),[referral,setReferral]=useState('');
 const [adult,setAdult]=useState(false),[honeypot,setHoneypot]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   await backend.requestAccess({name,email,kind,scoutId:formatId(scoutId),group,referral,adult,website:honeypot});
   setSent(true);notify('Solicitud recibida. Puedes crear tu cuenta una vez que administración te haya aprobado.');
  }catch(err){const message=friendlyError(err);setError(message);notify(message,true)}
  finally{setBusy(false)}
 };
 return <div className="auth-content">
  <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">RIFAS</span> <sup>CHN</sup></span></div>
  {sent?<div className="chn-request-done"><CheckCircle2 size={40}/><h2>¡Solicitud recibida!</h2>
    <p>La administración revisará tus datos. Cuando recibas la aprobación, podrás crear tu cuenta con este mismo correo o activar una cuenta existente.</p>
    <button type="button" className="primary full" onClick={onClose}>Entendido <Check size={17}/></button>
    <button type="button" className="chn-forgot-button" onClick={onRegister}>Ya me aprobaron · Crear cuenta</button>
   </div>:<>
   <h2>Solicitar acceso</h2>
   <p className="subtle">Cuéntanos un poco sobre ti. Enviaremos tu solicitud a revisión antes de habilitar el registro.</p>
   {error&&<div className="chn-form-error" role="alert"><Flag size={18}/>{error}</div>}
   <form className="form-col" onSubmit={submit}>
    <KindPicker kind={kind} setKind={setKind}/>
    <label>Tu nombre<input required minLength={2} maxLength={65} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Correo para el registro<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    {kind==='scout'?<><label>ID scout<input required maxLength={16} pattern="CHN-?[A-Za-z0-9]{4,12}" value={scoutId} onChange={e=>setScoutId(e.target.value.toUpperCase())}/></label>
     <label>Grupo y sección<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)}/></label></>:
     <label>¿Quién te invitó? (opcional)<input maxLength={120} value={referral} onChange={e=>setReferral(e.target.value)}/></label>}
    <label className="chn-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> Confirmo ser mayor de edad{kind==='scout'?' si quiero solicitar boletos':''}.</label>
    <label className="chn-honeypot" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={e=>setHoneypot(e.target.value)}/></label>
    <button type="submit" className="primary full" disabled={busy}>{busy?'Enviando…':'Enviar solicitud de acceso'} <ArrowRight size={17}/></button>
   </form>
   <p className="auth-foot">El acceso se concede únicamente tras aprobación. No se cobran cuotas ni boletos desde aquí.</p>
   <button type="button" className="chn-forgot-button" onClick={onRegister}>¿Ya te aprobaron? Crear cuenta</button>
  </>}
 </div>;
}
function PasswordRecovery({onClose,notify}:{onClose:()=>void;notify:(message:string,isError?:boolean)=>void}){
 const [password,setPassword]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;
  if(password!==again){setError('Las contraseñas no coinciden.');return;}
  setBusy(true);setError('');
  try{await backend.changePassword(password);notify('Contraseña actualizada. Ya puedes usar tu cuenta.');onClose()}
  catch(err){const message=friendlyError(err);setError(message);notify(message,true)}
  finally{setBusy(false)}
 };
 return <div className="auth-content">
   <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">RIFAS</span> <sup>CHN</sup></span></div>
   <h2>Crear nueva contraseña</h2><p className="subtle">Tu enlace de recuperación fue validado. Elige una contraseña segura para tu cuenta.</p>
   {error&&<div className="chn-form-error" role="alert"><Flag size={18}/>{error}</div>}
   <form className="form-col" onSubmit={submit}>
    <label>Nueva contraseña<input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>Confirmar contraseña<input type="password" required minLength={10} autoComplete="new-password" value={again} onChange={e=>setAgain(e.target.value)}/></label>
    <button disabled={busy} className="primary full" type="submit">{busy?'Actualizando…':'Guardar nueva contraseña'}<Check size={17}/></button>
   </form>
 </div>;
}
function ExistingMemberJoin({done,cancel,onSkip,onApply,notify}:{done:()=>Promise<void>;cancel:()=>Promise<void>;onSkip:()=>void;onApply:()=>void;notify:(s:string,e?:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const activate=async()=>{if(busy)return;setBusy(true);setError('');
  try{await backend.enrollExisting();await done();notify('Tu acceso quedó activado. ¡Bienvenido a ScoutRifas!')}
  catch(err){const msg=friendlyError(err);setError(msg);notify(msg,true)}
  finally{setBusy(false)}
 };
 return <div className="auth-content">
  <span className="kicker">ACCESO A TU COMUNIDAD</span><h2>Activa tu acceso aprobado</h2>
  <p className="subtle">Ya tienes una sesión en Supabase. Para ingresar a ScoutRifas, primero necesitas una solicitud aprobada con el mismo correo que utilizaste al iniciar sesión.</p>
  {error&&<div className="chn-form-error" role="alert"><Flag size={18}/>{error}</div>}
  <button type="button" className="primary full" disabled={busy} onClick={()=>{void activate()}}>{busy?'Comprobando…':'Activar acceso aprobado'} <CheckCircle2 size={17}/></button>
  <button type="button" className="secondary full" onClick={onApply}>No he enviado solicitud · Solicitar acceso</button>
  <div className="chn-setup-options"><button className="text-logout" type="button" onClick={onSkip}>Volver al inicio</button><button className="text-logout" type="button" onClick={()=>{void cancel()}}>Cerrar sesión</button></div>
 </div>;
}
function Detail({item,user,onClose,onLogin,refresh,notify,onProfile}:{item:Listing;user:Profile|null;onClose:()=>void;onLogin:()=>void;refresh:()=>Promise<void>;notify:(s:string,e?:boolean)=>void;onProfile:(p:Profile)=>void}){
 const [photo,setPhoto]=useState(0),[busy,setBusy]=useState(false),[myEntry,setMyEntry]=useState<FreeDrawEntry|null>(null);
 useEffect(()=>{setPhoto(0)},[item.id]);
 useEffect(()=>{let active=true;if(!user)return;void backend.freeEntries(user.id).then(entries=>{if(active)setMyEntry(entries.find(e=>e.listing_id===item.id)||null)}).catch(()=>{});return()=>{active=false}},[item.id,user?.id]);
 const ready=freeDrawReady(item),full=item.free_entry_count>=item.max_entries;
 const participate=async()=>{
  if(!user){onLogin();return;}
  setBusy(true);
  try{const folio=await backend.joinFreeDraw(item.id);
   setMyEntry({id:'',listing_id:item.id,user_id:user.id,entry_no:folio,created_at:new Date().toISOString()});
   notify('Participación gratuita registrada: número '+String(folio)+'. No fue necesaria una donación.');
   await refresh();
  }catch(err){notify(friendlyError(err),true)}
  finally{setBusy(false)}
 };
 return <div className="detail-layout">
  <div className="detail-image"><img src={imageUrl(item.image_paths[photo])||sampleHero} alt={item.title}/>
   <span className="type-mark raffle"><span className="dot"/> Sorteo sin costo</span>
   {item.image_paths.length>1&&<div className="detail-thumbnails">{item.image_paths.map((p,i)=><button type="button" key={p} className={photo===i?'chosen':''} onClick={()=>setPhoto(i)} aria-label={'Ver fotografía '+String(i+1)}><img src={imageUrl(p)} alt=""/></button>)}</div>}
  </div>
  <div className="detail-main">
   <div className="eyebrow">{categoryIcons[item.category]} {item.category} <span className="sep">•</span> <Status status={item.status}/></div>
   <h2>{item.title}</h2>
   <div className="detail-host">Organiza <button type="button" onClick={()=>{if(item.owner)onProfile(item.owner)}}><Avatar user={item.owner} size={28}/>{item.owner?.display_name||'Organizador'}</button></div>
   <p className="detail-desc">{item.description}</p>
   <div className="detail-grid"><div><Clock3 size={18}/><small>Cierre previsto</small><strong>{remaining(item.end_at)}</strong></div>
     <div><Users size={18}/><small>Participaciones gratuitas</small><strong>{item.free_entry_count} / {item.max_entries}</strong></div></div>
   <div className="ticket-detail-price"><small>Para participar</small><strong>$0 MXN</strong><span>No necesitas donar ni comprar nada. Una participación gratuita por persona.</span></div>
   <div className="progress-track chn-detail-progress"><span style={{width:Math.min(100,100*item.free_entry_count/item.max_entries)+'%'}}/></div>
   {item.status==='finished'&&<div className="winner"><Sparkles size={18}/> Número ganador: <b>{item.winning_ticket_no||'Pendiente'}</b></div>}
   {!ready&&<div className="raffle-note"><Clock3 size={21}/><div><strong>Participación aún no habilitada</strong><p>Se necesita la autorización correspondiente y la publicación de bases oficiales antes de recibir participantes.</p></div></div>}
   {myEntry&&<div className="winner"><CheckCircle2 size={18}/> Ya estás registrado: participación gratuita <b>#{String(myEntry.entry_no).padStart(4,'0')}</b></div>}
   {item.permit_number&&<div className="chn-permit"><ShieldCheck size={17}/> Número de permiso: {item.permit_number}</div>}
   {item.official_rules_url&&<a className="chn-rules-link" href={item.official_rules_url} target="_blank" rel="noopener noreferrer">Consultar bases y condiciones</a>}
   <button className="primary full" type="button" disabled={!ready||busy||!user||!!myEntry||full||user?.id===item.owner_id} onClick={()=>{void participate()}}>
    {busy?'Registrando…':myEntry?'Ya participas en este sorteo':!ready?'Sorteo en preparación':!user?'Inicia sesión':full?'Cupo completo':user.id===item.owner_id?'Eres el organizador':'Participar gratis'}
    <ArrowRight size={17}/>
   </button>
   <p className="detail-disclaimer">Donar es opcional e independiente. Una donación nunca otorga más oportunidades de ganar. Este sorteo requiere autorización aplicable para abrir participaciones.</p>
   <button type="button" className="text-logout" onClick={onClose}>Cerrar detalle</button>
  </div>
 </div>;
}
function CreateListing({user,onClose,done,notify}:{user:Profile;onClose:()=>void;done:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState<Category>('Aventura');
 const [endAt,setEndAt]=useState(''),[capacity,setCapacity]=useState(100),[photos,setPhotos]=useState<File[]>([]),[busy,setBusy]=useState(false);
 const preview=useMemo(()=>photos.map(file=>({name:file.name,url:URL.createObjectURL(file)})),[photos]);
 useEffect(()=>()=>{preview.forEach(p=>URL.revokeObjectURL(p.url))},[preview]);
 const addPhotos=(files:File[])=>{
  const valid=files.filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size<=5*1024*1024);
  if(valid.length!==files.length)notify('Solo JPG, PNG o WebP, hasta 5 MB por foto.',true);
  if(valid.length>10-photos.length)notify('Máximo 10 imágenes.',true);
  setPhotos(previous=>[...previous,...valid.slice(0,10-previous.length)]);
 };
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;
  if(new Date(endAt).getTime()<Date.now()+3600000){notify('El cierre debe ser al menos una hora en el futuro.',true);return;}
  if(photos.length<1||photos.length>10){notify('Agrega de 1 a 10 fotografías.',true);return;}
  setBusy(true);const uploaded:string[]=[];
  try{
   for(const photo of photos)uploaded.push(await backend.upload(photo,user.id,'listings'));
   await backend.createFreeDraw({title,description,category,endAt:new Date(endAt).toISOString(),capacity,images:uploaded});
   await done();onClose();notify('Sorteo creado para revisión. No recibe participaciones hasta su autorización.');
  }catch(err){if(uploaded.length)await backend.removeUploaded(uploaded,'listings').catch(()=>{});notify(friendlyError(err),true)}
  finally{setBusy(false)}
 };
 return <div className="create-modal chn-create-modal"><span className="kicker">EXPERIENCIAS PARA COMPARTIR</span>
  <h2>Preparar un sorteo gratuito</h2>
  <p className="subtle">El registro para participar no tendrá costo ni dependerá de donaciones. Administración revisará el sorteo y la documentación antes de abrirlo.</p>
  <form className="form-col" onSubmit={submit}>
   <label>Premio o experiencia<input required minLength={5} maxLength={110} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Kit de campamento"/></label>
   <label>Descripción y condiciones<textarea required minLength={20} maxLength={2500} rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label>
   <div className="two-fields"><label>Categoría<select value={category} onChange={e=>setCategory(e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Fecha prevista de cierre<input required type="datetime-local" value={endAt} onChange={e=>setEndAt(e.target.value)}/></label></div>
   <label>Máximo de participantes<input required type="number" min={1} max={100000} step={1} value={capacity} onChange={e=>setCapacity(Number(e.target.value))}/></label>
   <label>Fotografías ({photos.length}/10)<div className="upload-zone"><ImagePlus size={25}/><b>Seleccionar fotos</b><small>Hasta diez imágenes de 5 MB</small><input type="file" multiple disabled={busy||photos.length>=10} accept="image/jpeg,image/png,image/webp" onChange={e=>{addPhotos(Array.from(e.target.files||[]));e.target.value=''}}/></div></label>
   {!!preview.length&&<div className="chn-upload-previews">{preview.map((p,i)=><div className="chn-preview" key={p.url}><img src={p.url} alt={'Foto '+(i+1)}/><button type="button" aria-label={'Quitar '+p.name} disabled={busy} onClick={()=>setPhotos(list=>list.filter((_,j)=>i!==j))}><X size={16}/></button></div>)}</div>}
   <div className="notice"><ShieldCheck size={18}/> Crear un sorteo gratuito no exime de permisos. Nunca se habilitará participación antes de comprobar una autorización aplicable.</div>
   <button className="primary full" disabled={busy} type="submit">{busy?'Preparando…':'Enviar sorteo a revisión'}<ArrowRight size={17}/></button>
  </form>
 </div>;
}
function SupportIntentModal({onClose,onSaved,notify}:{onClose:()=>void;onSaved:()=>void;notify:(s:string,e?:boolean)=>void}){
 const [amount,setAmount]=useState(100),[purpose,setPurpose]=useState<SupportPurpose>('General'),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;
  setBusy(true);try{await backend.submitSupportIntent(amount,purpose,note);
   notify('Tu intención de apoyo quedó registrada. No se realizó ningún cobro ni se te asignó participación.');
   onSaved();onClose();
  }catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}
 };
 return <div className="auth-content"><div className="modal-brand"><span className="brand-icon"><Heart size={23}/></span><span>SCOUT<span className="brand-strong">APOYA</span> <sup>CHN</sup></span></div>
  <h2>Apoya una buena acción</h2>
  <p className="subtle">Registra una intención de donación para apoyar una causa scout. <b>Este formulario no cobra dinero.</b></p>
  <form className="form-col" onSubmit={submit}>
   <label>Monto que te gustaría aportar (MXN)</label>
   <div className="chn-donation-amounts">{[50,100,200,500].map(n=><button type="button" key={n} className={amount===n?'selected':''} onClick={()=>setAmount(n)}>{money(n)}</button>)}</div>
   <label>Otro monto<input type="number" min={20} max={100000} required step={1} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
   <label>Destino del apoyo<select value={purpose} onChange={e=>setPurpose(e.target.value as SupportPurpose)}>{supportPurposes.map(c=><option key={c}>{c}</option>)}</select></label>
   <label>Mensaje (opcional)<textarea rows={2} maxLength={240} value={note} onChange={e=>setNote(e.target.value)} placeholder="¿A quién te gustaría ayudar?"/></label>
   <div className="notice"><Heart size={18}/> Donar no es requisito para entrar a los sorteos gratuitos y no te da más participaciones. No se realizan transferencias ni cobros.</div>
   <button className="primary full" disabled={busy} type="submit">{busy?'Guardando…':'Registrar intención de apoyar'} <Heart size={16}/></button>
  </form>
 </div>;
}
function ProfilePage({person,current,onSave,notify,listings,onOpen}:{person:Profile;current:boolean;onSave:()=>Promise<void>;notify:(s:string,e?:boolean)=>void;listings:Listing[];onOpen:(l:Listing)=>void}){
 const [name,setName]=useState(person.display_name),[group,setGroup]=useState(person.group_name),[bio,setBio]=useState(person.bio),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[adult,setAdult]=useState(person.adult_attested);
 useEffect(()=>{setName(person.display_name);setGroup(person.group_name);setBio(person.bio);setFile(null);setAdult(person.adult_attested)},[person.id,person.display_name,person.group_name,person.bio,person.adult_attested]);
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{
  const path=file?await backend.upload(file,person.id,'avatars'):person.avatar_path;
  await backend.updateProfile(person.id,{display_name:name.trim(),group_name:group.trim(),bio:bio.trim(),avatar_path:path});
  if(adult&&!person.adult_attested)await backend.attestAdult();
  await onSave();notify('Perfil actualizado.');setFile(null);
 }catch(err){notify(err instanceof Error?err.message:'No se pudo guardar.',true)}finally{setBusy(false)}};
 const title=person.member_type==='supporter'?'Simpatizante de la comunidad':person.scout_id||'Miembro scout';
 return <section className="profile-view"><div className="profile-banner"><Fleur size={76}/><div className="topography"/></div>
  <div className="profile-head"><Avatar user={person} size={102}/><div><div className="inline-heading"><h2>{person.display_name}</h2>{person.verified?<span className="verified"><CheckCircle2 size={15}/> Verificado</span>:<span className="pending"><Clock3 size={15}/> Por verificar</span>}</div><p>{title} · {person.group_name||'Chihuahua Norte'}</p></div></div>
  {current?<form className="form-col profile-edit" onSubmit={submit}><h3>Editar mi perfil</h3>
   <label>Foto de perfil<div className="file-button"><Upload size={18}/>{file?.name||'Elegir imagen'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></div></label>
   <label>Nombre<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)}/></label>
   {person.member_type==='scout'&&<label>Grupo scout<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)}/></label>}
   <label>Sobre mí<textarea maxLength={320} rows={3} value={bio} onChange={e=>setBio(e.target.value)}/></label>
   {!person.adult_attested&&<label className="chn-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> Confirmo ser mayor de 18 años.</label>}
   <button className="primary" disabled={busy} type="submit">{busy?'Guardando…':'Guardar cambios'}<Check size={16}/></button></form>:
   <div className="public-bio"><h3>Sobre esta persona</h3><p>{person.bio||'Miembro de nuestra comunidad.'}</p></div>}
  <div className="public-listings"><h3>Rifas de {person.display_name.split(' ')[0]}</h3>{listings.length?<div className="cards-grid">{listings.map(l=><Card key={l.id} item={l} onOpen={()=>onOpen(l)}/>)}</div>:<p className="empty-small">Todavía no tiene publicaciones.</p>}</div>
 </section>;
}
function Admin({items,refresh,notify}:{items:Listing[];refresh:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
 const [members,setMembers]=useState<Profile[]>([]),[applications,setApplications]=useState<AccessRequest[]>([]);
 const [entries,setEntries]=useState<FreeDrawEntry[]>([]),[pledges,setPledges]=useState<SupportIntent[]>([]);
 const [tab,setTab]=useState<'applications'|'draws'|'support'|'entries'|'members'>('applications'),[search,setSearch]=useState('');
 const [busy,setBusy]=useState(''),[updated,setUpdated]=useState<Date|null>(null);
 const [numbers,setNumbers]=useState<Record<string,string>>({}),[references,setReferences]=useState<Record<string,string>>({});
 const reload=useCallback(async()=>{
  try{const [people,requests,drawEntries,support]=await Promise.all([backend.members(),backend.accessRequests(),backend.freeEntries(),backend.supportIntents()]);
   setMembers(people);setApplications(requests);setEntries(drawEntries);setPledges(support);setUpdated(new Date());
  }catch(err){notify(friendlyError(err),true)}
 },[notify]);
 useEffect(()=>{void reload();const t=window.setInterval(()=>{void reload();void refresh().catch(()=>{})},15000);return()=>window.clearInterval(t)},[reload,refresh]);
 const names=new Map(members.map(m=>[m.id,m]));
 const listings=new Map(items.map(l=>[l.id,l]));
 const query=search.trim().toLowerCase();
 const matches=(...parts:(string|number|null|undefined)[])=>!query||parts.join(' ').toLowerCase().includes(query);
 const action=async(id:string,fn:()=>Promise<unknown>,msg:string)=>{setBusy(id);try{await fn();await Promise.all([reload(),refresh()]);notify(msg)}catch(err){notify(friendlyError(err),true)}finally{setBusy('')}};
 const reviewAccess=(r:AccessRequest,approve:boolean)=>void action(r.id,()=>backend.reviewAccess(r.id,approve),approve?'Solicitud aprobada. Notifica a la persona para que complete su registro.':'Solicitud rechazada.');
 const reviewDraw=(id:string,status:'active'|'paused'|'cancelled')=>void action(id,()=>backend.reviewListing(id,status),'Sorteo actualizado. La participación sigue sujeta a autorización de SEGOB.');
 const verify=(id:string,value:boolean)=>void action(id,()=>backend.reviewUser(id,value),'Estado de usuario actualizado.');
 const finish=(l:Listing)=>{
  const entry=Number(numbers[l.id]),reference=references[l.id]||'';
  if(!Number.isInteger(entry)||entry<1||reference.trim().length<8){notify('Ingresa un número confirmado y una referencia del acta.',true);return;}
  if(!window.confirm('¿El resultado corresponde al sorteo oficial autorizado? Registrar es irreversible.'))return;
  void action(l.id,()=>backend.recordFreeDraw(l.id,entry,reference),'Resultado oficial guardado.');
 };
 const exportPledges=()=>{
  const cell=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+\-@]/,"'$&")+'"';
  const rows=[['Fecha','Usuario','Destino','Monto MXN','Estado'],...pledges.map(x=>[x.created_at,names.get(x.user_id)?.display_name||'',x.purpose,x.amount,'Solo intención'])];
  const url=URL.createObjectURL(new Blob([String.fromCharCode(65279)+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='scoutapoya-intenciones.csv';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="admin-view">
  <div className="section-title"><div><span className="kicker">CONTROL COMUNITARIO</span><h2>Panel de administración</h2><p>Accesos, sorteos gratuitos y compromisos voluntarios de apoyo.</p></div><ShieldCheck size={38} className="admin-shield"/></div>
  <div className="stat-grid chn-stats">
   <div className="stat"><Users/><b>{applications.filter(r=>r.status==='pending').length}</b><span>Solicitudes por revisar</span></div>
   <div className="stat"><Ticket/><b>{items.filter(l=>l.status==='pending').length}</b><span>Sorteos por revisar</span></div>
   <div className="stat"><CheckCircle2/><b>{members.length}</b><span>Miembros</span></div>
   <div className="stat"><Heart/><b>{pledges.length}</b><span>Intenciones de apoyo</span></div>
   <div className="stat"><Users/><b>{entries.length}</b><span>Participaciones gratis*</span></div>
   <div className="stat"><BarChart3/><b>{money(pledges.reduce((sum,p)=>sum+p.amount,0))}</b><span>Monto comprometido, NO cobrado</span></div>
  </div>
  <div className="admin-toolbar"><small>Actualización aproximada cada 15 segundos{updated?' · '+updated.toLocaleTimeString('es-MX'):''}</small><button className="secondary" onClick={()=>{void reload();void refresh()}}>Actualizar</button></div>
  <div className="tabs admin-tabs">
   <button className={tab==='applications'?'active':''} onClick={()=>setTab('applications')}>Accesos ({applications.filter(r=>r.status==='pending').length})</button>
   <button className={tab==='draws'?'active':''} onClick={()=>setTab('draws')}>Sorteos ({items.length})</button>
   <button className={tab==='support'?'active':''} onClick={()=>setTab('support')}>Apoyos ({pledges.length})</button>
   <button className={tab==='entries'?'active':''} onClick={()=>setTab('entries')}>Participantes ({entries.length})</button>
   <button className={tab==='members'?'active':''} onClick={()=>setTab('members')}>Usuarios</button>
  </div>
  <div className="admin-filter"><label className="search-field"><Search size={18}/><input aria-label="Buscar en administración" placeholder="Buscar nombre, correo o sorteo" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {tab==='support'&&<button className="secondary" type="button" onClick={exportPledges}>Exportar CSV</button>}</div>
  {tab==='applications'&&<div className="admin-list">{applications.filter(r=>matches(r.display_name,r.email,r.scout_id,r.status)).map(r=><div className="admin-line" key={r.id}>
   <div className="history-symbol"><Users size={22}/></div><div className="grow"><b>{r.display_name}</b><p>{r.email} · {r.member_type==='scout'?'Scout':'Simpatizante'} · {r.scout_id||r.referral_note||'Sin referencia'}</p>
    <small>{new Date(r.created_at).toLocaleDateString('es-MX')} · {r.status}</small></div>
   <div className="admin-actions">{r.status==='pending'&&<><button className="small-approve" disabled={!!busy} onClick={()=>reviewAccess(r,true)}>Aprobar</button><button className="danger" disabled={!!busy} onClick={()=>reviewAccess(r,false)}>Rechazar</button></>}
    {r.status==='approved'&&<a className="chn-email-link" href={'mailto:'+r.email+'?subject='+encodeURIComponent('ScoutApoya CHN: acceso aprobado')+'&body='+encodeURIComponent('Tu acceso fue aprobado. Visita https://scoutrifas-chn.vercel.app para registrar tu cuenta usando este correo.')}>Preparar aviso</a>}</div>
   </div>)}{!applications.length&&<p className="empty-small">Todavía no hay solicitudes de acceso.</p>}</div>}
  {tab==='draws'&&<div className="admin-list">{items.filter(l=>matches(l.title,l.status,l.owner?.display_name)).map(l=><div className="admin-line" key={l.id}>
    <img src={imageUrl(l.image_paths[0])||sampleHero} alt=""/>
    <div className="grow"><b>{l.title}</b><p>{l.owner?.display_name||'Organizador'} · Termina {new Date(l.end_at).toLocaleString('es-MX')}</p>
     <Status status={l.status}/><div className="mini-metrics">{l.free_entry_count} de {l.max_entries} participaciones · {l.free_entry_authorized?'Autorización registrada':'Participación bloqueada'}</div>
     {l.status==='active'&&new Date(l.end_at).getTime()<=Date.now()&&l.free_entry_authorized&&<div className="chn-draw-fields">
      <label>Número ganador<input type="number" min={1} value={numbers[l.id]||''} onChange={e=>setNumbers(v=>({...v,[l.id]:e.target.value}))}/></label>
      <label>Acta oficial<input value={references[l.id]||''} onChange={e=>setReferences(v=>({...v,[l.id]:e.target.value}))}/></label>
      <button className="small-approve" disabled={!!busy} onClick={()=>finish(l)}>Registrar resultado oficial</button></div>}
    </div><div className="admin-actions">
     {(l.status==='pending'||l.status==='paused')&&<button className="small-approve" disabled={!!busy} onClick={()=>reviewDraw(l.id,'active')}>Publicar</button>}
     {l.status==='active'&&<button disabled={!!busy} onClick={()=>reviewDraw(l.id,'paused')}>Pausar</button>}
     {['active','pending','paused'].includes(l.status)&&<button className="danger" disabled={!!busy} onClick={()=>reviewDraw(l.id,'cancelled')}>Cancelar</button>}
    </div></div>)}{!items.length&&<p className="empty-small">No hay sorteos creados.</p>}</div>}
  {tab==='support'&&<div className="admin-list">{pledges.filter(p=>matches(p.purpose,p.note,names.get(p.user_id)?.display_name)).map(p=><div className="admin-line chn-history" key={p.id}>
    <div className="history-symbol"><Heart size={20}/></div><div className="grow"><b>{names.get(p.user_id)?.display_name||'Miembro'}</b><p>Destino: {p.purpose} · {new Date(p.created_at).toLocaleString('es-MX')}</p>{p.note&&<small>{p.note}</small>}</div>
    <strong className="history-amount">{money(p.amount)}<small style={{display:'block',fontWeight:400,fontSize:11}}>No cobrado</small></strong>
  </div>)}{!pledges.length&&<p className="empty-small">Aún no se han registrado intenciones de apoyo.</p>}</div>}
  {tab==='entries'&&<div className="admin-list">{entries.filter(e=>matches(listings.get(e.listing_id)?.title,names.get(e.user_id)?.display_name,e.entry_no)).map(e=><div className="admin-line chn-history" key={e.id}>
   <div className="history-symbol"><Ticket size={20}/></div><div className="grow"><b>{listings.get(e.listing_id)?.title||'Sorteo'}</b><p>{names.get(e.user_id)?.display_name||'Miembro'} · {new Date(e.created_at).toLocaleString('es-MX')}</p></div>
   <strong className="history-amount">#{String(e.entry_no).padStart(4,'0')}</strong>
   </div>)}{!entries.length&&<p className="empty-small">No hay participaciones gratuitas todavía.</p>}</div>}
  {tab==='members'&&<div className="admin-list">{members.filter(m=>matches(m.display_name,m.scout_id,m.member_type)).map(m=><div className="admin-line user-line" key={m.id}>
    <Avatar user={m} size={48}/><div className="grow"><b>{m.display_name}</b><p>{m.member_type==='supporter'?'Simpatizante':m.scout_id} · {m.group_name}</p></div>
    <div className="admin-actions">{m.role==='admin'?<span className="verified">Administrador único</span>:
     <button disabled={!!busy} className={m.verified?'danger':'small-approve'} onClick={()=>verify(m.id,!m.verified)}>{m.verified?'Revocar acceso':'Aprobar acceso'}</button>}</div>
    </div>)}</div>}
  <p className="detail-disclaimer">*Resumen de los últimos 1,000 registros. Los montos son intenciones de apoyo, NO dinero recaudado. Aprobación de publicación no equivale a permiso para celebrar sorteos; el acceso a sorteos sigue bloqueado hasta tener autorización aplicable.</p>
 </section>;
}
export default function App(){
 const setupDismissed=useRef(false);
 const [viewer,setViewer]=useState<Profile|null>(null),[needsEnrollment,setNeedsEnrollment]=useState(false),[items,setItems]=useState<Listing[]>([]),[loading,setLoading]=useState(true);
 const [screen,setScreen]=useState<Screen>('explore'),[profileTarget,setProfileTarget]=useState<Profile|null>(null),[selected,setSelected]=useState<Listing|null>(null);
 const [application,setApplication]=useState(false),[auth,setAuth]=useState<AuthMode|null>(null),[passwordRecovery,setPasswordRecovery]=useState(false),[creating,setCreating]=useState(false),[menu,setMenu]=useState(false),[query,setQuery]=useState(''),[category,setCategory]=useState('Todas'),[sort,setSort]=useState('recent');
 const [myOrders,setMyOrders]=useState<TicketOrder[]>([]),[myTickets,setMyTickets]=useState<TicketNumber[]>([]),[toast,setToast]=useState<{text:string;error:boolean}|null>(null);
 const notify=useCallback((text:string,error=false)=>setToast({text,error}),[]);
 useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),5500);return()=>window.clearTimeout(id)},[toast]);
 const refresh=useCallback(async()=>{const list=await backend.list();setItems(list);setSelected(current=>current?list.find(l=>l.id===current.id)||null:null)},[]);
 const refreshUser=useCallback(async()=>{
  const person=await backend.session();
  const hasAccountWithoutProfile=!person&&cloud?await backend.isSignedIn():false;
  setViewer(person);
  setNeedsEnrollment(hasAccountWithoutProfile);
  if(hasAccountWithoutProfile){
   setItems([]);setSelected(null);setMyOrders([]);setMyTickets([]);
   if(!setupDismissed.current)setScreen(current=>current==='setup'?current:'setup');
  }else if(canViewCatalogue(person)){
   setItems(await backend.list());
   if(person?.role==='admin')setScreen(current=>current==='explore'||current==='setup'?'admin':current);
   else setScreen(current=>current==='setup'?'explore':current);
  }else{
   setItems([]);setSelected(null);setMyOrders([]);setMyTickets([]);
   setScreen(current=>current==='setup'?'explore':current);
  }
 },[]);
 useEffect(()=>{let active=true;
  void refreshUser().catch(err=>notify(err instanceof Error?err.message:'Error al cargar sesión.',true)).finally(()=>{if(active)setLoading(false)});
  const observer=supabase?.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){setAuth(null);setPasswordRecovery(true)}window.setTimeout(()=>{if(active)void refreshUser().catch(()=>{})},0)});
  return()=>{active=false;observer?.data.subscription.unsubscribe()};
 },[refreshUser,notify]);
 useEffect(()=>{if(!canViewCatalogue(viewer))return;const interval=window.setInterval(()=>void refresh().catch(()=>{}),15000);return()=>window.clearInterval(interval)},[viewer?.id,viewer?.verified,refresh]);
 useEffect(()=>{if(screen!=='activity'||!viewer)return;void Promise.all([backend.orders(viewer.id),backend.tickets(viewer.id)]).then(([o,t])=>{setMyOrders(o);setMyTickets(t)}).catch(err=>notify(err instanceof Error?err.message:'Error al cargar tus boletos.',true))},[screen,viewer,items,notify]);
 const access=canViewCatalogue(viewer);
 const results=useMemo(()=>{if(!access)return[];
  const text=query.trim().toLowerCase();
  let list=items.filter(l=>l.type==='raffle'&&(l.status==='active'||l.status==='finished'));
  if(text)list=list.filter(l=>(l.title+' '+l.description+' '+l.category+' '+(l.owner?.display_name||'')).toLowerCase().includes(text));
  if(category!=='Todas')list=list.filter(l=>l.category===category);
  return [...list].sort((a,b)=>sort==='ending'?new Date(a.end_at).getTime()-new Date(b.end_at).getTime():sort==='popular'?b.entry_count-a.entry_count:new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
 },[access,items,query,category,sort]);
 const openApplication=()=>{setAuth(null);setApplication(true)};
 const openApprovedRegistration=()=>{setApplication(false);setAuth('signup')};
 const show=(screenName:Screen)=>{if(screenName==='setup'&&needsEnrollment){setupDismissed.current=false;setScreen('setup');return;}if(screenName!=='explore'&&!access && !(screenName==='profile'&&viewer)){if(!viewer)setAuth('login');else notify('Tu cuenta está pendiente de activación.',true);return;}
  if(screenName==='admin'&&viewer?.role!=='admin'){notify('Área privada.',true);return;}
  setScreen(screenName);setProfileTarget(null);setMenu(false);window.scrollTo({top:0,behavior:'smooth'});
 };
 const openCreate=()=>{if(!viewer){openApplication();return;}if(!canPublish(viewer)){notify('Tu cuenta no tiene permisos para organizar rifas.',true);return;}setCreating(true)};
 const viewProfile=(p:Profile)=>{setProfileTarget(p);setScreen('profile');setSelected(null);window.scrollTo({top:0,behavior:'smooth'})};
 const logout=async()=>{try{await backend.logout();setupDismissed.current=false;setViewer(null);setNeedsEnrollment(false);setItems([]);setSelected(null);setProfileTarget(null);setScreen('explore');notify('Sesión cerrada.')}catch(err){notify(err instanceof Error?err.message:'Error',true)}};
 const mine=access?items.filter(l=>l.owner_id===viewer?.id):[],totalActive=items.filter(isLive).length;
 return <>
  <header className="site-header"><div className="nav-container">
   <button className="logo" onClick={()=>show('explore')} aria-label="ScoutRifas inicio"><span className="logo-mark"><Fleur size={29}/></span><span className="logo-name">SCOUT<span>RIFAS</span><small>CHIHUAHUA NORTE</small></span></button>
   <nav className={menu?'nav-links open':'nav-links'}>
    <button className={screen==='explore'?'nav-active':''} onClick={()=>show('explore')}>Explorar</button>
    {access&&canPublish(viewer)&&<button className={screen==='mine'?'nav-active':''} onClick={()=>show('mine')}>Mis rifas</button>}
    {access&&<button className={screen==='activity'?'nav-active':''} onClick={()=>show('activity')}>Mis boletos</button>}
    {access&&viewer?.role==='admin'&&<button className={screen==='admin'?'nav-active':''} onClick={()=>show('admin')}>Administración</button>}
   </nav>
   <div className="nav-right">{canPublish(viewer)&&<button className="create-nav" onClick={openCreate}><Plus size={18}/> Crear rifa</button>}
    {viewer?<button className="account" onClick={()=>viewProfile(viewer)}><Avatar user={viewer} size={34}/><span>{viewer.display_name.split(' ')[0]}</span><ChevronDown size={15}/></button>:
     needsEnrollment?<button className="sign-in" onClick={()=>show('setup')}><CheckCircle2 size={17}/> Completar perfil</button>:cloud?<button className="sign-in" onClick={()=>setAuth('login')}><LogIn size={17}/> Iniciar sesión</button>:null}
    <button className="menu-button" onClick={()=>setMenu(!menu)} aria-label="Abrir menú"><Menu size={24}/></button>
   </div></div></header>
  <main>{screen==='explore'?<>
   <div className="hero-shell"><section className="hero"><div className="hero-photo" style={{backgroundImage:"linear-gradient(90deg, rgba(33,23,44,.91) 0%, rgba(33,23,44,.65) 49%, rgba(33,23,44,.2) 100%),url('"+sampleHero+"')"}}/>
    <div className="hero-content"><span className="hero-label"><span className="hero-star">✦</span> PROVINCIA CHIHUAHUA NORTE</span>
     <h1>Compartir también<br/>es una <em>aventura.</em></h1>
     <p>Únete a quienes ayudan a que nuevas aventuras, proyectos y buenas acciones se conviertan en realidad.</p>
     <div className="hero-actions"><button className="hero-primary" onClick={()=>access?document.getElementById('explorar')?.scrollIntoView({behavior:'smooth'}):needsEnrollment?show('setup'):openApplication()}>
      {access?'Explorar las rifas':'Quiero apoyar'} <ArrowRight size={18}/></button>
      {access&&canPublish(viewer)&&<button className="hero-secondary" onClick={openCreate}><Plus size={18}/> Organizar una rifa</button>}
     </div></div><div className="hero-stamp"><Fleur size={27}/><span>SIEMPRE<br/>LISTOS</span></div>
   </section></div>
   <section className="intro-strip"><div><div className="strip-icon"><Compass size={24}/></div><div><b>Comunidad primero</b><span>Cada buena acción cuenta</span></div></div>
    <div><div className="strip-icon"><ShieldCheck size={24}/></div><div><b>Organización transparente</b><span>Solicitudes y folios verificables</span></div></div>
    <div><div className="strip-icon"><Heart size={24}/></div><div><b>Todos pueden apoyar</b><span>Exploradores y amigos</span></div></div></section>
   {access?<section className="explore-section" id="explorar"><div className="section-title"><div><span className="kicker">EXPLORA Y APOYA</span><h2>Próximas rifas <span>✦</span></h2><p>Premios y experiencias preparados por nuestra comunidad.</p></div><div className="headline-stat"><b>{totalActive}</b><span>rifas activas</span></div></div>
     <div className="filter-wrap"><div className="category-tabs"><button className="active"><Ticket size={16}/> Rifas por boletos</button></div>
      <div className="filter-controls"><label className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar premios y experiencias…" aria-label="Buscar rifas"/></label>
       <select aria-label="Filtrar categoría" value={category} onChange={e=>setCategory(e.target.value)}><option>Todas</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
       <select aria-label="Ordenar resultados" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Más recientes</option><option value="ending">Próximas a cerrar</option><option value="popular">Más participantes</option></select>
      </div></div>
     {loading?<div className="empty"><Compass className="spin" size={38}/> Cargando rifas…</div>:results.length?<div className="cards-grid">{results.map(l=><Card key={l.id} item={l} onOpen={()=>setSelected(l)}/>)}</div>:
      <div className="empty"><Compass size={42}/><h3>Sin rifas para mostrar</h3><p>Prueba otra búsqueda o vuelve pronto.</p><button className="secondary" onClick={()=>{setQuery('');setCategory('Todas')}}>Quitar filtros</button></div>}
    </section>:<section className="explore-section private-welcome"><div className="private-welcome-inner"><Compass size={34}/><h2>{viewer?'Bienvenido a la comunidad':'Tu próxima aventura empieza aquí'}</h2>
     <p>{viewer?'Estamos revisando tu solicitud de acceso.':needsEnrollment?'Tienes un registro sin completar. Puedes terminarlo cuando quieras.':cloud?'Inicia sesión o únete para descubrir lo que estamos preparando.':'Este espacio se encuentra en preparación.'}</p>
     {!viewer&&cloud&&<button className="primary" onClick={()=>needsEnrollment?show('setup'):openApplication()}>{needsEnrollment?'Completar perfil':'Solicitar acceso'} <ArrowRight size={17}/></button>}
    </div></section>}
   {access&&canPublish(viewer)&&<section className="cta-panel"><div className="cta-ornament"><Fleur size={85}/></div><div><span className="kicker light">TU SIGUIENTE BUENA ACCIÓN</span><h2>¿Tienes un premio para compartir?</h2><p>Prepara una rifa y envíala a revisión. Solo las rifas autorizadas podrán distribuir boletos.</p></div><button onClick={openCreate} className="cta-button">Preparar rifa <ArrowRight size={19}/></button></section>}
   </>:screen==='setup'?<section className="inner-page chn-setup-page">
     <div className="chn-setup-card"><div className="chn-setup-badge"><Fleur size={27}/></div>
      <ExistingMemberJoin done={refreshUser} cancel={logout} onSkip={()=>{setupDismissed.current=true;setScreen('explore')}} onApply={openApplication} notify={notify}/>
     </div>
    </section>:screen==='mine'?<section className="inner-page"><div className="section-title"><div><span className="kicker">MIS ACTIVIDADES</span><h2>Mis rifas</h2><p>Publicaciones y estado de cada sorteo que organizas.</p></div><button className="primary" onClick={openCreate}><Plus size={17}/> Nueva rifa</button></div>
    {mine.length?<div className="cards-grid">{mine.map(l=><Card key={l.id} item={l} onOpen={()=>setSelected(l)}/>)}</div>:
     <div className="empty"><Ticket size={38}/><h3>Aún no organizas rifas</h3><button className="primary" onClick={openCreate}>Preparar mi primera rifa</button></div>}
   </section>:screen==='activity'?<section className="inner-page"><div className="section-title"><div><span className="kicker">MIS PARTICIPACIONES</span><h2>Mis boletos</h2><p>Solicitudes, confirmaciones y folios asignados.</p></div><Ticket size={40} className="page-icon"/></div>
     <div className="activity-grid"><div className="activity-block"><h3><Clock3 size={20}/> Mis solicitudes <span>{myOrders.length}</span></h3>
      {myOrders.length?myOrders.map(o=>{const l=items.find(x=>x.id===o.listing_id);return <button key={o.id} className="activity-row" onClick={()=>{if(l)setSelected(l)}}>
       <b>{l?.title||'Rifa'}</b><small>{o.quantity} × {money(o.unit_price)} · {o.status==='pending'&&new Date(o.expires_at)<new Date()?'Caducó':o.status==='confirmed'?'Confirmada':o.status==='cancelled'?'Cancelada':'En revisión'}</small><ArrowRight size={16}/></button>}):<p className="empty-small">Todavía no has solicitado boletos.</p>}
     </div><div className="activity-block"><h3><Ticket size={20}/> Mis folios <span>{myTickets.length}</span></h3>
      {myTickets.length?myTickets.map(t=>{const l=items.find(x=>x.id===t.listing_id);return <button key={t.id} className="activity-row" onClick={()=>{if(l)setSelected(l)}}>
       <b>{l?.title||'Rifa'}</b><small>Folio #{String(t.ticket_no).padStart(4,'0')}</small><ArrowRight size={16}/></button>}):<p className="empty-small">Los folios aparecerán después de la confirmación autorizada.</p>}
     </div></div>
   </section>:screen==='profile'?(profileTarget||viewer)&&<div className="inner-page profile-container"><button className="back-link" onClick={()=>show('explore')}><ArrowLeft size={17}/> Volver a explorar</button>
    <ProfilePage person={viewer&&profileTarget?.id===viewer.id?viewer:(profileTarget||viewer)!} current={viewer?.id===(profileTarget||viewer)?.id} onSave={refreshUser} notify={notify}
     listings={items.filter(l=>l.owner_id===(profileTarget||viewer)?.id&&(l.status==='active'||l.status==='finished'||viewer?.id===l.owner_id))} onOpen={setSelected}/>
    {viewer?.id===(profileTarget||viewer)?.id&&<button className="text-logout" onClick={()=>{void logout()}}><LogOut size={16}/> Cerrar sesión</button>}
   </div>:screen==='admin'&&viewer?.role==='admin'?<div className="inner-page"><Admin items={items} refresh={refresh} notify={notify}/></div>:null}
  </main>
  <footer className="footer"><div className="footer-top"><div className="footer-brand"><div className="logo-mark"><Fleur size={27}/></div><div><b>SCOUTRIFAS <span>CHN</span></b><p>La comunidad que comparte y crece.</p></div></div><div className="footer-links"><button onClick={()=>show('explore')}>Inicio</button>{access&&<button onClick={()=>show('activity')}>Mis boletos</button>}{canPublish(viewer)&&<button onClick={openCreate}>Crear rifa</button>}</div></div>
   <div className="footer-bottom"><span>© {new Date().getFullYear()} ScoutRifas CHN · Proyecto comunitario</span><span>Sin cobros integrados · No oficial de ASMAC salvo autorización expresa</span></div></footer>
  {toast&&<div className={'toast'+(toast.error?' error':'')} role="status">{toast.error?<Flag size={18}/>:<CheckCircle2 size={18}/>} {toast.text}<button onClick={()=>setToast(null)} aria-label="Cerrar"><X size={16}/></button></div>}
  
  {application&&<Modal onClose={()=>setApplication(false)}><AccessApplication onClose={()=>setApplication(false)} notify={notify} onRegister={openApprovedRegistration}/></Modal>}
  {passwordRecovery&&<Modal onClose={()=>setPasswordRecovery(false)}><PasswordRecovery onClose={()=>setPasswordRecovery(false)} notify={notify}/></Modal>}
  {auth&&<Modal onClose={()=>setAuth(null)}><Authentication mode={auth} setMode={setAuth} onClose={()=>setAuth(null)} onSuccess={async()=>{setupDismissed.current=false;await refreshUser()}} notify={notify} onApply={openApplication}/></Modal>}
  {creating&&viewer&&<Modal width="850px" onClose={()=>setCreating(false)}><CreateListing user={viewer} onClose={()=>setCreating(false)} done={refresh} notify={notify}/></Modal>}
  {selected&&access&&<Modal width="880px" onClose={()=>setSelected(null)}><Detail item={selected} user={viewer} onClose={()=>setSelected(null)} onLogin={()=>setAuth('signup')} refresh={refresh} notify={notify} onProfile={viewProfile}/></Modal>}
 </>;
}
