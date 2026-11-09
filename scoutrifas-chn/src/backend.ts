import {createClient} from '@supabase/supabase-js';
import type {AdminReport,Draft,Listing,MemberType,Profile,TicketNumber,TicketOrder} from './types';
import {canPublish,canRequestTickets,canViewCatalogue,isScoutId,salesReady} from './types';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud=Boolean(url&&key&&!url.includes('tu-proyecto'));
export const demoEnabled=false;
export const supabase=cloud?createClient(url,key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}):null;
const signedPhotos=new Map<string,{url:string,until:number}>();

async function authorizeListingPhotos(list:Listing[]) {
 if(!supabase)return;
 const now=Date.now();
 const paths=[...new Set(list.flatMap(l=>l.image_paths).filter(p=>p.includes('/listings/')))]
  .filter(p=>(signedPhotos.get(p)?.until||0)<now+60000);
 await Promise.all(paths.map(async p=>{
  const {data,error}=await supabase!.storage.from('chn-listings').createSignedUrl(p,600);
  if(error)throw error;
  signedPhotos.set(p,{url:data.signedUrl,until:Date.now()+600000});
 }));
}
export function imageUrl(path:string|null|undefined):string {
 if(!path||!supabase)return '';
 if(path.includes('/listings/'))return signedPhotos.get(path)?.url||'';
 if(path.startsWith('https://'))return '';
 return supabase.storage.from('chn-avatars').getPublicUrl(path).data.publicUrl;
}
function requireCloud(){
 if(!supabase)throw new Error('Servicio temporalmente no disponible.');
 return supabase;
}
export const backend={
 async session():Promise<Profile|null>{
  if(!supabase)return null;
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user)return null;
  const r=await supabase.from('chn_profiles').select('*').eq('id',user.id).maybeSingle();
  if(r.error)throw r.error;
  return (r.data||null) as Profile|null;
 },
 async isSignedIn():Promise<boolean>{
  if(!supabase)return false;
  const {data:{user},error}=await supabase.auth.getUser();
  if(error)throw error;return Boolean(user);
 },
 async signup(email:string,password:string,name:string,kind:MemberType,scoutId:string,group:string,adult:boolean,referral:string):Promise<boolean>{
  if(kind==='supporter'&&!adult)throw new Error('El registro de simpatizantes es para mayores de edad.');
  if(kind==='scout'&&!isScoutId(scoutId))throw new Error('Introduce un ID scout válido.');
  const s=requireCloud();
  const r=await s.auth.signUp({email,password,options:{
   data:{display_name:name,scout_id:kind==='scout'?scoutId:'',group_name:group,
    chn_member_type:kind,chn_adult:String(adult),chn_referral:referral},
   emailRedirectTo:window.location.origin
  }});
  if(r.error)throw r.error;return Boolean(r.data.session);
 },
 async login(email:string,password:string){
  const r=await requireCloud().auth.signInWithPassword({email,password});if(r.error)throw r.error;
 },
 async logout(){
  signedPhotos.clear();
  const r=await requireCloud().auth.signOut();if(r.error)throw r.error;
 },
 async enrollExisting(kind:MemberType,scoutId:string,name:string,group:string,adult:boolean,referral:string){
  const s=requireCloud();
  if(kind==='supporter'){
   if(!adult)throw new Error('Se requiere mayoría de edad.');
   const r=await s.rpc('chn_register_supporter',{p_name:name,p_referral:referral,p_adult:true});
   if(r.error)throw r.error;
  }else{
   const r=await s.rpc('chn_register_member',{p_scout_id:scoutId,p_display_name:name,p_group_name:group});
   if(r.error)throw r.error;
   if(adult)await backend.attestAdult();
  }
 },
 async attestAdult(){
  const r=await requireCloud().rpc('chn_attest_adult');if(r.error)throw r.error;
 },
 async list():Promise<Listing[]>{
  const s=requireCloud();
  const person=await backend.session();
  if(!canViewCatalogue(person))return [];
  const r=await s.from('chn_listings').select('*, owner:chn_profiles!chn_listings_owner_id_fkey(*)')
   .order('created_at',{ascending:false}).limit(250);
  if(r.error)throw r.error;
  const list=(r.data||[]) as Listing[];
  await authorizeListingPhotos(list);
  return list;
 },
 async updateProfile(id:string,changes:Partial<Pick<Profile,'display_name'|'group_name'|'bio'|'avatar_path'>>){
  const r=await requireCloud().from('chn_profiles').update(changes).eq('id',id);
  if(r.error)throw r.error;
 },
 async upload(file:File,userId:string,folder:'avatars'|'listings'):Promise<string>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Solo JPG, PNG o WebP.');
  if(file.size>5*1024*1024)throw new Error('Máximo 5 MB por fotografía.');
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path=userId+'/'+folder+'/'+crypto.randomUUID()+'.'+ext;
  const r=await requireCloud().storage.from(folder==='avatars'?'chn-avatars':'chn-listings')
   .upload(path,file,{contentType:file.type,upsert:false});
  if(r.error)throw r.error;return path;
 },
 async create(d:Draft,user:Profile,images:string[]){
  if(!canPublish(user))throw new Error('Publicaciones disponibles únicamente para organizadores aprobados.');
  if(images.length<1||images.length>4)throw new Error('Agrega de 1 a 4 fotografías.');
  const r=await requireCloud().from('chn_listings').insert({
    owner_id:user.id,title:d.title,description:d.description,
    type:'raffle',category:d.category,image_paths:images,
    end_at:d.end_at,ticket_price:d.ticket_price,max_entries:d.max_entries,max_per_user:d.max_per_user,
    min_bid:0,bid_step:10
  });
  if(r.error)throw r.error;
 },
 async requestTickets(l:Listing,user:Profile,quantity:number):Promise<string>{
  if(!canRequestTickets(user))throw new Error('La cuenta no está habilitada para solicitar boletos.');
  if(!salesReady(l))throw new Error('Esta rifa todavía no recibe solicitudes.');
  if(!Number.isInteger(quantity)||quantity<1||quantity>10)throw new Error('Cantidad inválida.');
  const r=await requireCloud().rpc('chn_request_tickets',{p_listing:l.id,p_quantity:quantity});
  if(r.error)throw r.error;return String(r.data||'');
 },
 async orders(userId?:string):Promise<TicketOrder[]>{
  const s=requireCloud();
  let q=s.from('chn_ticket_orders').select('*').order('created_at',{ascending:false}).limit(1000);
  if(userId)q=q.eq('user_id',userId);
  const r=await q;if(r.error)throw r.error;return (r.data||[]) as TicketOrder[];
 },
 async tickets(userId?:string):Promise<TicketNumber[]>{
  const s=requireCloud();
  let q=s.from('chn_ticket_numbers').select('*').order('issued_at',{ascending:false}).limit(1000);
  if(userId)q=q.eq('user_id',userId);
  const r=await q;if(r.error)throw r.error;return (r.data||[]) as TicketNumber[];
 },
 async adminOverview():Promise<AdminReport>{
  const s=requireCloud();
  const [orders,tickets,totalOrders,totalTickets]=await Promise.all([
   backend.orders(),backend.tickets(),
   s.from('chn_ticket_orders').select('id',{count:'exact',head:true}),
   s.from('chn_ticket_numbers').select('id',{count:'exact',head:true})
  ]);
  if(totalOrders.error)throw totalOrders.error;
  if(totalTickets.error)throw totalTickets.error;
  return {orders,tickets,confirmed:orders.filter(o=>o.status==='confirmed').length,
   pending:orders.filter(o=>o.status==='pending'&&new Date(o.expires_at)>new Date()).length,
   totalTickets:totalTickets.count||0};
 },
 async members():Promise<Profile[]>{
  const r=await requireCloud().from('chn_profiles').select('*').order('created_at',{ascending:false}).limit(1000);
  if(r.error)throw r.error;return (r.data||[]) as Profile[];
 },
 async reviewUser(id:string,verified:boolean){
  const r=await requireCloud().rpc('chn_review_user',{p_user:id,p_verified:verified});
  if(r.error)throw r.error;
 },
 async reviewListing(id:string,action:'active'|'paused'|'cancelled'){
  const r=await requireCloud().rpc('chn_review_listing',{p_listing:id,p_action:action});
  if(r.error)throw r.error;
 },
 async reviewOrder(id:string,action:'confirmed'|'cancelled'){
  const r=await requireCloud().rpc('chn_review_ticket_order',{p_order:id,p_action:action});
  if(r.error)throw r.error;
 },
 async recordDraw(listingId:string,ticketNo:number,reference:string){
  const r=await requireCloud().rpc('chn_record_ticket_draw',{p_listing:listingId,p_ticket_no:ticketNo,p_draw_reference:reference});
  if(r.error)throw r.error;
 }
};
