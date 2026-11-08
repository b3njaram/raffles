import {createClient} from '@supabase/supabase-js';
import type {Activity,Draft,Listing,Profile} from './types';
import {canViewCatalogue,isLive,minimumBid} from './types';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud = Boolean(url && key && !url.includes('tu-proyecto') && !key.includes('xxxxxxxx'));
// Datos de ejemplo solo con activación explícita en entorno local. Producción falla cerrado.
export const demoEnabled = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true' && !cloud;
export const supabase = cloud ? createClient(url,key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}) : null;
const samplePhotos = [
 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=1000&q=85',
 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=1000&q=85',
 'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1000&q=85',
 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=1000&q=85',
 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1000&q=85',
 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1000&q=85'
];
const sampleOwners: Profile[] = [
 {id:'demo-scout-1',scout_id:'CHN-1024',display_name:'Andrea M.',group_name:'Grupo 12 · Juárez',bio:'Explorar, servir y compartir.',avatar_path:null,role:'member',verified:true,created_at:'2026-09-01'},
 {id:'demo-scout-2',scout_id:'CHN-2048',display_name:'Santiago R.',group_name:'Grupo 8 · Juárez',bio:'Cada día una aventura.',avatar_path:null,role:'member',verified:true,created_at:'2026-09-02'},
 {id:'demo-scout-3',scout_id:'CHN-4096',display_name:'Valeria G.',group_name:'Grupo 18 · Juárez',bio:'Siempre lista para servir.',avatar_path:null,role:'member',verified:true,created_at:'2026-09-05'}
];
const days=(d:number)=>new Date(Date.now()+d*86400000).toISOString();
const sampleSpecs=[
 ['Una noche bajo las estrellas','Una experiencia de campamento con equipo compartido para disfrutar del cielo y la naturaleza. Incluye detalles de la actividad y acompañamiento de adultos responsables.','raffle','Experiencias',2,0,0,42,100,0],
 ['Mochila de explorador 45L','Mochila resistente ideal para caminatas, campamentos y nuevas rutas. En excelentes condiciones, lista para su siguiente aventura.','auction','Equipo',4,250,25,0,0,6],
 ['Kit esencial de campamento','Un kit de aventura con linterna, brújula y accesorios útiles para tu próximo campamento. Disponible en rifa comunitaria sin costo.','raffle','Aventura',6,0,0,68,120,0],
 ['Insignias scout de colección','Colección de parches e insignias conmemorativas para quienes disfrutan intercambiar recuerdos y aprender historias.','auction','Coleccionables',1,150,25,0,0,12],
 ['Experiencia de senderismo guiado','Recorrido guiado y seguro para conocer rutas de la región, aprender orientación y convivir con la comunidad.','raffle','Experiencias',8,0,0,27,80,0],
 ['Arte hecho en campamento','Ilustración de montañas realizada en actividades scout, ideal para decorar tu rincón de aventuras.','auction','Arte',3,120,20,0,0,4],
] as const;
const seedListings: Listing[] = sampleSpecs.map((row,i)=>({
 id:`sample-${i}`,owner_id:sampleOwners[i%3].id,owner:sampleOwners[i%3],
 title:row[0],description:row[1],type:row[2],category:row[3],
 image_paths:[samplePhotos[i]],status:'active',end_at:days(row[4]),
 min_bid:row[5],bid_step:row[6]||20,entry_count:row[7],max_entries:row[8]||100,
 max_per_user:1,bid_count:row[9],current_bid:row[9]?row[5]+row[6]*row[9]:0,
 winner_id:null,created_at:days(-i-2)
}));
interface DemoState { user:Profile|null; listings:Listing[]; entries:Activity[]; bids:Activity[]; }
const localKey='scoutrifas-v1-demo';
const loadDemo=():DemoState=>{
  try { const stored=JSON.parse(localStorage.getItem(localKey)||'null') as DemoState|null;
    if(stored?.listings && Array.isArray(stored.listings)) return stored;
  } catch { /* use fresh seed */ }
  return {user:null,listings:seedListings,entries:[],bids:[]};
};
let demo:DemoState|null=null;
const state=()=>demo??(demo=loadDemo());
const save=()=>localStorage.setItem(localKey,JSON.stringify(state()));
// En producción los objetos del catálogo son privados; no se exponen enlaces públicos.
const signedListingImages=new Map<string,{url:string;expires:number}>();
const privateListingPhoto=(path:string)=>path.includes('/listings/');
async function authorizeListingPhotos(list:Listing[]){
 if(!supabase)return;
 const now=Date.now();
 const paths=[...new Set(list.flatMap(l=>l.image_paths).filter(privateListingPhoto))]
  .filter(path=>(signedListingImages.get(path)?.expires||0)<now+60_000);
 if(!paths.length)return;
 await Promise.all(paths.map(async path=>{
  const {data,error}=await supabase!.storage.from('scout-listings').createSignedUrl(path,600);
  if(error)throw error;
  signedListingImages.set(path,{url:data.signedUrl,expires:Date.now()+600_000});
 }));
}
export const imageUrl=(path:string|null|undefined)=>{
 if(!path)return '';
 if((/^https:\/\//.test(path)||/^data:image\/(png|jpeg|webp);base64,/.test(path))&&demoEnabled)return path;
 if(!supabase)return '';
 if(privateListingPhoto(path))return signedListingImages.get(path)?.url||'';
 return supabase.storage.from('scout-photos').getPublicUrl(path).data.publicUrl;
};
export const backend={
  async session():Promise<Profile|null> {
    if(!supabase) return demoEnabled ? state().user : null;
    const {data:{user},error}=await supabase.auth.getUser();
    if(error || !user) return null;
    const r=await supabase.from('profiles').select('*').eq('id',user.id).single();
    if(r.error) throw r.error; return r.data as Profile;
  },
  async list():Promise<Listing[]> {
    if(!supabase)return canViewCatalogue(state().user) ? [...state().listings] : [];
    // Comprobación redundante: Supabase RLS es la barrera de seguridad definitiva.
    const member=await backend.session();
    if(!canViewCatalogue(member))return [];
    const r=await supabase.from('listings').select('*, owner:profiles!listings_owner_id_fkey(*)').order('created_at',{ascending:false}).limit(150);
    if(r.error)throw r.error;
    const listings=r.data as Listing[];
    await authorizeListingPhotos(listings);
    return listings;
  },
  async signup(email:string,password:string,name:string,scoutId:string,group:string):Promise<boolean> {
    if(!supabase){
      if(!demoEnabled)throw new Error('El registro todavía no está disponible.');
      const user:Profile={id:`demo-${crypto.randomUUID()}`,display_name:name,scout_id:scoutId,group_name:group,bio:'',avatar_path:null,role:'member',verified:true,created_at:new Date().toISOString()};
      state().user=user;save();return true;
    }
    const r=await supabase.auth.signUp({email,password,options:{data:{display_name:name,scout_id:scoutId,group_name:group},emailRedirectTo:window.location.origin}});
    if(r.error) throw r.error;
    return Boolean(r.data.session);
  },
  async login(email:string,password:string){
    if(!supabase) throw new Error('El acceso todavía no está disponible.');
    const r=await supabase.auth.signInWithPassword({email,password});if(r.error) throw r.error;
  },
  async logout(){signedListingImages.clear();if(!supabase){if(demoEnabled){state().user=null;save();}return;} const r=await supabase.auth.signOut();if(r.error)throw r.error;},
  async updateProfile(id:string, updates:Partial<Pick<Profile,'display_name'|'group_name'|'bio'|'avatar_path'>>){
    if(!supabase){if(!demoEnabled)throw new Error('Servicio no disponible.');const s=state();if(!s.user||s.user.id!==id)throw new Error('Sesión inválida');s.user={...s.user,...updates};save();return;}
    const r=await supabase.from('profiles').update(updates).eq('id',id);if(r.error)throw r.error;
  },
  async upload(file:File,userId:string,folder:'avatars'|'listings'){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Solo JPG, PNG o WebP.');
    if(file.size>5*1024*1024)throw new Error('Máximo 5 MB por imagen.');
    if(!supabase){if(!demoEnabled)throw new Error('Servicio no disponible.');return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('No se pudo leer la foto.'));reader.readAsDataURL(file);});}
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=`${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
    const bucket=folder==='listings'?'scout-listings':'scout-photos';
    const r=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
    if(r.error)throw r.error;return path;
  },
  async create(d:Draft,user:Profile,images:string[]){
    if(!user.verified)throw new Error('Tu ID CHN debe ser aprobado por administración.');
    if(!supabase){
      if(!demoEnabled)throw new Error('Servicio no disponible.');
      const l:Listing={id:`demo-${crypto.randomUUID()}`,owner_id:user.id,owner:user,...d,
        image_paths:images,status:'pending',current_bid:0,bid_count:0,entry_count:0,winner_id:null,created_at:new Date().toISOString(),
        min_bid:d.type==='raffle'?0:d.min_bid};
      state().listings.unshift(l);save();return;
    }
    const r=await supabase.from('listings').insert({owner_id:user.id,...d,
      min_bid:d.type==='raffle'?0:d.min_bid,image_paths:images});if(r.error)throw r.error;
  },
  async join(l:Listing,user:Profile){
    if(!user.verified)throw new Error('Tu ID CHN requiere validación.');
    if(!isLive(l))throw new Error('La rifa no está activa.');
    if(user.id===l.owner_id)throw new Error('No puedes participar en tu propia rifa.');
    if(!supabase){
      if(!demoEnabled)throw new Error('Servicio no disponible.');
      const s=state();const count=s.entries.filter(x=>x.listing_id===l.id&&x.user_id===user.id).length;
      if(count>=l.max_per_user||l.entry_count>=l.max_entries)throw new Error('Límite de participaciones alcanzado.');
      s.entries.push({id:crypto.randomUUID(),listing_id:l.id,user_id:user.id,joined_at:new Date().toISOString()});
      s.listings=s.listings.map(x=>x.id===l.id?{...x,entry_count:x.entry_count+1}:x);save();return;
    }
    const r=await supabase.rpc('join_raffle',{p_listing:l.id});if(r.error)throw r.error;
  },
  async bid(l:Listing,user:Profile,amount:number){
    if(!user.verified)throw new Error('Tu ID CHN requiere validación.');
    if(!isLive(l)||l.type!=='auction')throw new Error('La subasta no está activa.');
    if(user.id===l.owner_id)throw new Error('No puedes pujar en tu propia subasta.');
    if(!Number.isInteger(amount)||amount<minimumBid(l))throw new Error(`Puja mínima: ${minimumBid(l)} MXN.`);
    if(!supabase){
      if(!demoEnabled)throw new Error('Servicio no disponible.');
      const s=state();const idx=s.listings.findIndex(x=>x.id===l.id);
      const live=s.listings[idx];if(!live||amount<minimumBid(live))throw new Error('La puja ha cambiado.');
      s.bids.push({id:crypto.randomUUID(),listing_id:l.id,user_id:user.id,amount,created_at:new Date().toISOString()});
      s.listings[idx]={...live,current_bid:amount,bid_count:live.bid_count+1};save();return;
    }
    const r=await supabase.rpc('place_bid',{p_listing:l.id,p_amount:amount});if(r.error)throw r.error;
  },
  async activity(userId:string):Promise<{entries:Activity[];bids:Activity[]}>{
    if(!supabase)return {entries:(demoEnabled?state().entries:[]).filter(x=>x.user_id===userId),bids:(demoEnabled?state().bids:[]).filter(x=>x.user_id===userId)};
    const [e,b]=await Promise.all([
      supabase.from('raffle_entries').select('*').eq('user_id',userId).order('joined_at',{ascending:false}),
      supabase.from('bids').select('*').eq('user_id',userId).order('created_at',{ascending:false})
    ]);if(e.error)throw e.error;if(b.error)throw b.error;
    return {entries:e.data as Activity[],bids:b.data as Activity[]};
  },
  async members(){if(!supabase)return demoEnabled?[state().user,...sampleOwners].filter(Boolean) as Profile[]:[];
    const r=await supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(300);if(r.error)throw r.error;return r.data as Profile[];
  },
  async reviewUser(userId:string,verified:boolean){if(!supabase)throw new Error('Administración solo disponible con Supabase.');
    const r=await supabase.rpc('review_user',{p_user:userId,p_verified:verified});if(r.error)throw r.error;
  },
  async reviewListing(listingId:string,action:'active'|'paused'|'cancelled'){
    if(!supabase)throw new Error('Administración solo disponible con Supabase.');
    const r=await supabase.rpc('review_listing',{p_listing:listingId,p_action:action});if(r.error)throw r.error;
  },
  async finish(listingId:string){if(!supabase)throw new Error('Administración solo disponible con Supabase.');
    const r=await supabase.rpc('finish_listing',{p_listing:listingId});if(r.error)throw r.error;
  }
};
