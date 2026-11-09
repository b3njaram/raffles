import {useCallback,useEffect,useMemo,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {ArrowLeft,ArrowRight,BarChart3,Check,CheckCircle2,ChevronDown,Clock3,Compass,Flag,Heart,ImagePlus,LogIn,LogOut,Menu,Mountain,Plus,Search,ShieldCheck,Sparkles,Ticket,Upload,Users,X} from 'lucide-react';
import {backend,cloud,imageUrl,supabase} from './backend';
import type {Category,Draft,Listing,MemberType,Profile,TicketOrder,TicketNumber,AdminReport} from './types';
import {canPublish,canRequestTickets,canViewCatalogue,categories,defaultDraft,formatId,isLive,isScoutId,money,remaining,salesReady} from './types';
import './style.css';

type Screen='explore'|'mine'|'activity'|'profile'|'admin';
type AuthMode='login'|'signup';
const sampleHero='https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1600&q=80';
const categoryIcons:Record<Category,string>={Aventura:'⛺',Equipo:'🎒',Coleccionables:'🏅',Experiencias:'🏕️',Arte:'🎨',Otros:'✨'};
const emptyReport:AdminReport={orders:[],tickets:[],confirmed:0,pending:0,totalTickets:0};
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
 const img=imageUrl(item.image_paths[0]),percent=Math.min(100,Math.round(100*item.entry_count/item.max_entries));
 return <button className="listing-card" type="button" onClick={onOpen} aria-label={'Ver '+item.title}>
  <div className="listing-cover">{img?<img src={img} alt={item.title} loading="lazy"/>:<div className="placeholder"><Mountain size={48}/></div>}
   <span className="type-mark raffle"><span className="dot"/> Rifa por boletos</span>
   {!isLive(item)&&<span className="closed-tag">{item.status==='pending'?'En revisión':'No disponible'}</span>}</div>
  <div className="listing-info">
   <div className="card-eyebrow"><span>{categoryIcons[item.category]} {item.category}</span><span><Clock3 size={13}/>{remaining(item.end_at)}</span></div>
   <h3>{item.title}</h3>
   <div className="host"><Avatar user={item.owner} size={25}/><span>Por <b>{item.owner?.display_name||'Organizador'}</b></span></div>
   <div className="ticket-price-row"><div><small>Precio por boleto</small><strong>{money(item.ticket_price)}</strong></div><div><small>Boletos confirmados</small><strong>{item.entry_count} / {item.max_entries}</strong></div></div>
   <div className="progress-track chn-card-progress"><span style={{width:percent+'%'}}/></div>
   <div className="ticket-card-bottom"><span>{salesReady(item)?'Disponible':item.status==='finished'?'Resultado publicado':'En preparación'}</span><span className="round-arrow"><ArrowRight size={19}/></span></div>
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
function Authentication({mode,setMode,onClose,onSuccess,notify}:{mode:AuthMode;setMode:(m:AuthMode)=>void;onClose:()=>void;onSuccess:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
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
   }else{await backend.login(email.trim(),password);await onSuccess();notify('¡Bienvenido!');onClose();}
  }catch(err){notify(err instanceof Error?err.message:'No fue posible completar el acceso.',true)}finally{setBusy(false)}
 };
 return <div className="auth-content">
  <div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">RIFAS</span> <sup>CHN</sup></span></div>
  <h2>{mode==='signup'?'Únete a nuestra comunidad':'Bienvenido de vuelta'}</h2>
  <p className="subtle">{mode==='signup'?'Una forma de apoyar nuevas aventuras.':'Inicia sesión para ver las actividades.'}</p>
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
  </form><p className="auth-foot">La admisión está sujeta a revisión. No se procesan pagos en este sitio.</p>
 </div>;
}
function ExistingMemberJoin({done,cancel,notify}:{done:()=>Promise<void>;cancel:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
 const [kind,setKind]=useState<MemberType>('supporter'),[name,setName]=useState(''),[id,setId]=useState('CHN-'),[group,setGroup]=useState('');
 const [referral,setReferral]=useState(''),[adult,setAdult]=useState(false),[busy,setBusy]=useState(false);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);
  try{await backend.enrollExisting(kind,formatId(id),name.trim(),group.trim(),adult,referral.trim());await done();notify('Solicitud registrada; pendiente de aprobación.')}
  catch(err){notify(err instanceof Error?err.message:'No se pudo completar el perfil.',true)}finally{setBusy(false)}
 };
 return <div className="auth-content"><span className="kicker">COMPLETA TU PERFIL</span><h2>Bienvenido a ScoutRifas</h2><p className="subtle">Tu sesión ya está activa. Completa tus datos para ingresar a la comunidad.</p>
  <form className="form-col" onSubmit={submit}><KindPicker kind={kind} setKind={setKind}/>
   <label>Nombre<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)}/></label>
   {kind==='scout'?<><label>ID scout<input required maxLength={16} value={id} pattern="CHN-?[A-Za-z0-9]{4,12}" onChange={e=>setId(e.target.value.toUpperCase())}/></label><label>Grupo<input value={group} maxLength={70} onChange={e=>setGroup(e.target.value)}/></label></>:
   <label>Referencia o invitación (opcional)<input maxLength={120} value={referral} onChange={e=>setReferral(e.target.value)}/></label>}
   <label className="chn-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> Confirmo ser mayor de edad.</label>
   <button type="submit" className="primary full" disabled={busy}>{busy?'Guardando…':'Completar registro'} <ArrowRight size={17}/></button>
  </form><button className="text-logout" type="button" onClick={()=>{void cancel()}}>Cambiar de cuenta</button>
 </div>;
}
function Detail({item,user,onClose,onLogin,refresh,notify,onProfile}:{item:Listing;user:Profile|null;onClose:()=>void;onLogin:()=>void;refresh:()=>Promise<void>;notify:(s:string,e?:boolean)=>void;onProfile:(p:Profile)=>void}){
 const [quantity,setQuantity]=useState(1),[photo,setPhoto]=useState(0),[busy,setBusy]=useState(false),[winner,setWinner]=useState<Profile|null>(null);
 useEffect(()=>{setPhoto(0);setQuantity(1)},[item.id]);
 useEffect(()=>{let active=true;if(item.winner_id)void backend.members().then(users=>{if(active)setWinner(users.find(u=>u.id===item.winner_id)||null)}).catch(()=>{});return()=>{active=false}},[item.winner_id]);
 const ready=salesReady(item),maximum=Math.max(1,Math.min(10,item.max_per_user,item.max_entries-item.entry_count));
 const act=async()=>{
  if(!user){onLogin();return;}
  setBusy(true);try{
   await backend.requestTickets(item,user,quantity);
   notify('Solicitud registrada. Recibirás tus folios cuando administración confirme la operación autorizada.');
   await refresh();onClose();
  }catch(err){notify(err instanceof Error?err.message:'No se pudo solicitar.',true)}finally{setBusy(false)}
 };
 return <div className="detail-layout">
  <div className="detail-image"><img src={imageUrl(item.image_paths[photo])||sampleHero} alt={item.title}/>
   <span className="type-mark raffle"><span className="dot"/> Rifa por boletos</span>
   {item.image_paths.length>1&&<div className="detail-thumbnails">{item.image_paths.map((p,i)=><button type="button" key={p} className={photo===i?'chosen':''} onClick={()=>setPhoto(i)} aria-label={'Ver fotografía '+String(i+1)}><img src={imageUrl(p)} alt=""/></button>)}</div>}
  </div>
  <div className="detail-main">
   <div className="eyebrow">{categoryIcons[item.category]} {item.category} <span className="sep">•</span> <Status status={item.status}/></div>
   <h2>{item.title}</h2>
   <div className="detail-host">Organiza <button type="button" onClick={()=>{if(item.owner)onProfile(item.owner)}}><Avatar user={item.owner} size={28}/>{item.owner?.display_name||'Organizador'}</button></div>
   <p className="detail-desc">{item.description}</p>
   <div className="detail-grid"><div><Clock3 size={18}/><small>Cierre previsto</small><strong>{remaining(item.end_at)}</strong></div><div><Ticket size={18}/><small>Boletos confirmados</small><strong>{item.entry_count} / {item.max_entries}</strong></div></div>
   <div className="ticket-detail-price"><small>Precio fijo por boleto</small><strong>{money(item.ticket_price)} MXN</strong><span>No se procesan cobros en línea</span></div>
   <div className="progress-track chn-detail-progress"><span style={{width:Math.min(100,100*item.entry_count/item.max_entries)+'%'}}/></div>
   {winner&&<div className="winner"><Sparkles size={18}/> Folio premiado: <b>{item.winning_ticket_no}</b> · {winner.display_name}</div>}
   {ready?<div className="ticket-order-control">
     <label>¿Cuántos boletos? (máximo {item.max_per_user} por persona)<div className="chn-quantity">
      <button type="button" onClick={()=>setQuantity(Math.max(1,quantity-1))} aria-label="Quitar un boleto">−</button>
      <input type="number" min={1} max={maximum} step={1} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(maximum,Math.trunc(Number(e.target.value)||1))))}/>
      <button type="button" onClick={()=>setQuantity(Math.min(maximum,quantity+1))} aria-label="Agregar un boleto">+</button>
     </div></label>
     <p className="ticket-total"><span>Total de referencia</span><strong>{money(quantity*item.ticket_price)}</strong></p>
    </div>:<div className="raffle-note"><Clock3 size={21}/><div><strong>Próximamente</strong><p>Esta rifa todavía no acepta solicitudes de boletos. Consulta las bases oficiales cuando se habilite.</p></div></div>}
   {item.permit_number&&<div className="chn-permit"><ShieldCheck size={17}/> Permiso registrado: {item.permit_number}</div>}
   {item.official_rules_url&&<a className="chn-rules-link" href={item.official_rules_url} target="_blank" rel="noopener noreferrer">Consultar las bases y condiciones</a>}
   <button className="primary full" type="button" disabled={busy||!ready||!user||!canRequestTickets(user)||user.id===item.owner_id||item.entry_count>=item.max_entries} onClick={()=>{void act()}}>
    {busy?'Registrando…':!ready?'Boletos aún no disponibles':!user?'Inicia sesión':!canRequestTickets(user)?'Cuenta sin acceso a boletos':user.id===item.owner_id?'Eres el organizador':item.entry_count>=item.max_entries?'Boletos agotados':'Solicitar '+String(quantity)+' boleto'+(quantity===1?'':'s')}
    <ArrowRight size={17}/>
   </button>
   <p className="detail-disclaimer">La solicitud no representa un pago ni un boleto emitido. Solo se asignan folios después de la confirmación administrativa bajo autorización válida.</p>
  </div>
 </div>;
}
function CreateListing({user,onClose,done,notify}:{user:Profile;onClose:()=>void;done:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
 const [draft,setDraft]=useState<Draft>(defaultDraft),[photos,setPhotos]=useState<File[]>([]),[busy,setBusy]=useState(false);
 const set=<K extends keyof Draft>(field:K,value:Draft[K])=>setDraft(d=>({...d,[field]:value}));
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;
  if(new Date(draft.end_at).getTime()<Date.now()+3600000){notify('El cierre debe ser al menos una hora después de ahora.',true);return;}
  if(!photos.length){notify('Agrega una fotografía al menos.',true);return;}
  setBusy(true);try{
   const paths=await Promise.all(photos.map(p=>backend.upload(p,user.id,'listings')));
   await backend.create({...draft,end_at:new Date(draft.end_at).toISOString()},user,paths);
   notify('Rifa preparada y enviada a revisión. Los boletos no se habilitan sin autorización.');
   await done();onClose();
  }catch(err){notify(err instanceof Error?err.message:'Error al crear rifa.',true)}finally{setBusy(false)}
 };
 return <div className="create-modal"><span className="kicker">UNA NUEVA AVENTURA</span><h2>Preparar rifa por boletos</h2>
  <p className="subtle">Define el premio, precio y cupo. La administración revisará la publicación; la venta permanecerá cerrada mientras no exista permiso aplicable.</p>
  <form className="form-col" onSubmit={submit}>
   <label>Título<input required minLength={5} maxLength={110} value={draft.title} onChange={e=>set('title',e.target.value)} placeholder="Ej. Mochila de aventura"/></label>
   <label>Descripción y condiciones<textarea required minLength={20} maxLength={2500} rows={4} value={draft.description} onChange={e=>set('description',e.target.value)} placeholder="Describe el premio, su valor, condiciones y fecha prevista de entrega."/></label>
   <div className="two-fields"><label>Categoría<select value={draft.category} onChange={e=>set('category',e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Fecha de cierre<input required type="datetime-local" value={draft.end_at} onChange={e=>set('end_at',e.target.value)}/></label></div>
   <div className="two-fields"><label>Precio por boleto (MXN)<input required type="number" min={1} max={100000} value={draft.ticket_price} onChange={e=>set('ticket_price',Number(e.target.value))}/></label>
    <label>Boletos disponibles<input required type="number" min={1} max={100000} value={draft.max_entries} onChange={e=>set('max_entries',Number(e.target.value))}/></label></div>
   <label>Máximo de boletos por persona<input required type="number" min={1} max={10} value={draft.max_per_user} onChange={e=>set('max_per_user',Number(e.target.value))}/></label>
   <label>Fotografías (1 a 4, hasta 5 MB cada una)<div className="upload-zone"><ImagePlus size={25}/><b>Agregar imágenes</b><small>JPG, PNG o WebP</small>
    <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{const list=Array.from(e.target.files||[]);setPhotos(list.slice(0,4));if(list.length>4)notify('Máximo cuatro fotos.',true)}}/></div></label>
   {photos.length>0&&<div className="file-list">{photos.map((p,i)=><span key={i}>{p.name}</span>)}</div>}
   <div className="notice"><ShieldCheck size={18}/> La venta solo podrá habilitarse después de verificar la documentación legal del sorteo.</div>
   <button className="primary full" disabled={busy} type="submit">{busy?'Guardando…':'Enviar a revisión'}<ArrowRight size={17}/></button>
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
 const [members,setMembers]=useState<Profile[]>([]),[report,setReport]=useState<AdminReport>(emptyReport),[tab,setTab]=useState<'raffles'|'orders'|'members'|'tickets'>('raffles');
 const [busy,setBusy]=useState(''),[search,setSearch]=useState(''),[winning,setWinning]=useState<Record<string,string>>({}),[references,setReferences]=useState<Record<string,string>>({});
 const [updated,setUpdated]=useState<Date|null>(null);
 const reload=useCallback(async()=>{try{const [people,stats]=await Promise.all([backend.members(),backend.adminOverview()]);setMembers(people);setReport(stats);setUpdated(new Date())}
 catch(err){notify(err instanceof Error?err.message:'Error en administración.',true)}},[notify]);
 useEffect(()=>{void reload();const interval=window.setInterval(()=>{void reload();void refresh().catch(()=>{})},15000);return()=>window.clearInterval(interval)},[reload,refresh]);
 const userNames=new Map(members.map(m=>[m.id,m])),listingNames=new Map(items.map(l=>[l.id,l]));
 const pending=items.filter(l=>l.status==='pending').length,query=search.trim().toLowerCase();
 const filter=(...bits:(string|number|null|undefined)[])=>!query||bits.join(' ').toLowerCase().includes(query);
 const handle=async(id:string,task:()=>Promise<unknown>,message:string)=>{setBusy(id);try{await task();await Promise.all([reload(),refresh()]);notify(message)}catch(err){notify(err instanceof Error?err.message:'No se pudo completar.',true)}finally{setBusy('')}};
 const review=(id:string,action:'active'|'paused'|'cancelled')=>void handle(id,()=>backend.reviewListing(id,action),'Publicación actualizada.');
 const verify=(id:string,state:boolean)=>void handle(id,()=>backend.reviewUser(id,state),'Miembro actualizado.');
 const reviewOrder=(o:TicketOrder,action:'confirmed'|'cancelled')=>{
  if(action==='confirmed'&&!window.confirm('¿Confirmaste documentalmente la operación y verificaste que el sorteo tiene autorización vigente?'))return;
  void handle(o.id,()=>backend.reviewOrder(o.id,action),action==='confirmed'?'Boletos y folios confirmados.':'Solicitud cancelada.');
 };
 const draw=(l:Listing)=>{
  const no=Number(winning[l.id]),reference=references[l.id]||'';
  if(!Number.isInteger(no)||no<1||reference.trim().length<8){notify('Indica un folio confirmado y referencia del acta.',true);return;}
  if(!window.confirm('¿El folio corresponde al sorteo oficial supervisado? El resultado será irreversible.'))return;
  void handle(l.id,()=>backend.recordDraw(l.id,no,reference),'Resultado oficial registrado.');
 };
 const csv=()=>{
  const cell=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+\-@]/,"'$&")+'"';
  const rows=[['Fecha','Rifa','Participante','Tipo de cuenta','Cantidad','Precio unitario MXN','Total MXN','Estado'],
   ...report.orders.map(o=>[o.created_at,listingNames.get(o.listing_id)?.title||'',userNames.get(o.user_id)?.display_name||'',userNames.get(o.user_id)?.member_type||'',o.quantity,o.unit_price,o.total_price,o.status])];
  const blob=new Blob([String.fromCharCode(65279)+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='scoutrifas-boletos.csv';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const totalReference=report.orders.filter(o=>o.status==='confirmed').reduce((sum,o)=>sum+o.total_price,0);
 return <section className="admin-view">
  <div className="section-title"><div><span className="kicker">CENTRO DE CONTROL</span><h2>Administración de rifas</h2><p>Folios, confirmaciones y avance de cada sorteo.</p></div><ShieldCheck size={38} className="admin-shield"/></div>
  <div className="stat-grid chn-stats">
   <div className="stat"><Ticket/><b>{items.length}</b><span>Rifas creadas</span></div>
   <div className="stat"><Clock3/><b>{pending}</b><span>Por revisar</span></div>
   <div className="stat"><Users/><b>{report.pending}</b><span>Solicitudes pendientes</span></div>
   <div className="stat"><CheckCircle2/><b>{report.totalTickets}</b><span>Folios emitidos</span></div>
   <div className="stat"><Heart/><b>{members.filter(m=>m.member_type==='supporter'&&m.verified).length}</b><span>Simpatizantes aprobados</span></div>
   <div className="stat"><BarChart3/><b>{money(totalReference)}</b><span>Valor de boletos confirmados*</span></div>
  </div>
  <div className="admin-toolbar"><small>Actualización cada 15 segundos{updated?' · '+updated.toLocaleTimeString('es-MX'):''}</small><button className="secondary" type="button" onClick={()=>{void reload();void refresh()}}>Actualizar</button></div>
  <div className="admin-progress"><h3>Progreso de las rifas</h3>
   {items.filter(l=>l.status!=='cancelled').map(l=><div className="progress-row" key={l.id}><div><b>{l.title}</b><small>{l.entry_count}/{l.max_entries} boletos · {money(l.ticket_price)} c/u · {l.sales_authorized?'Permiso registrado':'Venta no habilitada'}</small></div>
    <div className="progress-track"><span style={{width:Math.min(100,100*l.entry_count/l.max_entries)+'%'}}/></div></div>)}
   {!items.length&&<p className="empty-small">Todavía no hay rifas creadas.</p>}
  </div>
  <div className="tabs admin-tabs">
   <button className={tab==='raffles'?'active':''} onClick={()=>setTab('raffles')}>Rifas ({pending} pendientes)</button>
   <button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}>Solicitudes ({report.pending})</button>
   <button className={tab==='tickets'?'active':''} onClick={()=>setTab('tickets')}>Folios ({report.totalTickets})</button>
   <button className={tab==='members'?'active':''} onClick={()=>setTab('members')}>Usuarios ({members.filter(m=>!m.verified).length} pendientes)</button>
  </div>
  <div className="admin-filter"><label className="search-field"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por rifa o persona" aria-label="Buscar en administración"/></label>
   {tab==='orders'&&<button className="secondary" onClick={csv}>Exportar CSV</button>}</div>
  {tab==='raffles'&&<div className="admin-list">{items.filter(l=>filter(l.title,l.owner?.display_name,l.status)).map(l=><div className="admin-line" key={l.id}>
   <img src={imageUrl(l.image_paths[0])||sampleHero} alt=""/>
   <div className="grow"><b>{l.title}</b><p>{l.owner?.display_name||'Organizador'} · Precio: {money(l.ticket_price)} · {new Date(l.end_at).toLocaleDateString('es-MX')}</p>
    <Status status={l.status}/><div className="mini-metrics">{l.entry_count}/{l.max_entries} folios · {l.sales_authorized?'Habilitada':'Venta pendiente de autorización'}</div>
    {l.permit_number&&<small>Permiso: {l.permit_number}</small>}
    {l.status==='active'&&new Date(l.end_at)<=new Date()&&l.sales_authorized&&<div className="chn-draw-fields">
     <label>Folio ganador<input type="number" min={1} value={winning[l.id]||''} onChange={e=>setWinning(v=>({...v,[l.id]:e.target.value}))}/></label>
     <label>Referencia del acta<input value={references[l.id]||''} onChange={e=>setReferences(v=>({...v,[l.id]:e.target.value}))}/></label>
     <button className="small-approve" disabled={!!busy} onClick={()=>draw(l)}>Registrar resultado</button></div>}
   </div>
   <div className="admin-actions">
    {(l.status==='pending'||l.status==='paused')&&<button className="small-approve" disabled={!!busy} onClick={()=>review(l.id,'active')}><Check size={15}/> Aprobar</button>}
    {l.status==='active'&&<button disabled={!!busy} onClick={()=>review(l.id,'paused')}>Pausar</button>}
    {['pending','active','paused'].includes(l.status)&&<button className="danger" disabled={!!busy} onClick={()=>review(l.id,'cancelled')}>Cancelar</button>}
   </div></div>)}{!items.length&&<p className="empty-small">Sin publicaciones por ahora.</p>}</div>}
  {tab==='orders'&&<div className="admin-list">{report.orders.filter(o=>filter(listingNames.get(o.listing_id)?.title,userNames.get(o.user_id)?.display_name,o.status)).map(o=><div className="admin-line chn-history" key={o.id}>
   <span className="history-symbol"><Ticket size={21}/></span>
   <div className="grow"><b>{listingNames.get(o.listing_id)?.title||'Rifa'}</b>
    <p>{userNames.get(o.user_id)?.display_name||'Participante'} · {userNames.get(o.user_id)?.member_type==='supporter'?'Simpatizante':'Scout'} · {new Date(o.created_at).toLocaleString('es-MX')}</p>
    <small>{o.quantity} boletos × {money(o.unit_price)} · {new Date(o.expires_at)<new Date()&&o.status==='pending'?'Vencida':o.status}</small>
   </div>
   <div className="admin-actions"><b>{money(o.total_price)}</b>{o.status==='pending'&&new Date(o.expires_at)>new Date()&&<>
    <button className="small-approve" disabled={!!busy} onClick={()=>reviewOrder(o,'confirmed')}>Confirmar</button>
    <button className="danger" disabled={!!busy} onClick={()=>reviewOrder(o,'cancelled')}>Rechazar</button></>}</div></div>)}
    {!report.orders.length&&<p className="empty-small">Sin solicitudes de boletos.</p>}</div>}
  {tab==='tickets'&&<div className="admin-list">{report.tickets.filter(t=>filter(listingNames.get(t.listing_id)?.title,userNames.get(t.user_id)?.display_name,t.ticket_no)).map(t=><div className="admin-line chn-history" key={t.id}>
   <span className="history-symbol"><Ticket size={21}/></span><div className="grow"><b>{listingNames.get(t.listing_id)?.title||'Rifa'}</b><p>{userNames.get(t.user_id)?.display_name||'Participante'} · {new Date(t.issued_at).toLocaleString('es-MX')}</p></div>
   <strong className="history-amount">Folio #{String(t.ticket_no).padStart(4,'0')}</strong></div>)}
   {!report.tickets.length&&<p className="empty-small">Aún no se han emitido folios.</p>}</div>}
  {tab==='members'&&<div className="admin-list">{members.filter(m=>filter(m.display_name,m.scout_id,m.member_type)).map(m=><div className="admin-line user-line" key={m.id}>
   <Avatar user={m} size={48}/><div className="grow"><b>{m.display_name}</b><p>{m.member_type==='supporter'?'Simpatizante':m.scout_id} · {m.referral_note||m.group_name||'Sin referencia'}</p>
    {m.role==='admin'&&<span className="verified">Administrador</span>}</div>
   <div className="admin-actions">{m.verified?<span className="verified">Verificado</span>:<span className="pending">Por aprobar</span>}
    {m.role!=='admin'&&<button disabled={!!busy} className={m.verified?'danger':'small-approve'} onClick={()=>verify(m.id,!m.verified)}>{m.verified?'Revocar':'Aprobar'}</button>}</div></div>)}</div>}
  <p className="detail-disclaimer">*Valor de referencia de folios confirmados; no implica ingresos cobrados por la plataforma. Ninguna venta puede habilitarse antes de verificar un permiso válido, bases y documentación.</p>
 </section>;
}
export default function App(){
 const [viewer,setViewer]=useState<Profile|null>(null),[needsEnrollment,setNeedsEnrollment]=useState(false),[items,setItems]=useState<Listing[]>([]),[loading,setLoading]=useState(true);
 const [screen,setScreen]=useState<Screen>('explore'),[profileTarget,setProfileTarget]=useState<Profile|null>(null),[selected,setSelected]=useState<Listing|null>(null);
 const [auth,setAuth]=useState<AuthMode|null>(null),[creating,setCreating]=useState(false),[menu,setMenu]=useState(false),[query,setQuery]=useState(''),[category,setCategory]=useState('Todas'),[sort,setSort]=useState('recent');
 const [myOrders,setMyOrders]=useState<TicketOrder[]>([]),[myTickets,setMyTickets]=useState<TicketNumber[]>([]),[toast,setToast]=useState<{text:string;error:boolean}|null>(null);
 const notify=useCallback((text:string,error=false)=>setToast({text,error}),[]);
 useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),5500);return()=>window.clearTimeout(id)},[toast]);
 const refresh=useCallback(async()=>{const list=await backend.list();setItems(list);setSelected(current=>current?list.find(l=>l.id===current.id)||null:null)},[]);
 const refreshUser=useCallback(async()=>{
  const person=await backend.session();setViewer(person);
  setNeedsEnrollment(!person&&cloud?await backend.isSignedIn():false);
  if(canViewCatalogue(person)){setItems(await backend.list())}
  else {setItems([]);setSelected(null);setMyOrders([]);setMyTickets([]);setScreen('explore')}
 },[]);
 useEffect(()=>{let active=true;
  void refreshUser().catch(err=>notify(err instanceof Error?err.message:'Error al cargar sesión.',true)).finally(()=>{if(active)setLoading(false)});
  const observer=supabase?.auth.onAuthStateChange(()=>{window.setTimeout(()=>{if(active)void refreshUser().catch(()=>{})},0)});
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
 const show=(screenName:Screen)=>{if(screenName!=='explore'&&!access){if(!viewer)setAuth('login');else notify('Tu cuenta está pendiente de activación.',true);return;}
  if(screenName==='admin'&&viewer?.role!=='admin'){notify('Área privada.',true);return;}
  setScreen(screenName);setProfileTarget(null);setMenu(false);window.scrollTo({top:0,behavior:'smooth'});
 };
 const openCreate=()=>{if(!viewer){setAuth('signup');return;}if(!canPublish(viewer)){notify('Tu cuenta no tiene permisos para organizar rifas.',true);return;}setCreating(true)};
 const viewProfile=(p:Profile)=>{setProfileTarget(p);setScreen('profile');setSelected(null);window.scrollTo({top:0,behavior:'smooth'})};
 const logout=async()=>{try{await backend.logout();setViewer(null);setNeedsEnrollment(false);setItems([]);setSelected(null);setProfileTarget(null);setScreen('explore');notify('Sesión cerrada.')}catch(err){notify(err instanceof Error?err.message:'Error',true)}};
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
     cloud?<button className="sign-in" onClick={()=>setAuth('login')}><LogIn size={17}/> Iniciar sesión</button>:null}
    <button className="menu-button" onClick={()=>setMenu(!menu)} aria-label="Abrir menú"><Menu size={24}/></button>
   </div></div></header>
  <main>{screen==='explore'?<>
   <div className="hero-shell"><section className="hero"><div className="hero-photo" style={{backgroundImage:"linear-gradient(90deg, rgba(33,23,44,.91) 0%, rgba(33,23,44,.65) 49%, rgba(33,23,44,.2) 100%),url('"+sampleHero+"')"}}/>
    <div className="hero-content"><span className="hero-label"><span className="hero-star">✦</span> PROVINCIA CHIHUAHUA NORTE</span>
     <h1>Compartir también<br/>es una <em>aventura.</em></h1>
     <p>Únete a quienes ayudan a que nuevas aventuras, proyectos y buenas acciones se conviertan en realidad.</p>
     <div className="hero-actions"><button className="hero-primary" onClick={()=>access?document.getElementById('explorar')?.scrollIntoView({behavior:'smooth'}):setAuth('signup')}>
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
     <p>{viewer?'Estamos revisando tu solicitud de acceso.':cloud?'Inicia sesión o únete para descubrir lo que estamos preparando.':'Este espacio se encuentra en preparación.'}</p>
     {!viewer&&cloud&&<button className="primary" onClick={()=>setAuth('signup')}>Crear cuenta <ArrowRight size={17}/></button>}
    </div></section>}
   {access&&canPublish(viewer)&&<section className="cta-panel"><div className="cta-ornament"><Fleur size={85}/></div><div><span className="kicker light">TU SIGUIENTE BUENA ACCIÓN</span><h2>¿Tienes un premio para compartir?</h2><p>Prepara una rifa y envíala a revisión. Solo las rifas autorizadas podrán distribuir boletos.</p></div><button onClick={openCreate} className="cta-button">Preparar rifa <ArrowRight size={19}/></button></section>}
   </>:screen==='mine'?<section className="inner-page"><div className="section-title"><div><span className="kicker">MIS ACTIVIDADES</span><h2>Mis rifas</h2><p>Publicaciones y estado de cada sorteo que organizas.</p></div><button className="primary" onClick={openCreate}><Plus size={17}/> Nueva rifa</button></div>
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
  {needsEnrollment&&!auth&&!loading&&<Modal onClose={()=>{void backend.logout().then(refreshUser)}}><ExistingMemberJoin done={refreshUser} cancel={async()=>{await backend.logout();await refreshUser()}} notify={notify}/></Modal>}
  {auth&&<Modal onClose={()=>setAuth(null)}><Authentication mode={auth} setMode={setAuth} onClose={()=>setAuth(null)} onSuccess={refreshUser} notify={notify}/></Modal>}
  {creating&&viewer&&<Modal width="680px" onClose={()=>setCreating(false)}><CreateListing user={viewer} onClose={()=>setCreating(false)} done={refresh} notify={notify}/></Modal>}
  {selected&&access&&<Modal width="880px" onClose={()=>setSelected(null)}><Detail item={selected} user={viewer} onClose={()=>setSelected(null)} onLogin={()=>setAuth('signup')} refresh={refresh} notify={notify} onProfile={viewProfile}/></Modal>}
 </>;
}
