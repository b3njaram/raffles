import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {ArrowLeft,ArrowRight,BarChart3,Check,CheckCircle2,ChevronDown,Clock3,Compass,Flag,Heart,LogIn,LogOut,Menu,Plus,Search,ShieldCheck,Upload,Users,X} from 'lucide-react';
import {backend,cloud,friendlyError,imageUrl,supabase} from './backend';
import type {AccessRequest,Category,Cause,CauseFilter,CauseSort,MemberType,Profile,SupportIntent} from './types';
import {ackLabel,canPublish,canViewCatalogue,categories,categoryLabel,causeShareUrl,filterCauses,formatId,isScoutId,validCauseId} from './types';
import {AckPanel,CauseAdmin,CauseDetail,CauseEditor,CauseGallery} from './Causes';
import type {AckDisplay} from './Causes';
import {PreferenceSwitches,usePreferences} from './Preferences';
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
 const {t}=usePreferences();
 useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[onClose]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation">
  <div className="modal" style={{maxWidth:width}} role="dialog" aria-modal="true">
   <button type="button" className="modal-close icon-button" aria-label={t('Cerrar','Close')} onClick={onClose}><X size={20}/></button>{children}
  </div></div>;
}
function KindPicker({kind,setKind}:{kind:MemberType;setKind:(k:MemberType)=>void}){
 const {t}=usePreferences();
 return <div className="mode-cards chn-kind-picker">
  <button type="button" className={kind==='scout'?'active':''} onClick={()=>setKind('scout')}><Fleur size={24}/><b>{t("Soy Scout","I'm a Scout")}</b><small>{t("Miembro de la provincia","Regional Scout member")}</small></button>
  <button type="button" className={kind==='supporter'?'active':''} onClick={()=>setKind('supporter')}><Heart size={23}/><b>{t("Quiero apoyar","I want to help")}</b><small>{t("Amigos y simpatizantes","Friends and supporters")}</small></button>
 </div>;
}
function Authentication({mode,setMode,onClose,onSuccess,notify,onApply}:{mode:AuthMode;setMode:(m:AuthMode)=>void;onClose:()=>void;onSuccess:()=>Promise<void>;notify:(s:string,e?:boolean)=>void;onApply:()=>void}){
 const {t}=usePreferences();
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
 const [id,setId]=useState('CHN-'),[group,setGroup]=useState(''),[referral,setReferral]=useState('');
 const [kind,setKind]=useState<MemberType>('supporter'),[adult,setAdult]=useState(false),[busy,setBusy]=useState(false);
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;
  if(mode==='signup'&&kind==='scout'&&!isScoutId(id)){notify(t("El ID scout no tiene el formato correcto.","The Scout ID format is invalid."),true);return;}
  if(mode==='signup'&&kind==='supporter'&&!adult){notify(t("Este registro es para mayores de edad.","This registration is for adults."),true);return;}
  setBusy(true);
  try{
   if(mode==='signup'){
    const session=await backend.signup(email.trim(),password,name.trim(),kind,formatId(id),group.trim(),adult,referral.trim());
    if(session){await onSuccess();notify(t("Registro recibido. La comunidad revisará tu solicitud.","Account registration received. The community will review your request."));onClose();}
    else{notify(t("Revisa tu correo de confirmación, después inicia sesión.","Check your confirmation email, then sign in."));setMode('login');}
   }else{await backend.login(email.trim(),password);await onSuccess();notify(t("Sesión iniciada correctamente.","Signed in successfully."));onClose();}
  }catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}
 };
 return <div className="auth-content">
  <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">APOYA</span> <sup>CHN</sup></span></div>
  <h2>{mode==='signup'?t('Crear cuenta aprobada','Create approved account'):t('Bienvenido de vuelta','Welcome back')}</h2>
  <p className="subtle">{mode==='signup'?t('Utiliza el mismo correo y tipo de miembro que autorizó administración.','Use the email and membership type approved by the administrator.'):t('Inicia sesión para ver las actividades.','Sign in to view community activities.')}</p>
  <div className="switcher"><button type="button" className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>{t("Iniciar sesión","Sign in")}</button><button type="button" className={mode==='signup'?'selected':''} onClick={()=>setMode('signup')}>{t("Crear cuenta","Create account")}</button></div>
  <form className="form-col" onSubmit={submit}>
   {mode==='signup'&&<><KindPicker kind={kind} setKind={setKind}/>
    <label>{t("Nombre a mostrar","Display name")}<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
    {kind==='scout'?<>
      <label>{t("ID scout","Scout ID")}<input required maxLength={16} value={id} onChange={e=>setId(e.target.value.toUpperCase())} pattern="CHN-?[A-Za-z0-9]{4,12}" placeholder="CHN-000123"/></label>
      <label>{t("Grupo scout","Scout group")}<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)} placeholder={t('Grupo y sección','Group and section')}/></label>
     </>:<label>{t("¿Quién te invitó? (opcional)","Who invited you? (optional)")}<input maxLength={120} value={referral} onChange={e=>setReferral(e.target.value)} placeholder={t('Nombre o grupo que conoces','Name or group you know')}/></label>}
    <label className="chn-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> Confirmo que tengo 18 años o más{kind==='scout'?'':''}.</label>
   </>}
   <label>{t("Correo electrónico","Email")}<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label>
   <label>{t("Contraseña","Password")}<input required minLength={8} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button className="primary full" type="submit" disabled={busy}>{busy?t('Procesando…','Processing…'):mode==='signup'?t('Crear mi cuenta','Create my account'):t('Entrar a ScoutApoya','Enter ScoutApoya')}<ArrowRight size={17}/></button>
  </form>
  {mode==='login'&&<button className="chn-forgot-button" type="button" disabled={busy} onClick={async()=>{
    try{setBusy(true);await backend.sendPasswordReset(email);notify('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.');onClose();}
    catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}
   }}>{t("¿Olvidaste tu contraseña?","Forgot your password?")}</button>}
  <p className="auth-foot">{t("La cuenta solo se crea después de la aprobación previa. No se procesan pagos en este sitio.","Accounts are created only after prior approval. No payments are processed here.")}</p>
  <button className="chn-forgot-button" type="button" onClick={onApply}>{t("Solicitar acceso por primera vez","Request access for the first time")}</button>
 </div>;
}
function AccessApplication({onClose,notify,onRegister}:{onClose:()=>void;notify:(s:string,error?:boolean)=>void;onRegister:()=>void}){
 const {t}=usePreferences();
 const [kind,setKind]=useState<MemberType>('supporter'),[name,setName]=useState(''),[email,setEmail]=useState('');
 const [scoutId,setScoutId]=useState('CHN-'),[group,setGroup]=useState(''),[referral,setReferral]=useState('');
 const [adult,setAdult]=useState(false),[honeypot,setHoneypot]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   await backend.requestAccess({name,email,kind,scoutId:formatId(scoutId),group,referral,adult,website:honeypot});
   setSent(true);notify(t("Solicitud recibida. Puedes crear tu cuenta una vez que administración te haya aprobado.","Request received. You can create your account once approved by an administrator."));
  }catch(err){const message=friendlyError(err);setError(message);notify(message,true)}
  finally{setBusy(false)}
 };
 return <div className="auth-content">
  <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">APOYA</span> <sup>CHN</sup></span></div>
  {sent?<div className="chn-request-done"><CheckCircle2 size={40}/><h2>{t("¡Solicitud recibida!","Request received!")}</h2>
    <p>{t("La administración revisará tus datos. Cuando recibas la aprobación, podrás crear tu cuenta con este mismo correo o activar una cuenta existente.","An administrator will review your information. Once approved, create your account using the same email or activate an existing account.")}</p>
    <button type="button" className="primary full" onClick={onClose}>Entendido <Check size={17}/></button>
    <button type="button" className="chn-forgot-button" onClick={onRegister}>{t("Ya me aprobaron · Crear cuenta","Already approved · Create account")}</button>
   </div>:<>
   <h2>{t("Solicitar acceso","Request access")}</h2>
   <p className="subtle">{t("Cuéntanos un poco sobre ti. Enviaremos tu solicitud a revisión antes de habilitar el registro.","Tell us a little about yourself. We'll review your application before you can register.")}</p>
   {error&&<div className="chn-form-error" role="alert"><Flag size={18}/>{error}</div>}
   <form className="form-col" onSubmit={submit}>
    <KindPicker kind={kind} setKind={setKind}/>
    <label>{t("Tu nombre","Your name")}<input required minLength={2} maxLength={65} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>{t("Correo para el registro","Registration email")}<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    {kind==='scout'?<><label>{t("ID scout","Scout ID")}<input required maxLength={16} pattern="CHN-?[A-Za-z0-9]{4,12}" value={scoutId} onChange={e=>setScoutId(e.target.value.toUpperCase())}/></label>
     <label>{t("Grupo y sección","Group and section")}<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)}/></label></>:
     <label>{t("¿Quién te invitó? (opcional)","Who invited you? (optional)")}<input maxLength={120} value={referral} onChange={e=>setReferral(e.target.value)}/></label>}
    <label className="chn-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> Confirmo ser mayor de edad{kind==='scout'?'':''}.</label>
    <label className="chn-honeypot" aria-hidden="true">{t("Sitio web","Website")}<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={e=>setHoneypot(e.target.value)}/></label>
    <button type="submit" className="primary full" disabled={busy}>{busy?t('Enviando…','Sending…'):t('Enviar solicitud de acceso','Submit access request')} <ArrowRight size={17}/></button>
   </form>
   <p className="auth-foot">{t("El acceso se concede únicamente tras aprobación. Este sitio no procesa cobros.","Access requires prior approval. This site does not process payments.")}</p>
   <button type="button" className="chn-forgot-button" onClick={onRegister}>{t("¿Ya te aprobaron? Crear cuenta","Already approved? Create account")}</button>
  </>}
 </div>;
}
function PasswordRecovery({onClose,notify}:{onClose:()=>void;notify:(message:string,isError?:boolean)=>void}){
 const {t}=usePreferences();
 const [password,setPassword]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;
  if(password!==again){setError('Las contraseñas no coinciden.');return;}
  setBusy(true);setError('');
  try{await backend.changePassword(password);notify(t("Contraseña actualizada. Ya puedes usar tu cuenta.","Password updated. You may now use your account."));onClose()}
  catch(err){const message=friendlyError(err);setError(message);notify(message,true)}
  finally{setBusy(false)}
 };
 return <div className="auth-content">
   <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">APOYA</span> <sup>CHN</sup></span></div>
   <h2>{t("Crear nueva contraseña","Set a new password")}</h2><p className="subtle">{t("Tu enlace de recuperación fue validado. Elige una contraseña segura para tu cuenta.","Your recovery link was verified. Choose a secure password.")}</p>
   {error&&<div className="chn-form-error" role="alert"><Flag size={18}/>{error}</div>}
   <form className="form-col" onSubmit={submit}>
    <label>{t("Nueva contraseña","New password")}<input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>{t("Confirmar contraseña","Confirm password")}<input type="password" required minLength={10} autoComplete="new-password" value={again} onChange={e=>setAgain(e.target.value)}/></label>
    <button disabled={busy} className="primary full" type="submit">{busy?t('Actualizando…','Updating…'):t('Guardar nueva contraseña','Save new password')}<Check size={17}/></button>
   </form>
 </div>;
}
function ExistingMemberJoin({done,cancel,onSkip,onApply,notify}:{done:()=>Promise<void>;cancel:()=>Promise<void>;onSkip:()=>void;onApply:()=>void;notify:(s:string,e?:boolean)=>void}){
 const {t}=usePreferences();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const activate=async()=>{if(busy)return;setBusy(true);setError('');
  try{await backend.enrollExisting();await done();notify(t("Tu acceso quedó activado. ¡Bienvenido a ScoutApoya!","Your access is active. Welcome to ScoutApoya!"))}
  catch(err){const msg=friendlyError(err);setError(msg);notify(msg,true)}
  finally{setBusy(false)}
 };
 return <div className="auth-content">
  <span className="kicker">{t("ACCESO A TU COMUNIDAD","COMMUNITY ACCESS")}</span><h2>{t("Activa tu acceso aprobado","Activate your approved access")}</h2>
  <p className="subtle">{t("Ya tienes una sesión en Supabase. Para ingresar a ScoutApoya, primero necesitas una solicitud aprobada con el mismo correo que utilizaste al iniciar sesión.","You are already signed in to Supabase. To enter ScoutApoya, you first need an approved request using the same email.")}</p>
  {error&&<div className="chn-form-error" role="alert"><Flag size={18}/>{error}</div>}
  <button type="button" className="primary full" disabled={busy} onClick={()=>{void activate()}}>{busy?t('Comprobando…','Checking…'):t('Activar acceso aprobado','Activate approved access')} <CheckCircle2 size={17}/></button>
  <button type="button" className="secondary full" onClick={onApply}>{t("No he enviado solicitud · Solicitar acceso","I haven't applied · Request access")}</button>
  <div className="chn-setup-options"><button className="text-logout" type="button" onClick={onSkip}>{t("Volver al inicio","Back to home")}</button><button className="text-logout" type="button" onClick={()=>{void cancel()}}>{t("Cerrar sesión","Sign out")}</button></div>
 </div>;
}

function ProfilePage({person,current,onSave,notify,causes,onOpen}:{person:Profile;current:boolean;onSave:()=>Promise<void>;notify:(s:string,e?:boolean)=>void;causes:Cause[];onOpen:(c:Cause)=>void}){
 const {t}=usePreferences();
 const [name,setName]=useState(person.display_name),[group,setGroup]=useState(person.group_name),[bio,setBio]=useState(person.bio),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{setName(person.display_name);setGroup(person.group_name);setBio(person.bio);setFile(null)},[person.id,person.display_name,person.group_name,person.bio]);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);
  try{const path=file?await backend.upload(file,person.id,'avatars'):person.avatar_path;
   await backend.updateProfile(person.id,{display_name:name.trim(),group_name:group.trim(),bio:bio.trim(),avatar_path:path});
   await onSave();notify(t("Perfil actualizado.","Profile updated."));setFile(null);
  }catch(err){notify(friendlyError(err),true)}finally{setBusy(false)}
 };
 return <section className="profile-view">
  <div className="profile-banner"><Fleur size={76}/><div className="topography"/></div>
  <div className="profile-head"><Avatar user={person} size={102}/><div><div className="inline-heading"><h2>{person.display_name}</h2>{person.verified?<span className="verified"><CheckCircle2 size={15}/> Verificado</span>:<span className="pending"><Clock3 size={15}/> Por verificar</span>}</div>
   <p>{person.member_type==='supporter'?t('Simpatizante','Supporter'):person.scout_id||'Scout'} · {person.group_name||'Grupo 4 de Chihuahua Norte'}</p></div></div>
  {current?<form className="form-col profile-edit" onSubmit={submit}><h3>{t("Editar mi perfil","Edit profile")}</h3>
   <label>{t("Foto de perfil","Profile photo")}<div className="file-button"><Upload size={18}/>{file?.name||'Elegir imagen'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></div></label>
   <label>{t("Nombre","Name")}<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)}/></label>
   {person.member_type==='scout'&&<label>{t("Grupo scout","Scout group")}<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)}/></label>}
   <label>{t("Sobre mí","About me")}<textarea maxLength={320} rows={3} value={bio} onChange={e=>setBio(e.target.value)}/></label>
   <button className="primary" disabled={busy} type="submit">{busy?t('Guardando…','Saving…'):t('Guardar cambios','Save changes')}<Check size={16}/></button>
  </form>:<div className="public-bio"><h3>{t("Sobre esta persona","About this member")}</h3><p>{person.bio||'Miembro de nuestra comunidad.'}</p></div>}
  <div className="public-listings"><h3>Causas de {person.display_name.split(' ')[0]}</h3><CauseGallery causes={causes} includeDrafts={current} onOpen={onOpen}/></div>
 </section>;
}

function Admin({causes,refresh,notify}:{causes:Cause[];refresh:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
 const {t,format}=usePreferences();
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
  const rows=[['Fecha','Folio','Usuario',t('Causa','Cause'),'Destinatario','Moneda','Monto previsto','Aprobación','Pago'],...intents.map(p=>[p.created_at,ackLabel(p.acknowledgment_no),names.get(p.user_id)||'',
    p.cause_id?titles.get(p.cause_id)||t('Causa archivada','Archived cause'):t('Apoyo anterior','Previous support'),p.recipient_name||t(t('No especificado','Not specified'),'Not specified'),p.currency_code||'MXN',p.amount,p.status,'No cobrado'])];
  const url=URL.createObjectURL(new Blob([String.fromCharCode(65279)+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='causas-grupo4.csv';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="admin-view">
  <div className="section-title"><div><span className="kicker">{t("CONTROL COMUNITARIO","COMMUNITY CONTROL")}</span><h2>{t("Panel de administración","Admin dashboard")}</h2><p>{t("Revisa usuarios, causas y apoyos del Grupo 4.","Review members, causes, and support intentions for Group 4.")}</p></div><ShieldCheck size={38} className="admin-shield"/></div>
  <div className="stat-grid chn-stats">
   <div className="stat"><Users/><b>{requests.filter(r=>r.status==='pending').length}</b><span>{t("Solicitudes pendientes","Pending applications")}</span></div>
   <div className="stat"><Heart/><b>{causes.filter(c=>c.status==='pending').length}</b><span>{t("Causas por revisar","Causes to review")}</span></div>
   <div className="stat"><CheckCircle2/><b>{members.length}</b><span>{t("Miembros registrados","Registered members")}</span></div>
   <div className="stat"><Heart/><b>{intents.filter(p=>p.status==='pending').length}</b><span>{t("Intenciones por aprobar","Intentions to approve")}</span></div>
   <div className="stat"><CheckCircle2/><b>{intents.filter(p=>p.status==='approved').length}</b><span>{t("Registros aprobados","Approved records")}</span></div>
   <div className="stat"><BarChart3/><b>{format(intents.filter(p=>p.currency_code==='MXN'&&p.status!=='rejected').reduce((n,p)=>n+p.amount,0),'MXN')}</b>
    <strong>{format(intents.filter(p=>p.currency_code==='USD'&&p.status!=='rejected').reduce((n,p)=>n+p.amount,0),'USD')}</strong><span>{t("Previsto, no cobrado","Planned, not collected")}</span></div>
  </div>
  <div className="admin-toolbar"><button className="secondary" onClick={()=>{void reload();void refresh()}}>{t("Actualizar","Refresh")}</button></div>
  <div className="tabs admin-tabs">
   <button className={tab==='review'?'active':''} onClick={()=>setTab('review')}>{t("Revisar intenciones","Review intentions")} ({intents.filter(p=>p.status==='pending').length})</button>
   <button className={tab==='access'?'active':''} onClick={()=>setTab('access')}>{t("Solicitudes","Applications")}</button>
   <button className={tab==='causes'?'active':''} onClick={()=>setTab('causes')}>{t("Causas","Causes")}</button>
   <button className={tab==='intents'?'active':''} onClick={()=>setTab('intents')}>{t("Apoyos","Support")}</button>
   <button className={tab==='users'?'active':''} onClick={()=>setTab('users')}>{t("Usuarios","Members")}</button>
  </div>
  <div className="admin-filter"><label className="search-field"><Search size={18}/><input aria-label={t("Buscar","Search")} placeholder={t('Buscar nombre, correo o causa','Search name, email, or cause')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
   {tab==='intents'&&<button className="secondary" onClick={csv}>{t("Exportar CSV","Export CSV")}</button>}</div>
  {tab==='review'&&<div className="admin-list">
    {intents.filter(p=>p.status==='pending'&&match(names.get(p.user_id),p.recipient_name,p.cause_id?titles.get(p.cause_id):'',p.acknowledgment_no)).map(p=><div className="admin-line chn-history" key={p.id}>
     <div className="history-symbol"><Heart size={20}/></div>
     <div className="grow"><b>{ackLabel(p.acknowledgment_no)} · {titles.get(p.cause_id||'')||t('Causa','Cause')}</b>
      <p>{t("Solicita:","Requested by:")} {names.get(p.user_id)||t('Miembro','Member')} · {t("Destinatario:","Recipient:")} {p.recipient_name||t(t('No especificado','Not specified'),'Not specified')}</p>
      <small>{format(p.amount,p.currency_code||'MXN')} {t("previsto","planned")} · {new Date(p.created_at).toLocaleString(t("es-MX","en-US"))} · {t("Pendiente de aprobación","Pending approval")}</small>
      {p.note&&<p>{p.note}</p>}
     </div><div className="admin-actions">
      <button disabled={busy} className="small-approve" type="button" onClick={()=>{void act(()=>backend.reviewCauseIntent(p.id,true),'Intención aprobada. Esto no confirma dinero recibido.')}}>{t("Aprobar intención","Approve intention")}</button>
      <button disabled={busy} className="danger" type="button" onClick={()=>{if(window.confirm('¿Rechazar esta intención y liberar un espacio en la causa? El folio seguirá en el historial.'))void act(()=>backend.reviewCauseIntent(p.id,false),'Intención rechazada; se liberó un espacio.')}}>{t("Rechazar","Reject")}</button>
     </div></div>)}
     {!intents.some(p=>p.status==='pending')&&<p className="empty-small">{t("No hay intenciones pendientes de revisión.","No intentions pending review.")}</p>}
   </div>}
   {tab==='causes'&&<CauseAdmin causes={causes.filter(c=>match(c.title,c.owner?.display_name,c.status))} onUpdate={refresh} notify={notify}/>}
  {tab==='access'&&<div className="admin-list">{requests.filter(r=>match(r.display_name,r.email,r.scout_id)).map(r=><div className="admin-line" key={r.id}>
   <div className="history-symbol"><Users size={20}/></div><div className="grow"><b>{r.display_name}</b><p>{r.email} · {r.member_type==='scout'?'Scout':t('Simpatizante','Supporter')} · {r.scout_id||r.referral_note||t('Sin referencia','No referral')}</p>
   <small>{new Date(r.created_at).toLocaleDateString('es-MX')} · {r.status}</small></div>
   <div className="admin-actions">{r.status==='pending'&&<><button className="small-approve" disabled={busy} onClick={()=>{void act(()=>backend.reviewAccess(r.id,true),'Solicitud aprobada; envía el aviso de registro.')}}>{t("Aprobar","Approve")}</button>
    <button className="danger" disabled={busy} onClick={()=>{void act(()=>backend.reviewAccess(r.id,false),'Solicitud rechazada.')}}>{t("Rechazar","Reject")}</button></>}
    {r.status==='approved'&&<a className="chn-email-link" href={'mailto:'+r.email+'?subject='+encodeURIComponent('ScoutApoya: acceso aprobado')+'&body='+encodeURIComponent('Tu solicitud fue aprobada. Visita '+window.location.origin+' y crea tu cuenta con el correo aprobado.')}>{t("Preparar aviso","Prepare email")}</a>}</div>
  </div>)}{!requests.length&&<p className="empty-small">{t("No hay solicitudes.","No applications.")}</p>}</div>}
  {tab==='intents'&&<div className="admin-list">{intents.filter(p=>match(names.get(p.user_id),p.recipient_name,p.cause_id?titles.get(p.cause_id):'',p.note)).map(p=><div className="admin-line chn-history" key={p.id}>
   <div className="history-symbol"><Heart size={20}/></div><div className="grow"><b>{names.get(p.user_id)||t('Miembro','Member')} · {p.cause_id?titles.get(p.cause_id)||t('Causa archivada','Archived cause'):t('Apoyo anterior','Previous support')}</b>
    <p>{t("Folio","Reference")} {ackLabel(p.acknowledgment_no)} · {t("Destinatario:","Recipient:")} {p.recipient_name||t(t('No especificado','Not specified'),'Not specified')}</p>
    <small>{p.status==='approved'?t('Aprobada','Approved'):p.status==='rejected'?t('Rechazada','Rejected'):p.status==='pending'?t('Pendiente','Pending'):t(t('Registro anterior','Previous record'),'Previous record')} · {new Date(p.created_at).toLocaleString('es-MX')}</small></div>
   <strong className="history-amount">{format(p.amount,p.currency_code||'MXN')}<small style={{display:'block',fontSize:11,fontWeight:400}}>{t("No cobrado","Not collected")}</small></strong>
  </div>)}{!intents.length&&<p className="empty-small">{t("Aún no hay intenciones.","No intentions yet.")}</p>}</div>}
  {tab==='users'&&<div className="admin-list">{members.filter(m=>match(m.display_name,m.scout_id,m.member_type)).map(m=><div className="admin-line user-line" key={m.id}>
   <Avatar user={m} size={48}/><div className="grow"><b>{m.display_name}</b><p>{m.member_type==='supporter'?t('Simpatizante','Supporter'):m.scout_id} · {m.group_name}</p></div>
   <div className="admin-actions">{m.role==='admin'?<span className="verified">{t("Administrador único","Sole administrator")}</span>:<button disabled={busy} className={m.verified?'danger':'small-approve'}
    onClick={()=>{void act(()=>backend.reviewUser(m.id,!m.verified),'Estado de acceso actualizado.')}}>{m.verified?t('Revocar acceso','Revoke access'):t('Aprobar acceso','Approve access')}</button>}</div>
  </div>)}</div>}
  <p className="detail-disclaimer">{t("Los importes son intenciones de apoyo, no dinero recaudado. Este sitio no procesa pagos ni emite documentos fiscales.","Amounts represent intentions, not funds raised. This site does not process payments or issue tax documents.")}</p>
 </section>;
}

export default function App(){
 const {t,format,language}=usePreferences();
 const setupDismissed=useRef(false);
 const [viewer,setViewer]=useState<Profile|null>(null),[needsEnrollment,setNeedsEnrollment]=useState(false),[causes,setCauses]=useState<Cause[]>([]),[loading,setLoading]=useState(true);
 const [screen,setScreen]=useState<Screen>('explore'),[profileTarget,setProfileTarget]=useState<Profile|null>(null),[selectedCause,setSelectedCause]=useState<Cause|null>(null);
 const [creatingCause,setCreatingCause]=useState(false),[ack,setAck]=useState<AckDisplay|null>(null);
 const [application,setApplication]=useState(false),[auth,setAuth]=useState<AuthMode|null>(null),[passwordRecovery,setPasswordRecovery]=useState(false);
 const [menu,setMenu]=useState(false),[query,setQuery]=useState(''),[mySupport,setMySupport]=useState<SupportIntent[]>([]);
 const [category,setCategory]=useState<Category|'all'>('all'),[statusFilter,setStatusFilter]=useState<CauseFilter>('all'),[sort,setSort]=useState<CauseSort>('newest');
 const [historyQuery,setHistoryQuery]=useState(''),[historyStatus,setHistoryStatus]=useState<'all'|'pending'|'approved'|'rejected'>('all');
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
 const results=useMemo(()=>filterCauses(causes,{query,category,status:statusFilter,sort}),[causes,query,category,statusFilter,sort]);
 const filteredSupport=useMemo(()=>mySupport.filter(p=>{
  if(historyStatus!=='all'&&p.status!==historyStatus)return false;
  const haystack=[ackLabel(p.acknowledgment_no),p.currency_code,p.amount,p.recipient_name,
    causes.find(c=>c.id===p.cause_id)?.title||''].join(' ').toLocaleLowerCase();
  return haystack.includes(historyQuery.trim().toLocaleLowerCase());
 }),[mySupport,historyStatus,historyQuery,causes]);
 useEffect(()=>{
  const route=()=>{
   const id=new URL(window.location.href).searchParams.get('causa');
   if(!validCauseId(id)){setSelectedCause(null);return}
   if(!canViewCatalogue(viewer))return;
   const found=causes.find(c=>c.id===id&&(c.status==='active'||c.status==='finished'||viewer?.role==='admin'||c.owner_id===viewer?.id));
   setSelectedCause(found||null);
  };
  route();window.addEventListener('popstate',route);return()=>window.removeEventListener('popstate',route);
 },[viewer?.id,viewer?.verified,viewer?.role,causes]);
 const openCause=(c:Cause)=>{
  setSelectedCause(c);
  window.history.pushState(null,'',causeShareUrl(c.id,window.location.href));
 };
 const closeCause=()=>{
  setSelectedCause(null);
  const url=new URL(window.location.href);
  if(url.searchParams.has('causa')){url.searchParams.delete('causa');window.history.replaceState(null,'',url)}
 };
 const shareCause=async(c:Cause)=>{
  const url=causeShareUrl(c.id,window.location.href);
  if(navigator.share){
   try{await navigator.share({title:c.title,url});return}
   catch(err){if((err as Error).name==='AbortError')return}
  }
  try{await navigator.clipboard.writeText(url);notify(t('Enlace privado copiado. Solo podrán abrirlo los miembros aprobados.','Private link copied. Only approved members can open it.'))}
  catch{window.prompt(t('Copia este enlace privado','Copy this private link'),url)}
 };
 const openApplication=()=>{setAuth(null);setApplication(true)};
 const openApprovedRegistration=()=>{setApplication(false);setAuth('signup')};
 const show=(next:Screen)=>{if(next==='setup'&&needsEnrollment){setupDismissed.current=false;setScreen('setup');return}
  if(next!=='explore'&&!access){if(!viewer)setAuth('login');else notify(t("Tu cuenta todavía está pendiente de aprobación.","Your account is still awaiting approval."),true);return}
  if(next==='admin'&&viewer?.role!=='admin'){notify(t("Área privada.","Private area."),true);return}
  setScreen(next);setProfileTarget(null);setMenu(false);window.scrollTo({top:0,behavior:'smooth'});
 };
 const explore=()=>{if(!access){if(needsEnrollment)show('setup');else openApplication();return}
  show('explore');window.setTimeout(()=>document.getElementById('causas')?.scrollIntoView({behavior:'smooth'}),50);
 };
 const create=()=>{if(!viewer){openApplication();return}if(!canPublish(viewer)){notify('Solo organizadores aprobados pueden proponer causas.',true);return}setCreatingCause(true)};
 const profile=(p:Profile)=>{setProfileTarget(p);setScreen('profile');window.scrollTo({top:0,behavior:'smooth'})};
 const logout=async()=>{try{await backend.logout();setupDismissed.current=false;setViewer(null);setNeedsEnrollment(false);setCauses([]);setMySupport([]);setSelectedCause(null);setScreen('explore');notify(t("Sesión cerrada.","Signed out."))}catch(err){notify(friendlyError(err),true)}};
 const mine=causes.filter(c=>c.owner_id===viewer?.id);
 return <>
  <header className="site-header"><div className="nav-container">
   <button className="logo" type="button" onClick={()=>show('explore')} aria-label="ScoutApoya inicio"><span className="logo-mark"><Fleur size={29}/></span><span className="logo-name">SCOUT<span>APOYA</span><small>{t("GRUPO 4 · CHN","GROUP 4 · CHN")}</small></span></button>
   <nav className={menu?'nav-links open':'nav-links'}>
    <button className={screen==='explore'?'nav-active':''} onClick={()=>show('explore')}>{t("Inicio","Home")}</button>
    <button onClick={explore}>{t("Causas","Causes")}</button>
    {access&&canPublish(viewer)&&<button className={screen==='mine'?'nav-active':''} onClick={()=>show('mine')}>{t("Mis causas","My causes")}</button>}
    {access&&<button className={screen==='activity'?'nav-active':''} onClick={()=>show('activity')}>{t("Mis apoyos","My support")}</button>}
    {access&&viewer?.role==='admin'&&<button className={screen==='admin'?'nav-active':''} onClick={()=>show('admin')}>{t("Administración","Admin")}</button>}
   </nav>
   <div className="nav-right"><PreferenceSwitches/>{canPublish(viewer)&&<button className="create-nav" onClick={create}><Plus size={18}/> {t("Crear causa","Create cause")}</button>}
    {viewer?<button className="account" onClick={()=>profile(viewer)}><Avatar user={viewer} size={34}/><span>{viewer.display_name.split(' ')[0]}</span><ChevronDown size={15}/></button>:
     needsEnrollment?<button className="sign-in" onClick={()=>show('setup')}>{t("Activar cuenta","Activate account")}</button>:
     cloud?<button className="sign-in" onClick={()=>setAuth('login')}><LogIn size={17}/> {t("Iniciar sesión","Sign in")}</button>:null}
    <button className="menu-button" onClick={()=>setMenu(!menu)} aria-label={t("Abrir menú","Open menu")}><Menu size={24}/></button>
   </div>
  </div></header>
  <main>{screen==='explore'?<>
   <div className="hero-shell"><section className="hero"><div className="hero-photo" style={{backgroundImage:"linear-gradient(90deg,rgba(33,23,44,.93),rgba(33,23,44,.42)),url('"+sampleHero+"')"}}/>
    <div className="hero-content"><span className="hero-label">{t("⚜ GRUPO 4 · CHIHUAHUA NORTE","⚜ GROUP 4 · NORTH CHIHUAHUA")}</span>
     <h1>{t("Una buena acción","A good deed")}<br/>{t("puede cambiar ","can change ")}<em>{t("vidas.","lives.")}</em></h1>
     <p>{t("Conoce y apoya las causas de nuestra comunidad scout. Transporte, formación, materiales y aventuras: cada proyecto comienza con una buena acción.","Discover and support our Scout community's causes. Transportation, training, equipment, and adventures: every project starts with a good deed.")}</p>
     <div className="hero-actions"><button className="hero-primary" onClick={explore}><Heart size={18}/> {t("Ver causas","View causes")}</button>
      <button className="hero-secondary" onClick={()=>access?show('activity'):openApplication()}>{t("Mi comunidad","My community")} <ArrowRight size={18}/></button></div>
    </div><div className="hero-stamp"><Fleur size={27}/><span>{t("SIEMPRE","BE")}<br/>{t("LISTOS","PREPARED")}</span></div>
   </section></div>
   <section className="intro-strip">
    <div><div className="strip-icon"><Heart size={24}/></div><div><b>{t("Apoyo comunitario","Community support")}</b><span>{t("Proyectos para Grupo 4","Projects for Group 4")}</span></div></div>
    <div><div className="strip-icon"><ShieldCheck size={24}/></div><div><b>{t("Acceso aprobado","Approved access")}</b><span>{t("Comunidad por invitación","Invitation-only community")}</span></div></div>
    <div><div className="strip-icon"><Compass size={24}/></div><div><b>{t("Folios individuales","Unique reference numbers")}</b><span>{t("Constancia de cada intención","Acknowledgment for every intention")}</span></div></div>
   </section>
   <section className="chn-support-section"><div className="chn-support-deco"><Heart size={48}/></div>
    <div><span className="kicker">{t("TU APOYO DEJA HUELLA","YOUR SUPPORT MAKES AN IMPACT")}</span><h2>{t("Impulsa causas del Grupo 4","Support Group 4 causes")}</h2>
     <p>{t("Explora iniciativas con metas concretas, imágenes y un monto de referencia establecido por su organizador.","Explore initiatives with defined goals, photos, and contribution amounts chosen by their organizer.")}</p>
     <p className="chn-independence">{t("Esta plataforma registra intenciones de apoyo. No cobra dinero ni emite comprobantes fiscales.","This platform records support intentions. It does not collect money or issue tax receipts.")}</p>
    </div><button className="primary" onClick={explore}>{t("Explorar causas","Explore causes")} <Heart size={18}/></button>
   </section>
   {access?<section className="explore-section" id="causas">
    <div className="section-title"><div><span className="kicker">{t("APOYA AL GRUPO 4 DE CHIHUAHUA NORTE","SUPPORT GROUP 4 · NORTH CHIHUAHUA")}</span><h2>{t("Causas de la comunidad","Community causes")} <span>♥</span></h2>
     <p>{t("Elige una causa y solicita una intención de apoyo. Cada una tiene un folio único, cupo limitado y aprobación administrativa.","Choose a cause and submit a support intention. Each has a unique reference, limited capacity, and administrator approval.")}</p></div>
     <div className="headline-stat"><b>{results.length}</b><span>{t("causas visibles","visible causes")}</span></div></div>
    <div className="filter-wrap"><div className="filter-controls chn-cause-filters">
     <label className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Buscar causas','Search causes')} aria-label={t('Buscar causas','Search causes')}/></label>
     <label className="chn-filter-select"><span>{t('Categoría','Category')}</span><select aria-label={t('Filtrar por categoría','Filter by category')} value={category} onChange={e=>setCategory(e.target.value as Category|'all')}>
      <option value="all">{t('Todas','All categories')}</option>{categories.map(c=><option key={c} value={c}>{categoryLabel(c,language)}</option>)}
     </select></label>
     <label className="chn-filter-select"><span>{t('Disponibilidad','Availability')}</span><select aria-label={t('Filtrar por disponibilidad','Filter by availability')} value={statusFilter} onChange={e=>setStatusFilter(e.target.value as CauseFilter)}>
      <option value="all">{t('Todas las causas','All causes')}</option><option value="available">{t('Con lugares','Available')}</option><option value="full">{t('Cupo completo','Full')}</option><option value="ended">{t('Finalizadas','Ended')}</option>
     </select></label>
     <label className="chn-filter-select"><span>{t('Ordenar','Sort')}</span><select aria-label={t('Ordenar causas','Sort causes')} value={sort} onChange={e=>setSort(e.target.value as CauseSort)}>
      <option value="newest">{t('Más recientes','Newest')}</option><option value="ending">{t('Próximas a cerrar','Ending soon')}</option><option value="most-progress">{t('Mayor progreso','Most progress')}</option><option value="spaces">{t('Más espacios','Most spaces')}</option>
     </select></label>
    </div></div>
    {loading?<div className="empty"><Compass size={40}/> {t("Cargando…","Loading…")}</div>:<CauseGallery causes={results} onOpen={openCause}/>}
    {canPublish(viewer)&&<div className="chn-create-bottom"><button className="primary" onClick={create}><Plus size={18}/> {t("Crear nueva causa","Create new cause")}</button></div>}
   </section>:<section className="explore-section private-welcome"><div className="private-welcome-inner"><Compass size={35}/>
     <h2>{t("Comunidad privada del Grupo 4","Private Group 4 community")}</h2><p>{needsEnrollment?'Tu cuenta necesita activar el acceso aprobado.':viewer?'Tu solicitud está en revisión.':'Solicita acceso para conocer nuestros proyectos y causas.'}</p>
     <button className="primary" onClick={()=>needsEnrollment?show('setup'):viewer?setAuth('login'):openApplication()}>{needsEnrollment?t('Activar acceso','Activate access'):t('Solicitar acceso','Request access')} <ArrowRight size={17}/></button>
    </div></section>}
   {access&&canPublish(viewer)&&<section className="cta-panel"><div className="cta-ornament"><Fleur size={85}/></div>
    <div><span className="kicker light">{t("UNA BUENA ACCIÓN","A GOOD DEED")}</span><h2>{t("¿Tu grupo tiene un proyecto que impulsar?","Does your group have a project to support?")}</h2>
     <p>{t("Define la causa, agrega hasta diez fotografías y envíala para aprobación administrativa.","Describe your cause, add up to ten photos, and submit it for administrator approval.")}</p></div>
    <button onClick={create} className="cta-button">{t("Proponer causa","Submit cause")} <ArrowRight size={18}/></button></section>}
  </>:screen==='setup'?<section className="inner-page chn-setup-page"><div className="chn-setup-card"><div className="chn-setup-badge"><Fleur size={27}/></div>
   <ExistingMemberJoin done={refreshUser} cancel={logout} onSkip={()=>{setupDismissed.current=true;setScreen('explore')}} onApply={openApplication} notify={notify}/></div></section>:
  screen==='mine'?<section className="inner-page"><div className="section-title"><div><span className="kicker">{t("MIS PROYECTOS","MY PROJECTS")}</span><h2>{t("Mis causas","My causes")}</h2><p>{t("Consulta tus causas, incluidas las que están pendientes de aprobación.","View your causes, including those awaiting approval.")}</p></div>
    <button className="primary" onClick={create}><Plus size={17}/> {t("Nueva causa","New cause")}</button></div><CauseGallery causes={mine} includeDrafts onOpen={openCause}/></section>:
  screen==='activity'?<section className="inner-page"><div className="section-title"><div><span className="kicker">{t("TU COMUNIDAD","YOUR COMMUNITY")}</span><h2>{t("Historial de apoyos","Support history")}</h2><p>{t("Consulta los folios únicos y su estado de aprobación. Ninguno acredita pagos.","View your unique reference numbers and approval statuses. None is proof of payment.")}</p></div><Heart size={40} className="page-icon"/></div>
   <div className="activity-block"><h3><Heart size={20}/> {t("Mis intenciones","My intentions")} <span>{mySupport.length}</span></h3>
    <div className="chn-history-filters">
     <label className="search-field"><Search size={17}/><input value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)}
      placeholder={t('Buscar folio, causa o destinatario','Find reference, cause, or recipient')} aria-label={t('Buscar historial','Search history')}/></label>
     <select aria-label={t('Estado de intención','Intention status')} value={historyStatus} onChange={e=>setHistoryStatus(e.target.value as 'all'|'pending'|'approved'|'rejected')}>
      <option value="all">{t('Todos los estados','All statuses')}</option><option value="pending">{t('Pendientes','Pending')}</option><option value="approved">{t('Aprobadas','Approved')}</option><option value="rejected">{t('Rechazadas','Rejected')}</option>
     </select>
    </div>
    {filteredSupport.length?filteredSupport.map(p=><div className="activity-row" key={p.id}>
     <b>{causes.find(c=>c.id===p.cause_id)?.title||'Apoyo al Grupo 4'} · {format(p.amount,p.currency_code||'MXN')}</b>
     <small>Folio {ackLabel(p.acknowledgment_no)} · {p.status==='approved'?t('Aprobada','Approved'):p.status==='rejected'?t('Rechazada','Rejected'):p.status==='pending'?t('Pendiente de aprobación','Pending approval'):t(t('Registro anterior','Previous record'),'Previous record')} · Sin pago</small>
     <small>Destinatario: {p.recipient_name||t(t('No especificado','Not specified'),'Not specified')} · {new Date(p.created_at).toLocaleDateString('es-MX')}</small>
     <button className="chn-cause-history-action" onClick={()=>setAck({intent_id:p.id,ack_no:p.acknowledgment_no,cause_title:causes.find(c=>c.id===p.cause_id)?.title||'Apoyo al Grupo 4',issued_at:p.created_at,intent_status:p.status,recipient_name:p.recipient_name,amount_value:p.amount,currency_code:p.currency_code||'MXN'})}>{t("Ver acuse numerado","View numbered acknowledgment")}</button>
    </div>):<p className="empty-small">{mySupport.length?t('No hay resultados para esos filtros.','No matches for these filters.'):t("No has registrado ninguna intención de apoyo.","You haven't registered any support intentions.")}</p>}
    <button className="secondary" onClick={explore}>{t("Explorar causas","Explore causes")}</button>
   </div></section>:
  screen==='profile'&&(profileTarget||viewer)?<div className="inner-page profile-container"><button className="back-link" onClick={()=>show('explore')}><ArrowLeft size={17}/> Volver</button>
   <ProfilePage person={(profileTarget||viewer)!} current={viewer?.id===(profileTarget||viewer)?.id} onSave={refreshUser} notify={notify}
    causes={causes.filter(c=>c.owner_id===(profileTarget||viewer)?.id&&(c.status==='active'||c.status==='finished'||viewer?.id===c.owner_id))} onOpen={openCause}/>
   {viewer?.id===(profileTarget||viewer)?.id&&<button className="text-logout" onClick={()=>{void logout()}}><LogOut size={16}/> {t("Cerrar sesión","Sign out")}</button>}</div>:
  screen==='admin'&&viewer?.role==='admin'?<div className="inner-page"><Admin causes={causes} refresh={refresh} notify={notify}/></div>:null
  }</main>
  <footer className="footer"><div className="footer-top"><div className="footer-brand"><div className="logo-mark"><Fleur size={27}/></div><div><b>SCOUTAPOYA <span>CHN</span></b><p>{t("Causas comunitarias del Grupo 4 de Chihuahua Norte.","Community causes for Group 4, North Chihuahua.")}</p></div></div>
   <div className="footer-links"><button onClick={()=>show('explore')}>{t("Inicio","Home")}</button><button onClick={explore}>{t("Causas","Causes")}</button>{access&&<button onClick={()=>show('activity')}>{t("Mis apoyos","My support")}</button>}</div></div>
   <div className="footer-bottom"><span>© {new Date().getFullYear()} ScoutApoya · Grupo 4 CHN</span><span>{t("Sin pagos integrados · Acuses de intención · Comunidad privada","No integrated payments · Intention acknowledgments · Private community")}</span></div>
  </footer>
  {toast&&<div className={'toast'+(toast.error?' error':'')} role="status">{toast.error?<Flag size={18}/>:<CheckCircle2 size={18}/>} {toast.text}<button onClick={()=>setToast(null)} aria-label={t('Cerrar','Close')}><X size={16}/></button></div>}
  {application&&<Modal onClose={()=>setApplication(false)}><AccessApplication onClose={()=>setApplication(false)} notify={notify} onRegister={openApprovedRegistration}/></Modal>}
  {passwordRecovery&&<Modal onClose={()=>setPasswordRecovery(false)}><PasswordRecovery onClose={()=>setPasswordRecovery(false)} notify={notify}/></Modal>}
  {auth&&<Modal onClose={()=>setAuth(null)}><Authentication mode={auth} setMode={setAuth} onClose={()=>setAuth(null)} onSuccess={async()=>{setupDismissed.current=false;await refreshUser()}} notify={notify} onApply={openApplication}/></Modal>}
  {ack&&<Modal width="620px" onClose={()=>setAck(null)}><AckPanel data={ack} onClose={()=>setAck(null)}/></Modal>}
  {selectedCause&&access&&<Modal width="920px" onClose={closeCause}><CauseDetail cause={selectedCause} onClose={closeCause} onShare={()=>{void shareCause(selectedCause)}} onUpdated={refresh} notify={notify} onAcknowledged={result=>{setAck(result);if(viewer)void backend.supportIntents(viewer.id).then(setMySupport).catch(()=>{})}}/></Modal>}
  {creatingCause&&viewer&&<Modal width="850px" onClose={()=>setCreatingCause(false)}><CauseEditor user={viewer} onClose={()=>setCreatingCause(false)} onSaved={refresh} notify={notify}/></Modal>}
 </>;
}
