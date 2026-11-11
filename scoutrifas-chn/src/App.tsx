import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {ArrowLeft,ArrowRight,BarChart3,Check,CheckCircle2,ChevronDown,Clock3,Compass,Flag,Heart,LogIn,LogOut,Menu,Plus,Search,ShieldCheck,Upload,Users,X} from 'lucide-react';
import {backend,cloud,friendlyError,imageUrl,supabase} from './backend';
import type {AccessRequest,Cause,CauseAcknowledgment,MemberType,Profile,SupportIntent} from './types';
import {ackLabel,canPublish,canViewCatalogue,formatId,isScoutId,money} from './types';
import {AckPanel,CauseAdmin,CauseDetail,CauseEditor,CauseGallery} from './Causes';
import './style.css';

type Screen='explore'|'setup'|'mine'|'activity'|'profile'|'admin';
type AuthMode='login'|'signup';
const sampleHero='https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1600&q=80';
function Fleur({size=30}:{size?:number}){return <span className="fleur" style={{fontSize:size}} aria-hidden="true">⚜</span>}
function Avatar({user,size=38}:{user?:Profile|null;size?:number}){
 const src=imageUrl(user?.avatar_path),letters=(user?.display_name||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
 return <span className="avatar" style={{width:size,height:size,fontSize:size*.32}}>{src?<img src={src} alt="Foto de perfil"/>:letters}</span>;
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
  <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">APOYA</span> <sup>CHN</sup></span></div>
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
    <label className="chn-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> Confirmo que tengo 18 años o más{kind==='scout'?'':''}.</label>
   </>}
   <label>Correo electrónico<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label>
   <label>Contraseña<input required minLength={8} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button className="primary full" type="submit" disabled={busy}>{busy?'Procesando…':mode==='signup'?'Crear mi cuenta':'Entrar a ScoutApoya'}<ArrowRight size={17}/></button>
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
  <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">APOYA</span> <sup>CHN</sup></span></div>
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
    <label className="chn-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> Confirmo ser mayor de edad{kind==='scout'?'':''}.</label>
    <label className="chn-honeypot" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={e=>setHoneypot(e.target.value)}/></label>
    <button type="submit" className="primary full" disabled={busy}>{busy?'Enviando…':'Enviar solicitud de acceso'} <ArrowRight size={17}/></button>
   </form>
   <p className="auth-foot">El acceso se concede únicamente tras aprobación. Este sitio no procesa cobros.</p>
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
   <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">APOYA</span> <sup>CHN</sup></span></div>
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
  try{await backend.enrollExisting();await done();notify('Tu acceso quedó activado. ¡Bienvenido a ScoutApoya!')}
  catch(err){const msg=friendlyError(err);setError(msg);notify(msg,true)}
  finally{setBusy(false)}
 };
 return <div className="auth-content">
  <span className="kicker">ACCESO A TU COMUNIDAD</span><h2>Activa tu acceso aprobado</h2>
  <p className="subtle">Ya tienes una sesión en Supabase. Para ingresar a ScoutApoya, primero necesitas una solicitud aprobada con el mismo correo que utilizaste al iniciar sesión.</p>
  {error&&<div className="chn-form-error" role="alert"><Flag size={18}/>{error}</div>}
  <button type="button" className="primary full" disabled={busy} onClick={()=>{void activate()}}>{busy?'Comprobando…':'Activar acceso aprobado'} <CheckCircle2 size={17}/></button>
  <button type="button" className="secondary full" onClick={onApply}>No he enviado solicitud · Solicitar acceso</button>
  <div className="chn-setup-options"><button className="text-logout" type="button" onClick={onSkip}>Volver al inicio</button><button className="text-logout" type="button" onClick={()=>{void cancel()}}>Cerrar sesión</button></div>
 </div>;
}

function ProfilePage({person,current,onSave,notify,causes,onOpen}:{person:Profile;current:boolean;onSave:()=>Promise<void>;notify:(s:string,e?:boolean)=>void;causes:Cause[];onOpen:(c:Cause)=>void}){
 const [name,setName]=useState(person.display_name),[group,setGroup]=useState(person.group_name),[bio,setBio]=useState(person.bio),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{setName(person.display_name);setGroup(person.group_name);setBio(person.bio);setFile(null)},[person.id,person.display_name,person.group_name,person.bio]);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);
  try{const path=file?await backend.upload(file,person.id,'avatars'):person.avatar_path;
   await backend.updateProfile(person.id,{display_name:name.trim(),group_name:group.trim(),bio:bio.trim(),avatar_path:path});
   await onSave();notify('Perfil actualizado.');setFile(null);
  }catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}
 };
 return <section className="profile-view">
  <div className="profile-banner"><Fleur size={76}/><div className="topography"/></div>
  <div className="profile-head"><Avatar user={person} size={102}/><div><div className="inline-heading"><h2>{person.display_name}</h2>{person.verified?<span className="verified"><CheckCircle2 size={15}/> Verificado</span>:<span className="pending"><Clock3 size={15}/> Por verificar</span>}</div>
   <p>{person.member_type==='supporter'?'Simpatizante':person.scout_id||'Scout'} · {person.group_name||'Grupo 4 de Chihuahua Norte'}</p></div></div>
  {current?<form className="form-col profile-edit" onSubmit={submit}><h3>Editar mi perfil</h3>
   <label>Foto de perfil<div className="file-button"><Upload size={18}/>{file?.name||'Elegir imagen'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></div></label>
   <label>Nombre<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)}/></label>
   {person.member_type==='scout'&&<label>Grupo scout<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)}/></label>}
   <label>Sobre mí<textarea maxLength={320} rows={3} value={bio} onChange={e=>setBio(e.target.value)}/></label>
   <button className="primary" disabled={busy} type="submit">{busy?'Guardando…':'Guardar cambios'}<Check size={16}/></button>
  </form>:<div className="public-bio"><h3>Sobre esta persona</h3><p>{person.bio||'Miembro de nuestra comunidad.'}</p></div>}
  <div className="public-listings"><h3>Causas de {person.display_name.split(' ')[0]}</h3><CauseGallery causes={causes} includeDrafts={current} onOpen={onOpen}/></div>
 </section>;
}

function Admin({causes,refresh,notify}:{causes:Cause[];refresh:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
 const [members,setMembers]=useState<Profile[]>([]),[requests,setRequests]=useState<AccessRequest[]>([]),[intents,setIntents]=useState<SupportIntent[]>([]);
 const [tab,setTab]=useState<'review'|'access'|'causes'|'intents'|'users'>('review'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false);
 const reload=useCallback(async()=>{try{const [m,r,p]=await Promise.all([backend.members(),backend.accessRequests(),backend.supportIntents()]);
  setMembers(m);setRequests(r);setIntents(p)}catch(err){notify(friendlyError(err),true)}},[notify]);
 useEffect(()=>{void reload();const id=window.setInterval(()=>{void reload();void refresh().catch(()=>{})},20000);return()=>window.clearInterval(id)},[reload,refresh]);
 const names=new Map(members.map(m=>[m.id,m.display_name]));
 const titles=new Map(causes.map(c=>[c.id,c.title]));
 const match=(...parts:(string|number|null|undefined)[])=>!query.trim()||parts.join(' ').toLowerCase().includes(query.toLowerCase());
 const act=async(fn:()=>Promise<unknown>,message:string)=>{setBusy(true);try{await fn();await Promise.all([refresh(),reload()]);notify(message)}
  catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}};
 const csv=()=>{
  const csvCell=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+\-@]/,"'$&")+'"';
  const rows=[['Fecha','Folio','Usuario','Causa','Destinatario','Monto previsto MXN','Aprobación','Pago'],...intents.map(p=>[p.created_at,ackLabel(p.acknowledgment_no),names.get(p.user_id)||'',
    p.cause_id?titles.get(p.cause_id)||'Causa archivada':'Apoyo anterior',p.recipient_name||'No especificado',p.amount,p.status,'No cobrado'])];
  const url=URL.createObjectURL(new Blob([String.fromCharCode(65279)+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='causas-grupo4.csv';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="admin-view">
  <div className="section-title"><div><span className="kicker">CONTROL COMUNITARIO</span><h2>Panel de administración</h2><p>Revisa usuarios, causas y apoyos del Grupo 4.</p></div><ShieldCheck size={38} className="admin-shield"/></div>
  <div className="stat-grid chn-stats">
   <div className="stat"><Users/><b>{requests.filter(r=>r.status==='pending').length}</b><span>Solicitudes pendientes</span></div>
   <div className="stat"><Heart/><b>{causes.filter(c=>c.status==='pending').length}</b><span>Causas por revisar</span></div>
   <div className="stat"><CheckCircle2/><b>{members.length}</b><span>Miembros registrados</span></div>
   <div className="stat"><Heart/><b>{intents.filter(p=>p.status==='pending').length}</b><span>Intenciones por aprobar</span></div>
   <div className="stat"><CheckCircle2/><b>{intents.filter(p=>p.status==='approved').length}</b><span>Registros aprobados</span></div>
   <div className="stat"><BarChart3/><b>{money(intents.reduce((n,p)=>n+p.amount,0))}</b><span>Previsto, no cobrado</span></div>
  </div>
  <div className="admin-toolbar"><button className="secondary" onClick={()=>{void reload();void refresh()}}>Actualizar</button></div>
  <div className="tabs admin-tabs">
   <button className={tab==='review'?'active':''} onClick={()=>setTab('review')}>Revisar intenciones ({intents.filter(p=>p.status==='pending').length})</button>
   <button className={tab==='access'?'active':''} onClick={()=>setTab('access')}>Solicitudes</button>
   <button className={tab==='causes'?'active':''} onClick={()=>setTab('causes')}>Causas</button>
   <button className={tab==='intents'?'active':''} onClick={()=>setTab('intents')}>Apoyos</button>
   <button className={tab==='users'?'active':''} onClick={()=>setTab('users')}>Usuarios</button>
  </div>
  <div className="admin-filter"><label className="search-field"><Search size={18}/><input aria-label="Buscar" placeholder="Buscar nombre, correo o causa" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   {tab==='intents'&&<button className="secondary" onClick={csv}>Exportar CSV</button>}</div>
  {tab==='review'&&<div className="admin-list">
    {intents.filter(p=>p.status==='pending'&&match(names.get(p.user_id),p.recipient_name,p.cause_id?titles.get(p.cause_id):'',p.acknowledgment_no)).map(p=><div className="admin-line chn-history" key={p.id}>
     <div className="history-symbol"><Heart size={20}/></div>
     <div className="grow"><b>{ackLabel(p.acknowledgment_no)} · {titles.get(p.cause_id||'')||'Causa'}</b>
      <p>Solicita: {names.get(p.user_id)||'Miembro'} · Destinatario: {p.recipient_name||'No especificado'}</p>
      <small>{money(p.amount)} previsto · {new Date(p.created_at).toLocaleString('es-MX')} · Pendiente de aprobación</small>
      {p.note&&<p>{p.note}</p>}
     </div><div className="admin-actions">
      <button disabled={busy} className="small-approve" type="button" onClick={()=>{void act(()=>backend.reviewCauseIntent(p.id,true),'Intención aprobada. Esto no confirma dinero recibido.')}}>Aprobar intención</button>
      <button disabled={busy} className="danger" type="button" onClick={()=>{if(window.confirm('¿Rechazar esta intención y liberar un espacio en la causa? El folio seguirá en el historial.'))void act(()=>backend.reviewCauseIntent(p.id,false),'Intención rechazada; se liberó un espacio.')}}>Rechazar</button>
     </div></div>)}
     {!intents.some(p=>p.status==='pending')&&<p className="empty-small">No hay intenciones pendientes de revisión.</p>}
   </div>}
   {tab==='causes'&&<CauseAdmin causes={causes.filter(c=>match(c.title,c.owner?.display_name,c.status))} onUpdate={refresh} notify={notify}/>}
  {tab==='access'&&<div className="admin-list">{requests.filter(r=>match(r.display_name,r.email,r.scout_id)).map(r=><div className="admin-line" key={r.id}>
   <div className="history-symbol"><Users size={20}/></div><div className="grow"><b>{r.display_name}</b><p>{r.email} · {r.member_type==='scout'?'Scout':'Simpatizante'} · {r.scout_id||r.referral_note||'Sin referencia'}</p>
   <small>{new Date(r.created_at).toLocaleDateString('es-MX')} · {r.status}</small></div>
   <div className="admin-actions">{r.status==='pending'&&<><button className="small-approve" disabled={busy} onClick={()=>{void act(()=>backend.reviewAccess(r.id,true),'Solicitud aprobada; envía el aviso de registro.')}}>Aprobar</button>
    <button className="danger" disabled={busy} onClick={()=>{void act(()=>backend.reviewAccess(r.id,false),'Solicitud rechazada.')}}>Rechazar</button></>}
    {r.status==='approved'&&<a className="chn-email-link" href={'mailto:'+r.email+'?subject='+encodeURIComponent('ScoutApoya: acceso aprobado')+'&body='+encodeURIComponent('Tu solicitud fue aprobada. Visita '+window.location.origin+' y crea tu cuenta con el correo aprobado.')}>Preparar aviso</a>}</div>
  </div>)}{!requests.length&&<p className="empty-small">No hay solicitudes.</p>}</div>}
  {tab==='intents'&&<div className="admin-list">{intents.filter(p=>match(names.get(p.user_id),p.recipient_name,p.cause_id?titles.get(p.cause_id):'',p.note)).map(p=><div className="admin-line chn-history" key={p.id}>
   <div className="history-symbol"><Heart size={20}/></div><div className="grow"><b>{names.get(p.user_id)||'Miembro'} · {p.cause_id?titles.get(p.cause_id)||'Causa archivada':'Apoyo anterior'}</b>
    <p>Folio {ackLabel(p.acknowledgment_no)} · Destinatario: {p.recipient_name||'No especificado'}</p>
    <small>{p.status==='approved'?'Aprobada':p.status==='rejected'?'Rechazada':p.status==='pending'?'Pendiente':'Registro anterior'} · {new Date(p.created_at).toLocaleString('es-MX')}</small></div>
   <strong className="history-amount">{money(p.amount)}<small style={{display:'block',fontSize:11,fontWeight:400}}>No cobrado</small></strong>
  </div>)}{!intents.length&&<p className="empty-small">Aún no hay intenciones.</p>}</div>}
  {tab==='users'&&<div className="admin-list">{members.filter(m=>match(m.display_name,m.scout_id,m.member_type)).map(m=><div className="admin-line user-line" key={m.id}>
   <Avatar user={m} size={48}/><div className="grow"><b>{m.display_name}</b><p>{m.member_type==='supporter'?'Simpatizante':m.scout_id} · {m.group_name}</p></div>
   <div className="admin-actions">{m.role==='admin'?<span className="verified">Administrador único</span>:<button disabled={busy} className={m.verified?'danger':'small-approve'}
    onClick={()=>{void act(()=>backend.reviewUser(m.id,!m.verified),'Estado de acceso actualizado.')}}>{m.verified?'Revocar acceso':'Aprobar acceso'}</button>}</div>
  </div>)}</div>}
  <p className="detail-disclaimer">Los importes son intenciones de apoyo, no dinero recaudado. Este sitio no procesa pagos ni emite documentos fiscales.</p>
 </section>;
}

export default function App(){
 const setupDismissed=useRef(false);
 const [viewer,setViewer]=useState<Profile|null>(null),[needsEnrollment,setNeedsEnrollment]=useState(false),[causes,setCauses]=useState<Cause[]>([]),[loading,setLoading]=useState(true);
 const [screen,setScreen]=useState<Screen>('explore'),[profileTarget,setProfileTarget]=useState<Profile|null>(null),[selectedCause,setSelectedCause]=useState<Cause|null>(null);
 const [creatingCause,setCreatingCause]=useState(false),[ack,setAck]=useState<CauseAcknowledgment|null>(null);
 const [application,setApplication]=useState(false),[auth,setAuth]=useState<AuthMode|null>(null),[passwordRecovery,setPasswordRecovery]=useState(false);
 const [menu,setMenu]=useState(false),[query,setQuery]=useState(''),[mySupport,setMySupport]=useState<SupportIntent[]>([]);
 const [toast,setToast]=useState<{text:string;error:boolean}|null>(null);
 const notify=useCallback((text:string,error=false)=>setToast({text,error}),[]);
 useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),5500);return()=>window.clearTimeout(id)},[toast]);
 const refresh=useCallback(async()=>{const list=await backend.listCauses();setCauses(list);setSelectedCause(current=>current?list.find(c=>c.id===current.id)||null:null)},[]);
 const refreshUser=useCallback(async()=>{
  const person=await backend.session(),incomplete=!person&&cloud?await backend.isSignedIn():false;
  setViewer(person);setNeedsEnrollment(incomplete);
  if(incomplete){setCauses([]);setSelectedCause(null);setMySupport([]);if(!setupDismissed.current)setScreen(current=>current==='setup'?current:'setup');}
  else if(canViewCatalogue(person)){setCauses(await backend.listCauses());
   if(person?.role==='admin')setScreen(current=>current==='explore'||current==='setup'?'admin':current);
   else setScreen(current=>current==='setup'?'explore':current);
  }else{setCauses([]);setSelectedCause(null);setMySupport([]);setScreen(current=>current==='setup'?'explore':current)}
 },[]);
 useEffect(()=>{let active=true;void refreshUser().catch(err=>notify(friendlyError(err),true)).finally(()=>{if(active)setLoading(false)});
  const subscription=supabase?.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){setAuth(null);setPasswordRecovery(true)}
   window.setTimeout(()=>{if(active)void refreshUser().catch(()=>{})},0)});
  return()=>{active=false;subscription?.data.subscription.unsubscribe()}
 },[refreshUser,notify]);
 useEffect(()=>{if(!canViewCatalogue(viewer))return;const id=window.setInterval(()=>void refresh().catch(()=>{}),30000);return()=>window.clearInterval(id)},[viewer?.id,viewer?.verified,refresh]);
 useEffect(()=>{if(screen!=='activity'||!viewer)return;let active=true;
  void backend.supportIntents(viewer.id).then(values=>{if(active)setMySupport(values)}).catch(err=>notify(friendlyError(err),true));
  return()=>{active=false};
 },[screen,viewer?.id,causes,notify]);
 const access=canViewCatalogue(viewer);
 const results=useMemo(()=>causes.filter(c=>(c.status==='active'||c.status==='finished')
  &&(!query.trim()||(c.title+' '+c.description+' '+c.category).toLowerCase().includes(query.toLowerCase()))),[causes,query]);
 const openApplication=()=>{setAuth(null);setApplication(true)};
 const openApprovedRegistration=()=>{setApplication(false);setAuth('signup')};
 const show=(next:Screen)=>{if(next==='setup'&&needsEnrollment){setupDismissed.current=false;setScreen('setup');return}
  if(next!=='explore'&&!access){if(!viewer)setAuth('login');else notify('Tu cuenta todavía está pendiente de aprobación.',true);return}
  if(next==='admin'&&viewer?.role!=='admin'){notify('Área privada.',true);return}
  setScreen(next);setProfileTarget(null);setMenu(false);window.scrollTo({top:0,behavior:'smooth'});
 };
 const explore=()=>{if(!access){if(needsEnrollment)show('setup');else openApplication();return}
  show('explore');window.setTimeout(()=>document.getElementById('causas')?.scrollIntoView({behavior:'smooth'}),50);
 };
 const create=()=>{if(!viewer){openApplication();return}if(!canPublish(viewer)){notify('Solo organizadores aprobados pueden proponer causas.',true);return}setCreatingCause(true)};
 const profile=(p:Profile)=>{setProfileTarget(p);setScreen('profile');window.scrollTo({top:0,behavior:'smooth'})};
 const logout=async()=>{try{await backend.logout();setupDismissed.current=false;setViewer(null);setNeedsEnrollment(false);setCauses([]);setMySupport([]);setSelectedCause(null);setScreen('explore');notify('Sesión cerrada.')}catch(err){notify(friendlyError(err),true)}};
 const mine=causes.filter(c=>c.owner_id===viewer?.id);
 return <>
  <header className="site-header"><div className="nav-container">
   <button className="logo" type="button" onClick={()=>show('explore')} aria-label="ScoutApoya inicio"><span className="logo-mark"><Fleur size={29}/></span><span className="logo-name">SCOUT<span>APOYA</span><small>GRUPO 4 · CHN</small></span></button>
   <nav className={menu?'nav-links open':'nav-links'}>
    <button className={screen==='explore'?'nav-active':''} onClick={()=>show('explore')}>Inicio</button>
    <button onClick={explore}>Causas</button>
    {access&&canPublish(viewer)&&<button className={screen==='mine'?'nav-active':''} onClick={()=>show('mine')}>Mis causas</button>}
    {access&&<button className={screen==='activity'?'nav-active':''} onClick={()=>show('activity')}>Mis apoyos</button>}
    {access&&viewer?.role==='admin'&&<button className={screen==='admin'?'nav-active':''} onClick={()=>show('admin')}>Administración</button>}
   </nav>
   <div className="nav-right">{canPublish(viewer)&&<button className="create-nav" onClick={create}><Plus size={18}/> Crear causa</button>}
    {viewer?<button className="account" onClick={()=>profile(viewer)}><Avatar user={viewer} size={34}/><span>{viewer.display_name.split(' ')[0]}</span><ChevronDown size={15}/></button>:
     needsEnrollment?<button className="sign-in" onClick={()=>show('setup')}>Activar cuenta</button>:
     cloud?<button className="sign-in" onClick={()=>setAuth('login')}><LogIn size={17}/> Iniciar sesión</button>:null}
    <button className="menu-button" onClick={()=>setMenu(!menu)} aria-label="Abrir menú"><Menu size={24}/></button>
   </div>
  </div></header>
  <main>{screen==='explore'?<>
   <div className="hero-shell"><section className="hero"><div className="hero-photo" style={{backgroundImage:"linear-gradient(90deg,rgba(33,23,44,.93),rgba(33,23,44,.42)),url('"+sampleHero+"')"}}/>
    <div className="hero-content"><span className="hero-label">⚜ GRUPO 4 · CHIHUAHUA NORTE</span>
     <h1>Una buena acción<br/>puede cambiar <em>vidas.</em></h1>
     <p>Conoce y apoya las causas de nuestra comunidad scout. Transporte, formación, materiales y aventuras: cada proyecto comienza con una buena acción.</p>
     <div className="hero-actions"><button className="hero-primary" onClick={explore}><Heart size={18}/> Ver causas</button>
      <button className="hero-secondary" onClick={()=>access?show('activity'):openApplication()}>Mi comunidad <ArrowRight size={18}/></button></div>
    </div><div className="hero-stamp"><Fleur size={27}/><span>SIEMPRE<br/>LISTOS</span></div>
   </section></div>
   <section className="intro-strip">
    <div><div className="strip-icon"><Heart size={24}/></div><div><b>Apoyo comunitario</b><span>Proyectos para Grupo 4</span></div></div>
    <div><div className="strip-icon"><ShieldCheck size={24}/></div><div><b>Acceso aprobado</b><span>Comunidad por invitación</span></div></div>
    <div><div className="strip-icon"><Compass size={24}/></div><div><b>Folios individuales</b><span>Constancia de cada intención</span></div></div>
   </section>
   <section className="chn-support-section"><div className="chn-support-deco"><Heart size={48}/></div>
    <div><span className="kicker">TU APOYO DEJA HUELLA</span><h2>Impulsa causas del Grupo 4</h2>
     <p>Explora iniciativas con metas concretas, imágenes y un monto de referencia establecido por su organizador.</p>
     <p className="chn-independence">Esta plataforma registra intenciones de apoyo. No cobra dinero ni emite comprobantes fiscales.</p>
    </div><button className="primary" onClick={explore}>Explorar causas <Heart size={18}/></button>
   </section>
   {access?<section className="explore-section" id="causas">
    <div className="section-title"><div><span className="kicker">APOYA AL GRUPO 4 DE CHIHUAHUA NORTE</span><h2>Causas de la comunidad <span>♥</span></h2>
     <p>Elige una causa y solicita una intención de apoyo. Cada una tiene un folio único, cupo limitado y aprobación administrativa.</p></div>
     <div className="headline-stat"><b>{results.length}</b><span>causas visibles</span></div></div>
    <div className="filter-wrap"><div className="filter-controls"><label className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar causas" aria-label="Buscar causas"/></label></div></div>
    {loading?<div className="empty"><Compass size={40}/> Cargando…</div>:<CauseGallery causes={results} onOpen={setSelectedCause}/>}
    {canPublish(viewer)&&<div className="chn-create-bottom"><button className="primary" onClick={create}><Plus size={18}/> Crear nueva causa</button></div>}
   </section>:<section className="explore-section private-welcome"><div className="private-welcome-inner"><Compass size={35}/>
     <h2>Comunidad privada del Grupo 4</h2><p>{needsEnrollment?'Tu cuenta necesita activar el acceso aprobado.':viewer?'Tu solicitud está en revisión.':'Solicita acceso para conocer nuestros proyectos y causas.'}</p>
     <button className="primary" onClick={()=>needsEnrollment?show('setup'):viewer?setAuth('login'):openApplication()}>{needsEnrollment?'Activar acceso':'Solicitar acceso'} <ArrowRight size={17}/></button>
    </div></section>}
   {access&&canPublish(viewer)&&<section className="cta-panel"><div className="cta-ornament"><Fleur size={85}/></div>
    <div><span className="kicker light">UNA BUENA ACCIÓN</span><h2>¿Tu grupo tiene un proyecto que impulsar?</h2>
     <p>Define la causa, agrega hasta diez fotografías y envíala para aprobación administrativa.</p></div>
    <button onClick={create} className="cta-button">Proponer causa <ArrowRight size={18}/></button></section>}
  </>:screen==='setup'?<section className="inner-page chn-setup-page"><div className="chn-setup-card"><div className="chn-setup-badge"><Fleur size={27}/></div>
   <ExistingMemberJoin done={refreshUser} cancel={logout} onSkip={()=>{setupDismissed.current=true;setScreen('explore')}} onApply={openApplication} notify={notify}/></div></section>:
  screen==='mine'?<section className="inner-page"><div className="section-title"><div><span className="kicker">MIS PROYECTOS</span><h2>Mis causas</h2><p>Consulta tus causas, incluidas las que están pendientes de aprobación.</p></div>
    <button className="primary" onClick={create}><Plus size={17}/> Nueva causa</button></div><CauseGallery causes={mine} includeDrafts onOpen={setSelectedCause}/></section>:
  screen==='activity'?<section className="inner-page"><div className="section-title"><div><span className="kicker">TU COMUNIDAD</span><h2>Historial de apoyos</h2><p>Consulta los folios únicos y su estado de aprobación. Ninguno acredita pagos.</p></div><Heart size={40} className="page-icon"/></div>
   <div className="activity-block"><h3><Heart size={20}/> Mis intenciones <span>{mySupport.length}</span></h3>
    {mySupport.length?mySupport.map(p=><div className="activity-row" key={p.id}>
     <b>{causes.find(c=>c.id===p.cause_id)?.title||'Apoyo al Grupo 4'} · {money(p.amount)}</b>
     <small>Folio {ackLabel(p.acknowledgment_no)} · {p.status==='approved'?'Aprobada':p.status==='rejected'?'Rechazada':p.status==='pending'?'Pendiente de aprobación':'Registro anterior'} · Sin pago</small>
     <small>Destinatario: {p.recipient_name||'No especificado'} · {new Date(p.created_at).toLocaleDateString('es-MX')}</small>
     <button className="chn-cause-history-action" onClick={()=>setAck({intent_id:p.id,ack_no:p.acknowledgment_no,amount_mxn:p.amount,cause_title:causes.find(c=>c.id===p.cause_id)?.title||'Apoyo al Grupo 4',issued_at:p.created_at,intent_status:p.status,recipient_name:p.recipient_name})}>Ver acuse numerado</button>
    </div>):<p className="empty-small">No has registrado ninguna intención de apoyo.</p>}
    <button className="secondary" onClick={explore}>Explorar causas</button>
   </div></section>:
  screen==='profile'&&(profileTarget||viewer)?<div className="inner-page profile-container"><button className="back-link" onClick={()=>show('explore')}><ArrowLeft size={17}/> Volver</button>
   <ProfilePage person={(profileTarget||viewer)!} current={viewer?.id===(profileTarget||viewer)?.id} onSave={refreshUser} notify={notify}
    causes={causes.filter(c=>c.owner_id===(profileTarget||viewer)?.id&&(c.status==='active'||c.status==='finished'||viewer?.id===c.owner_id))} onOpen={setSelectedCause}/>
   {viewer?.id===(profileTarget||viewer)?.id&&<button className="text-logout" onClick={()=>{void logout()}}><LogOut size={16}/> Cerrar sesión</button>}</div>:
  screen==='admin'&&viewer?.role==='admin'?<div className="inner-page"><Admin causes={causes} refresh={refresh} notify={notify}/></div>:null
  }</main>
  <footer className="footer"><div className="footer-top"><div className="footer-brand"><div className="logo-mark"><Fleur size={27}/></div><div><b>SCOUTAPOYA <span>CHN</span></b><p>Causas comunitarias del Grupo 4 de Chihuahua Norte.</p></div></div>
   <div className="footer-links"><button onClick={()=>show('explore')}>Inicio</button><button onClick={explore}>Causas</button>{access&&<button onClick={()=>show('activity')}>Mis apoyos</button>}</div></div>
   <div className="footer-bottom"><span>© {new Date().getFullYear()} ScoutApoya · Grupo 4 CHN</span><span>Sin pagos integrados · Acuses de intención · Comunidad privada</span></div>
  </footer>
  {toast&&<div className={'toast'+(toast.error?' error':'')} role="status">{toast.error?<Flag size={18}/>:<CheckCircle2 size={18}/>} {toast.text}<button onClick={()=>setToast(null)} aria-label="Cerrar"><X size={16}/></button></div>}
  {application&&<Modal onClose={()=>setApplication(false)}><AccessApplication onClose={()=>setApplication(false)} notify={notify} onRegister={openApprovedRegistration}/></Modal>}
  {passwordRecovery&&<Modal onClose={()=>setPasswordRecovery(false)}><PasswordRecovery onClose={()=>setPasswordRecovery(false)} notify={notify}/></Modal>}
  {auth&&<Modal onClose={()=>setAuth(null)}><Authentication mode={auth} setMode={setAuth} onClose={()=>setAuth(null)} onSuccess={async()=>{setupDismissed.current=false;await refreshUser()}} notify={notify} onApply={openApplication}/></Modal>}
  {ack&&<Modal width="620px" onClose={()=>setAck(null)}><AckPanel data={ack} onClose={()=>setAck(null)}/></Modal>}
  {selectedCause&&access&&<Modal width="920px" onClose={()=>setSelectedCause(null)}><CauseDetail cause={selectedCause} onClose={()=>setSelectedCause(null)} onUpdated={refresh} notify={notify} onAcknowledged={result=>{setAck(result);if(viewer)void backend.supportIntents(viewer.id).then(setMySupport).catch(()=>{})}}/></Modal>}
  {creatingCause&&viewer&&<Modal width="850px" onClose={()=>setCreatingCause(false)}><CauseEditor user={viewer} onClose={()=>setCreatingCause(false)} onSaved={refresh} notify={notify}/></Modal>}
 </>;
}
