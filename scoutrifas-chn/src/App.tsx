import {useCallback,useEffect,useMemo,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {ArrowLeft,ArrowRight,BarChart3,Check,CheckCircle2,ChevronDown,Clock3,Compass,Flag,Heart,ImagePlus,LogIn,LogOut,Menu,Mountain,Plus,Search,ShieldCheck,Sparkles,Ticket,TrendingUp,Upload,Users,X} from 'lucide-react';
import {backend,cloud,imageUrl,supabase} from './backend';
import type {Activity,Category,Draft,Listing,Profile} from './types';
import {categories,defaultDraft,formatId,isLive,isScoutId,minimumBid,money,remaining} from './types';
import './style.css';

type Screen='explore'|'mine'|'activity'|'profile'|'admin';
type AuthMode='login'|'signup';
const sampleHero='https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1600&q=80';

function Fleur({size=30}:{size?:number}){return <span className="fleur" style={{fontSize:size}} aria-hidden="true">⚜</span>}
function Avatar({user,size=38}:{user?:Profile|null;size?:number}){
 const src=imageUrl(user?.avatar_path);const letters=(user?.display_name||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
 return <span className="avatar" style={{width:size,height:size,fontSize:size*.32}}>{src?<img src={src} alt="Foto de perfil"/>:letters}</span>;
}
function Status({status}:{status:Listing['status']}){const labels={pending:'En revisión',active:'Activa',paused:'Pausada',finished:'Finalizada',cancelled:'Cancelada'};return <span className={`status status-${status}`}>{labels[status]}</span>}
function TypeMark({type}:{type:Listing['type']}){return <span className={`type-mark ${type}`}><span className="dot"/>{type==='raffle'?'Rifa gratuita':'Subasta'}</span>}
const iconCategories:Record<Category,string>={Aventura:'⛺',Equipo:'🎒',Coleccionables:'🏅',Experiencias:'🏕️',Arte:'🎨',Otros:'✨'};

function Card({item,onOpen}:{item:Listing;onOpen:()=>void}){
 const live=isLive(item);const img=imageUrl(item.image_paths[0]);
 return <button type="button" className="listing-card" onClick={onOpen} aria-label={`Ver ${item.title}`}>
   <div className="listing-cover">{img?<img src={img} alt={item.title} loading="lazy"/>:<div className="placeholder"><Mountain size={48}/></div>}
     <TypeMark type={item.type}/>{!live&&<span className="closed-tag">{item.status==='pending'?'En revisión':'No disponible'}</span>}
   </div>
   <div className="listing-info"><div className="card-eyebrow"><span>{iconCategories[item.category]} {item.category}</span><span><Clock3 size={13}/> {remaining(item.end_at)}</span></div>
     <h3>{item.title}</h3><div className="host"><Avatar user={item.owner} size={25}/><span>Por <b>{item.owner?.display_name||'Scout CHN'}</b></span>{item.owner?.verified&&<CheckCircle2 className="check" size={14}/> }</div>
     <div className="listing-bottom"><div><small>{item.type==='raffle'?'Participaciones':'Puja actual'}</small><strong>{item.type==='raffle'?`${item.entry_count} / ${item.max_entries}`:(item.bid_count?money(item.current_bid):money(item.min_bid))}</strong></div><span className="round-arrow"><ArrowRight size={19}/></span></div>
   </div>
 </button>;
}

function Modal({children,onClose,width='560px'}:{children:ReactNode;onClose:()=>void;width?:string}){
 useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[onClose]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation"><div className="modal" style={{maxWidth:width}} role="dialog" aria-modal="true"><button className="modal-close icon-button" aria-label="Cerrar" onClick={onClose}><X size={20}/></button>{children}</div></div>;
}

function Authentication({mode,setMode,onClose,onSuccess,notify}:{mode:AuthMode;setMode:(m:AuthMode)=>void;onClose:()=>void;onSuccess:()=>Promise<void>;notify:(msg:string,isError?:boolean)=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[id,setId]=useState('CHN-'),[group,setGroup]=useState(''),[busy,setBusy]=useState(false);
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;
  if(mode==='signup'&&!isScoutId(id)){notify('Tu ID debe empezar con CHN y contener 4 a 12 caracteres o números después del prefijo.',true);return;}
  if(password.length<8){notify('Usa una contraseña de al menos 8 caracteres.',true);return;}
  setBusy(true);try{
   if(mode==='signup'){
    const session=await backend.signup(email.trim(),password,name.trim(),formatId(id),group.trim());
    if(session){await onSuccess();notify(cloud?'Cuenta creada. Espera la verificación de tu ID CHN.':'Cuenta de demostración creada; aquí se omite la verificación CHN.');onClose();}
    else{notify('¡Registro recibido! Abre el enlace de tu correo para confirmar la cuenta, después inicia sesión.');setMode('login');}
   }else{await backend.login(email.trim(),password);await onSuccess();notify('¡Qué gusto verte de vuelta!');onClose();}
  }catch(error){notify(error instanceof Error?error.message:'No se pudo completar la solicitud.',true)}finally{setBusy(false)}
 };
 return <div className="auth-content"><div className="modal-brand"><span className="brand-icon"><Fleur size={25}/></span><span>SCOUT<span className="brand-strong">RIFAS</span> <sup>CHN</sup></span></div>
 <h2>{mode==='signup'?'Únete a la comunidad':'Bienvenido de vuelta'}</h2><p className="subtle">{mode==='signup'?'Tu próxima aventura comienza aquí.':'Entra para participar y seguir tus rifas.'}</p>
 <div className="switcher"><button className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Iniciar sesión</button><button className={mode==='signup'?'selected':''} onClick={()=>setMode('signup')}>Crear cuenta</button></div>
 <form onSubmit={submit} className="form-col">
  {mode==='signup'&&<><label>Nombre a mostrar<input required maxLength={65} minLength={2} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label>
  <label>ID scout Chihuahua Norte<span className="input-hint">Debe comenzar con CHN</span><input required maxLength={16} value={id} onChange={e=>setId(e.target.value.toUpperCase())} placeholder="CHN-000123" pattern="CHN-?[A-Za-z0-9]{4,12}"/></label>
  <label>Grupo scout (opcional)<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)} placeholder="Ej. Grupo 18 · Ciudad Juárez"/></label></>}
  <label>Correo electrónico<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label>
  <label>Contraseña<input required minLength={8} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 caracteres o más"/></label>
  {mode==='signup'&&<div className="notice"><ShieldCheck size={18}/><span>El prefijo CHN no verifica tu membresía. Administración revisará tu ID antes de permitir participaciones y publicaciones.</span></div>}
  <button disabled={busy} className="primary full" type="submit">{busy?'Procesando…':mode==='signup'?'Crear mi cuenta':'Entrar a ScoutRifas'} <ArrowRight size={17}/></button>
 </form><p className="auth-foot">Sin pagos, tarjetas ni cobros dentro de la plataforma.</p></div>;
}

function Detail({item,user,onClose,onLogin,refresh,notify,onProfile}:{item:Listing;user:Profile|null;onClose:()=>void;onLogin:()=>void;refresh:()=>Promise<void>;notify:(s:string,error?:boolean)=>void;onProfile:(u:Profile)=>void}){
 const [amount,setAmount]=useState(String(minimumBid(item))),[photo,setPhoto]=useState(0),[busy,setBusy]=useState(false);
 const alive=isLive(item);const [winner,setWinner]=useState<Profile|null>(null);
 useEffect(()=>{setAmount(String(minimumBid(item)));setPhoto(0)},[item.id,item.current_bid,item.bid_count]);
 useEffect(()=>{if(item.winner_id)backend.members().then(x=>setWinner(x.find(u=>u.id===item.winner_id)||null)).catch(()=>{});},[item.winner_id]);
 const act=async()=>{
  if(!user){onLogin();return;}if(!user.verified){notify('Un administrador debe validar tu ID CHN antes de participar.',true);return;}
  setBusy(true);try{
   if(item.type==='raffle'){await backend.join(item,user);notify('¡Ya participas! Tu registro quedó guardado.');}
   else{await backend.bid(item,user,Number(amount));notify('Tu puja se registró correctamente.');}
   await refresh();onClose();
  }catch(e){notify(e instanceof Error?e.message:'No se pudo registrar.',true)}finally{setBusy(false)}
 };
 return <div className="detail-layout"><div className="detail-image"><img src={imageUrl(item.image_paths[photo])||sampleHero} alt={item.title}/><TypeMark type={item.type}/></div>
 <div className="detail-main"><div className="eyebrow">{iconCategories[item.category]} {item.category} <span className="sep">•</span> <Status status={item.status}/></div>
  <h2>{item.title}</h2><div className="detail-host">Publicado por <button onClick={()=>{if(item.owner)onProfile(item.owner)}}><Avatar user={item.owner} size={28}/>{item.owner?.display_name||'Miembro CHN'} {item.owner?.verified&&<ShieldCheck size={15}/>}</button></div>
  <p className="detail-desc">{item.description}</p>
  <div className="detail-grid"><div><Clock3 size={18}/><small>Termina</small><strong>{remaining(item.end_at)}</strong></div><div><Users size={18}/><small>{item.type==='raffle'?'Participaciones':'Pujas registradas'}</small><strong>{item.type==='raffle'?`${item.entry_count} / ${item.max_entries}`:item.bid_count}</strong></div></div>
  {winner&&<div className="winner"><Sparkles size={18}/> Resultado publicado: <b>{winner.display_name}</b></div>}
  {item.type==='auction'?<div className="bidding"><small>Puja actual</small><div className="current-bid">{money(item.bid_count?item.current_bid:item.min_bid)} <span>MXN · Sin cobro en línea</span></div>
     {alive&&<label>Tu propuesta (mínimo {money(minimumBid(item))})<input type="number" min={minimumBid(item)} max={10000000} step={1} value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
   </div>:<div className="raffle-note"><Ticket size={21}/><div><strong>Participación gratuita</strong><p>Máximo {item.max_per_user} {item.max_per_user===1?'participación':'participaciones'} por cuenta verificada. El sorteo se realizará al finalizar.</p></div></div>}
  <button className="primary full" disabled={busy||!alive||user?.id===item.owner_id||!!(user&&!user.verified)} onClick={act}>
   {busy?'Guardando…':!alive?'No disponible':user?.id===item.owner_id?'Es tu publicación':user&&!user.verified?'Pendiente de verificación':item.type==='raffle'?'Quiero participar gratis':'Registrar mi puja'} <ArrowRight size={18}/>
  </button><p className="detail-disclaimer">No se cobran pagos ni se formalizan ventas desde esta plataforma. La administración revisa las publicaciones.</p>
 </div></div>;
}

function CreateListing({user,onClose,done,notify}:{user:Profile;onClose:()=>void;done:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
 const [draft,setDraft]=useState<Draft>(defaultDraft),[images,setImages]=useState<File[]>([]),[busy,setBusy]=useState(false);
 const set=<K extends keyof Draft>(k:K,v:Draft[K])=>setDraft(d=>({...d,[k]:v}));
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;
  if(new Date(draft.end_at).getTime()<Date.now()+3600000){notify('El cierre debe ser al menos una hora después de ahora.',true);return;}
  if(!images.length){notify('Agrega al menos una fotografía del premio o la actividad.',true);return;}
  setBusy(true);try{
   const paths=await Promise.all(images.map(img=>backend.upload(img,user.id,'listings')));
   await backend.create({...draft,end_at:new Date(draft.end_at).toISOString()},user,paths);
   notify(cloud?'Publicación enviada a revisión.':'Publicación guardada en la demostración (pendiente de revisión).');await done();onClose();
  }catch(err){notify(err instanceof Error?err.message:'No se pudo crear.',true)}finally{setBusy(false)}
 };
 return <div className="create-modal"><span className="kicker">COMPARTE LA AVENTURA</span><h2>Crear una publicación</h2><p className="subtle">Tu rifa o subasta aparecerá cuando un administrador la apruebe.</p>
 <form className="form-col" onSubmit={submit}><div className="mode-cards"><button type="button" className={draft.type==='raffle'?'active':''} onClick={()=>set('type','raffle')}><Ticket size={22}/><b>Rifa gratis</b><small>Sorteo entre inscritos</small></button><button type="button" className={draft.type==='auction'?'active':''} onClick={()=>set('type','auction')}><TrendingUp size={22}/><b>Subasta</b><small>Registrar propuestas</small></button></div>
 <label>Título del premio o actividad<input required minLength={5} maxLength={110} value={draft.title} onChange={e=>set('title',e.target.value)} placeholder="Ej. Kit de campamento para exploradores"/></label>
 <label>Descripción<textarea required minLength={20} maxLength={2500} rows={4} value={draft.description} onChange={e=>set('description',e.target.value)} placeholder="Describe qué se ofrece, condiciones y detalles importantes…"/></label>
 <div className="two-fields"><label>Categoría<select value={draft.category} onChange={e=>set('category',e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Fecha y hora de cierre<input required type="datetime-local" min={new Date(Date.now()+3600000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} value={draft.end_at} onChange={e=>set('end_at',e.target.value)}/></label></div>
 {draft.type==='raffle'?<div className="two-fields"><label>Cupos disponibles<input type="number" min={1} max={100000} required value={draft.max_entries} onChange={e=>set('max_entries',Number(e.target.value))}/></label><label>Por usuario<input type="number" min={1} max={10} required value={draft.max_per_user} onChange={e=>set('max_per_user',Number(e.target.value))}/></label></div>:
 <div className="two-fields"><label>Puja inicial (MXN)<input type="number" min={1} max={10000000} required value={draft.min_bid} onChange={e=>set('min_bid',Number(e.target.value))}/></label><label>Incremento mínimo<input type="number" min={1} max={1000000} required value={draft.bid_step} onChange={e=>set('bid_step',Number(e.target.value))}/></label></div>}
 <label>Fotos (1–4, hasta 5 MB cada una)<div className="upload-zone"><ImagePlus size={25}/><b>Agregar fotografías</b><small>JPG, PNG o WebP</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const x=Array.from(e.target.files||[]);setImages(x.slice(0,4));if(x.length>4)notify('Solo se permiten cuatro fotos.',true)}}/></div></label>
 {!!images.length&&<div className="file-list">{images.map((f,i)=><span key={i}>{f.name}</span>)}</div>}
 <div className="notice"><ShieldCheck size={18}/><span>No se procesan pagos. El contenido es moderado y las pujas son propuestas informativas.</span></div>
 <button disabled={busy} type="submit" className="primary full">{busy?'Guardando…':'Enviar para aprobación'} <ArrowRight size={18}/></button>
 </form></div>;
}

function ProfilePage({person,current,onSave,notify,listings,onOpen}:{person:Profile;current:boolean;onSave:()=>Promise<void>;notify:(s:string,e?:boolean)=>void;listings:Listing[];onOpen:(l:Listing)=>void}){
 const [name,setName]=useState(person.display_name),[group,setGroup]=useState(person.group_name),[bio,setBio]=useState(person.bio),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{setName(person.display_name);setGroup(person.group_name);setBio(person.bio);setFile(null)},[person.id,person.display_name,person.group_name,person.bio]);
 const submit=async(e:FormEvent)=>{
   e.preventDefault();setBusy(true);try{
    const path=file?await backend.upload(file,person.id,'avatars'):person.avatar_path;
    await backend.updateProfile(person.id,{display_name:name.trim(),group_name:group.trim(),bio:bio.trim(),avatar_path:path});
    notify('Tu perfil se actualizó.');await onSave();setFile(null);
   }catch(err){notify(err instanceof Error?err.message:'No se pudo guardar.',true)}finally{setBusy(false)}
 };
 return <section className="profile-view"><div className="profile-banner"><Fleur size={76}/><div className="topography"/></div><div className="profile-head"><Avatar user={person} size={102}/><div><div className="inline-heading"><h2>{person.display_name}</h2>{person.verified?<span className="verified"><CheckCircle2 size={15}/> Verificado</span>:<span className="pending"><Clock3 size={15}/> Por verificar</span>}</div><p>{person.scout_id} · {person.group_name||'Provincia Chihuahua Norte'}</p></div></div>
 {current?<form className="form-col profile-edit" onSubmit={submit}><h3>Editar mi perfil</h3><label>Fotografía de perfil<div className="file-button"><Upload size={18}/>{file?.name||'Seleccionar imagen'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></div></label><label>Nombre<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)}/></label><label>Grupo scout<input maxLength={70} value={group} onChange={e=>setGroup(e.target.value)}/></label><label>Sobre mí<textarea maxLength={320} rows={3} placeholder="¿Qué significa el escultismo para ti?" value={bio} onChange={e=>setBio(e.target.value)}/></label><label>ID scout<input disabled value={person.scout_id}/></label><button type="submit" className="primary" disabled={busy}>{busy?'Guardando…':'Guardar cambios'} <Check size={16}/></button></form>:<div className="public-bio"><h3>Acerca de</h3><p>{person.bio||'Miembro de la comunidad de Chihuahua Norte.'}</p></div>}
 <div className="public-listings"><h3>Publicaciones de {person.display_name.split(' ')[0]}</h3>{listings.length?<div className="cards-grid">{listings.map(l=><Card key={l.id} item={l} onOpen={()=>onOpen(l)}/>)}</div>:<p className="empty-small">Sin publicaciones públicas por ahora.</p>}</div></section>;
}

function Admin({items,refresh,notify}:{items:Listing[];refresh:()=>Promise<void>;notify:(s:string,e?:boolean)=>void}){
 const [members,setMembers]=useState<Profile[]>([]),[busy,setBusy]=useState(''),[tab,setTab]=useState<'publications'|'people'>('publications');
 const reload=useCallback(()=>backend.members().then(setMembers).catch(e=>notify(e.message,true)),[notify]);
 useEffect(()=>{void reload()},[reload]);
 const pending=items.filter(x=>x.status==='pending'),live=items.filter(x=>x.status==='active');
 const review=async(id:string,action:'active'|'paused'|'cancelled')=>{setBusy(id);try{await backend.reviewListing(id,action);await refresh();notify('Publicación actualizada.');}catch(e){notify(e instanceof Error?e.message:'Error',true)}finally{setBusy('')}};
 const finish=async(id:string)=>{if(!window.confirm('¿Confirmas cerrar y registrar el resultado? Esta acción no se puede revertir.'))return;
  setBusy(id);try{await backend.finish(id);await refresh();notify('Resultado registrado y publicado.')}catch(e){notify(e instanceof Error?e.message:'Error',true)}finally{setBusy('')}};
 const verify=async(id:string,value:boolean)=>{setBusy(id);try{await backend.reviewUser(id,value);await reload();notify('Estado del usuario actualizado.')}catch(e){notify(e instanceof Error?e.message:'Error',true)}finally{setBusy('')}};
 return <section className="admin-view"><div className="section-title"><div><span className="kicker">CENTRO DE CONTROL</span><h2>Panel de administración</h2><p>Protege a tu comunidad y mantén cada actividad en orden.</p></div><ShieldCheck size={38} className="admin-shield"/></div>
 <div className="stat-grid"><div className="stat"><Ticket/><b>{items.length}</b><span>Publicaciones</span></div><div className="stat"><Clock3/><b>{pending.length}</b><span>Por revisar</span></div><div className="stat"><Users/><b>{members.length}</b><span>Usuarios</span></div><div className="stat"><TrendingUp/><b>{live.length}</b><span>Activas</span></div></div>
 <div className="tabs admin-tabs"><button className={tab==='publications'?'active':''} onClick={()=>setTab('publications')}>Publicaciones ({pending.length})</button><button className={tab==='people'?'active':''} onClick={()=>setTab('people')}>Usuarios ({members.filter(x=>!x.verified).length} por verificar)</button></div>
 {tab==='publications'?<div className="admin-list">{items.filter(x=>x.status!=='finished'&&x.status!=='cancelled').map(l=><div className="admin-line" key={l.id}><img src={imageUrl(l.image_paths[0])||sampleHero} alt=""/><div className="grow"><b>{l.title}</b><p>{l.owner?.display_name||'Scout'} · {l.type==='raffle'?'Rifa':'Subasta'} · {new Date(l.end_at).toLocaleString('es-MX')}</p><Status status={l.status}/></div><div className="admin-actions">{(l.status==='pending'||l.status==='paused')&&<button disabled={!!busy} onClick={()=>review(l.id,'active')} className="small-approve"><Check size={15}/> Aprobar</button>}{l.status==='active'&&<button disabled={!!busy} onClick={()=>review(l.id,'paused')}>Pausar</button>}{l.status==='active'&&new Date(l.end_at).getTime()<=Date.now()&&<button disabled={!!busy} onClick={()=>finish(l.id)}>Cerrar y resolver</button>}<button disabled={!!busy} className="danger" onClick={()=>review(l.id,'cancelled')}>Cancelar</button></div></div>)}{items.filter(x=>!['finished','cancelled'].includes(x.status)).length===0&&<div className="empty-small">No hay publicaciones que moderar.</div>}</div>:
 <div className="admin-list">{members.map(m=><div className="admin-line user-line" key={m.id}><Avatar user={m} size={48}/><div className="grow"><b>{m.display_name}</b><p>{m.scout_id} · {m.group_name||'Sin grupo'}</p>{m.role==='admin'&&<span className="verified">Administrador</span>}</div><div className="admin-actions">{m.verified?<span className="verified"><CheckCircle2 size={15}/> Verificado</span>:<span className="pending">Pendiente</span>}{m.role!=='admin'&&<button disabled={!!busy} className={m.verified?'danger':'small-approve'} onClick={()=>verify(m.id,!m.verified)}>{m.verified?'Revocar':'Validar ID'}</button>}</div></div>)}</div>}
 <div className="notice admin-disclaimer"><ShieldCheck size={20}/> Solo personas autorizadas deben verificar los registros CHN. Verifica identidad y pertenencia por un canal externo antes de aprobar.</div></section>;
}

export default function App(){
 const [viewer,setViewer]=useState<Profile|null>(null),[items,setItems]=useState<Listing[]>([]),[loading,setLoading]=useState(true),[screen,setScreen]=useState<Screen>('explore'),[profileTarget,setProfileTarget]=useState<Profile|null>(null),[selected,setSelected]=useState<Listing|null>(null);
 const [auth,setAuth]=useState<AuthMode|null>(null),[creating,setCreating]=useState(false),[menu,setMenu]=useState(false),[query,setQuery]=useState(''),[kind,setKind]=useState<'all'|'raffle'|'auction'>('all'),[category,setCategory]=useState('Todas'),[sort,setSort]=useState('recent');
 const [activities,setActivities]=useState<{entries:Activity[];bids:Activity[]}>({entries:[],bids:[]}),[toast,setToast]=useState<{text:string;error:boolean}|null>(null);
 const notify=useCallback((text:string,error=false)=>setToast({text,error}),[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),5000);return()=>clearTimeout(t)},[toast]);
 const refresh=useCallback(async()=>{const data=await backend.list();setItems(data);setSelected(current=>current?data.find(i=>i.id===current.id)||null:null);},[]);
 const refreshUser=useCallback(async()=>{setViewer(await backend.session())},[]);
 useEffect(()=>{let alive=true;
  Promise.all([backend.session(),backend.list()]).then(([u,list])=>{if(alive){setViewer(u);setItems(list)}}).catch(e=>notify(e.message,true)).finally(()=>{if(alive)setLoading(false)});
  const sub=supabase?.auth.onAuthStateChange(()=>{setTimeout(()=>{void refreshUser().catch(()=>{})},0)});
  return()=>{alive=false;sub?.data.subscription.unsubscribe()};
 },[notify,refreshUser]);
 useEffect(()=>{if(screen==='activity'&&viewer)backend.activity(viewer.id).then(setActivities).catch(e=>notify(e.message,true));},[screen,viewer,items,notify]);
 const filtered=useMemo(()=>{
  const text=query.trim().toLocaleLowerCase('es');let list=items.filter(l=>l.status==='active' || l.status==='finished');
  if(text)list=list.filter(l=>`${l.title} ${l.description} ${l.category} ${l.owner?.display_name||''}`.toLocaleLowerCase('es').includes(text));
  if(kind!=='all')list=list.filter(l=>l.type===kind);
  if(category!=='Todas')list=list.filter(l=>l.category===category);
  return [...list].sort((a,b)=>sort==='ending'?new Date(a.end_at).getTime()-new Date(b.end_at).getTime():sort==='popular'?(b.entry_count+b.bid_count)-(a.entry_count+a.bid_count):new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
 },[items,query,kind,category,sort]);
 const show=(s:Screen)=>{if(s!=='explore'&&!viewer){setAuth('signup');return;}if(s==='admin'&&viewer?.role!=='admin'){notify('Esta área es exclusiva de administración.',true);return;}setScreen(s);setProfileTarget(null);setMenu(false);window.scrollTo({top:0,behavior:'smooth'})};
 const openCreate=()=>{if(!viewer){setAuth('signup');return;}if(!viewer.verified){notify('Tu cuenta necesita verificación del administrador antes de publicar.',true);return;}setCreating(true)};
 const viewProfile=(user:Profile)=>{setProfileTarget(user);setScreen('profile');setSelected(null);window.scrollTo({top:0,behavior:'smooth'})};
 const logout=async()=>{try{await backend.logout();setViewer(null);show('explore');notify('Sesión cerrada.')}catch(e){notify(e instanceof Error?e.message:'Error',true)}};
 const myListings=items.filter(l=>l.owner_id===viewer?.id),totalActive=items.filter(isLive).length;
 return <><header className="site-header"><div className="nav-container"><button className="logo" onClick={()=>show('explore')} aria-label="ScoutRifas CHN inicio"><span className="logo-mark"><Fleur size={29}/></span><span className="logo-name">SCOUT<span>RIFAS</span><small>CHIHUAHUA NORTE</small></span></button>
 <nav className={menu?'nav-links open':'nav-links'}><button className={screen==='explore'?'nav-active':''} onClick={()=>show('explore')}>Explorar</button><button onClick={()=>show('mine')} className={screen==='mine'?'nav-active':''}>Mis publicaciones</button><button onClick={()=>show('activity')} className={screen==='activity'?'nav-active':''}>Mi actividad</button>{viewer?.role==='admin'&&<button onClick={()=>show('admin')} className={screen==='admin'?'nav-active':''}>Administración</button>}</nav>
 <div className="nav-right"><button onClick={openCreate} className="create-nav"><Plus size={18}/> Publicar</button>{viewer?<button onClick={()=>viewProfile(viewer)} className="account"><Avatar user={viewer} size={34}/><span>{viewer.display_name.split(' ')[0]}</span><ChevronDown size={15}/></button>:<button className="sign-in" onClick={()=>setAuth('login')}><LogIn size={17}/> Iniciar sesión</button>}
 <button className="menu-button" onClick={()=>setMenu(!menu)} aria-label="Abrir menú"><Menu size={24}/></button></div></div></header>
 {!cloud&&<div className="demo-banner"><span><Sparkles size={14}/> Vista de demostración: los cambios se guardan solo en este navegador. Para operar entre usuarios configura Supabase.</span></div>}
 <main>{screen==='explore'?<>
 <div className="hero-shell"><section className="hero"><div className="hero-photo" style={{backgroundImage:`linear-gradient(90deg, rgba(33,23,44,.89) 0%, rgba(33,23,44,.62) 49%, rgba(33,23,44,.18) 100%),url('${sampleHero}')`}}/>
 <div className="hero-content"><span className="hero-label"><span className="hero-star">✦</span> PROVINCIA CHIHUAHUA NORTE</span><h1>Compartir también<br/>es una <em>aventura.</em></h1><p>Descubre rifas, participa en tu comunidad y encuentra cosas increíbles. Cada pequeña acción nos acerca más.</p><div className="hero-actions"><button className="hero-primary" onClick={()=>document.getElementById('explorar')?.scrollIntoView({behavior:'smooth'})}>Explorar rifas <ArrowRight size={18}/></button><button className="hero-secondary" onClick={openCreate}><Plus size={18}/> Compartir algo</button></div></div>
 <div className="hero-stamp"><Fleur size={27}/><span>SIEMPRE<br/>LISTOS</span></div></section></div>
 <section className="intro-strip"><div><div className="strip-icon"><Compass size={24}/></div><div><b>Comunidad primero</b><span>Experiencias que nos unen</span></div></div><div><div className="strip-icon"><ShieldCheck size={24}/></div><div><b>Miembros verificados</b><span>IDs scout revisados</span></div></div><div><div className="strip-icon"><Heart size={24}/></div><div><b>Sin cobros en línea</b><span>Participación transparente</span></div></div></section>
 <section id="explorar" className="explore-section"><div className="section-title"><div><span className="kicker">DESCUBRE ALGO ESPECIAL</span><h2>La aventura te espera <span>✦</span></h2><p>Explora lo que nuestra comunidad tiene para compartir.</p></div><div className="headline-stat"><b>{totalActive}</b><span>actividades abiertas</span></div></div>
 <div className="filter-wrap"><div className="category-tabs"><button className={kind==='all'?'active':''} onClick={()=>setKind('all')}>✦ Todas</button><button className={kind==='raffle'?'active':''} onClick={()=>setKind('raffle')}><Ticket size={16}/> Rifas gratuitas</button><button className={kind==='auction'?'active':''} onClick={()=>setKind('auction')}><TrendingUp size={16}/> Subastas</button></div><div className="filter-controls"><label className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar aventuras, premios…" aria-label="Buscar rifas"/></label><select aria-label="Filtrar categoría" value={category} onChange={e=>setCategory(e.target.value)}><option>Todas</option>{categories.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Ordenar resultados" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Más recientes</option><option value="ending">Próximas a cerrar</option><option value="popular">Más populares</option></select></div></div>
 {loading?<div className="empty"><Compass className="spin" size={38}/> Buscando aventuras...</div>:filtered.length?<div className="cards-grid">{filtered.map(l=><Card key={l.id} item={l} onOpen={()=>setSelected(l)}/>)}</div>:<div className="empty"><Compass size={42}/><h3>No encontramos publicaciones</h3><p>Prueba otra búsqueda o vuelve más tarde.</p><button className="secondary" onClick={()=>{setQuery('');setCategory('Todas');setKind('all')}}>Quitar filtros</button></div>}
 </section><section className="cta-panel"><div className="cta-ornament"><Fleur size={85}/></div><div><span className="kicker light">TU SIGUIENTE BUENA ACCIÓN</span><h2>¿Tienes algo que compartir?</h2><p>Publica una rifa gratuita o una subasta comunitaria. Una gran aventura puede empezar con un pequeño gesto.</p></div><button onClick={openCreate} className="cta-button">Crear publicación <ArrowRight size={19}/></button></section>
 </>:screen==='mine'?<section className="inner-page"><div className="section-title"><div><span className="kicker">TU RINCÓN SCOUT</span><h2>Mis publicaciones</h2><p>Organiza las experiencias y premios que has compartido.</p></div><button className="primary" onClick={openCreate}><Plus size={17}/> Nueva publicación</button></div>{myListings.length?<div className="cards-grid">{myListings.map(l=><Card key={l.id} item={l} onOpen={()=>setSelected(l)}/>)}</div>:<div className="empty"><Ticket size={38}/><h3>Tu primera publicación te está esperando</h3><p>Comparte algo con los miembros de Chihuahua Norte.</p><button className="primary" onClick={openCreate}><Plus size={18}/> Crear publicación</button></div>}</section>
 :screen==='activity'?<section className="inner-page"><div className="section-title"><div><span className="kicker">TUS EXPERIENCIAS</span><h2>Mi actividad</h2><p>Consulta las rifas en las que participas y tus propuestas.</p></div><BarChart3 className="page-icon" size={40}/></div>
 <div className="activity-grid"><div className="activity-block"><h3><Ticket size={20}/> Mis participaciones <span>{activities.entries.length}</span></h3>{activities.entries.length?activities.entries.map(a=>{const l=items.find(x=>x.id===a.listing_id);return <button className="activity-row" key={a.id} onClick={()=>l&&setSelected(l)}><b>{l?.title||'Rifa archivada'}</b><small>{new Date(a.joined_at||'').toLocaleDateString('es-MX')}</small><ArrowRight size={16}/></button>}):<p className="empty-small">Todavía no participas en ninguna rifa.</p>}</div><div className="activity-block"><h3><TrendingUp size={20}/> Mis pujas <span>{activities.bids.length}</span></h3>{activities.bids.length?activities.bids.map(a=>{const l=items.find(x=>x.id===a.listing_id);return <button className="activity-row" key={a.id} onClick={()=>l&&setSelected(l)}><b>{l?.title||'Subasta archivada'}</b><small>{money(a.amount||0)}</small><ArrowRight size={16}/></button>}):<p className="empty-small">Aún no has registrado propuestas.</p>}</div></div></section>
 :screen==='profile'?(profileTarget||viewer)&&<div className="inner-page profile-container"><button className="back-link" onClick={()=>show('explore')}><ArrowLeft size={17}/> Volver a explorar</button><ProfilePage person={viewer&&profileTarget?.id===viewer.id?viewer:(profileTarget||viewer)!} current={viewer?.id===(profileTarget||viewer)?.id} onSave={refreshUser} notify={notify} listings={items.filter(l=>l.owner_id===(profileTarget||viewer)?.id&&(l.status==='active'||l.status==='finished'||viewer?.id===l.owner_id))} onOpen={setSelected}/>{viewer?.id===(profileTarget||viewer)?.id&&<button className="text-logout" onClick={logout}><LogOut size={16}/> Cerrar sesión</button>}</div>
 :screen==='admin'&&viewer?.role==='admin'?<div className="inner-page"><Admin items={items} refresh={refresh} notify={notify}/></div>:null}
 </main>
 <footer className="footer"><div className="footer-top"><div className="footer-brand"><div className="logo-mark"><Fleur size={27}/></div><div><b>SCOUTRIFAS <span>CHN</span></b><p>Una comunidad que comparte, explora y crece.</p></div></div><div className="footer-links"><button onClick={()=>show('explore')}>Explorar</button><button onClick={()=>show('mine')}>Mis publicaciones</button><button onClick={openCreate}>Crear rifa</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ScoutRifas CHN · Proyecto comunitario.</span><span>Sin pagos en la plataforma · No es un sitio oficial de ASMAC salvo autorización expresa.</span></div></footer>
 {toast&&<div className={`toast ${toast.error?'error':''}`} role="status">{toast.error?<Flag size={18}/>:<CheckCircle2 size={18}/>} {toast.text}<button onClick={()=>setToast(null)} aria-label="Cerrar mensaje"><X size={16}/></button></div>}
 {auth&&<Modal onClose={()=>setAuth(null)}><Authentication mode={auth} setMode={setAuth} onClose={()=>setAuth(null)} onSuccess={refreshUser} notify={notify}/></Modal>}
 {creating&&viewer&&<Modal width="680px" onClose={()=>setCreating(false)}><CreateListing user={viewer} onClose={()=>setCreating(false)} done={refresh} notify={notify}/></Modal>}
 {selected&&<Modal width="880px" onClose={()=>setSelected(null)}><Detail item={selected} user={viewer} onClose={()=>setSelected(null)} onLogin={()=>setAuth('signup')} refresh={refresh} notify={notify} onProfile={viewProfile}/></Modal>}
 </>;
}
