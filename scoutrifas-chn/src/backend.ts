import {createClient} from '@supabase/supabase-js';
import type {AccessRequest,Cause,CauseAcknowledgment,CauseDraft,MemberType,Profile,RecipientOption,SupportIntent} from './types';
import {canViewCatalogue,isScoutId} from './types';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud=Boolean(url&&key&&!url.includes('tu-proyecto'));
export const demoEnabled=false;
export function friendlyError(error:unknown):string {
 const e=error as {code?:string;status?:number;message?:string}|null;
 const message=e?.message||'';
 if(/Database error saving new user/i.test(message))return 'La cuenta aún no tiene una solicitud de acceso aprobada o sus datos no coinciden. Solicita acceso primero.';
 if(e?.code==='23505')return 'Este ID scout ya está asociado a una cuenta. Revisa tus datos o solicita ayuda a administración.';
 if(e?.code==='42501'||e?.status===401||/permission denied|jwt expired|invalid jwt/i.test(message))return 'Tu sesión no autorizó esta operación. Cierra sesión y vuelve a iniciarla antes de reintentar.';
 if(/fetch|network|Failed to fetch/i.test(message))return 'No se pudo conectar con el servidor. Revisa tu internet y vuelve a intentarlo.';
 return message||'Ocurrió un error inesperado. Inténtalo nuevamente.';
}

export const supabase=cloud?createClient(url,key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}):null;
const signedPhotos=new Map<string,{url:string,until:number}>();

async function authorizeCausePhotos(list:readonly {image_paths:string[]}[]) {
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
   if(!r.data.session?.access_token)throw new Error('La sesión no quedó activa. Confirma tu correo e inténtalo nuevamente.');
 },
 async sendPasswordReset(email:string):Promise<void>{
  const s=requireCloud();
  if(!email.trim()||!email.includes('@'))throw new Error('Escribe tu correo antes de recuperar tu contraseña.');
  const r=await s.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});
  if(r.error)throw r.error;
 },
 async changePassword(password:string):Promise<void>{
  const s=requireCloud();
  if(password.length<10)throw new Error('Usa una contraseña de al menos 10 caracteres.');
  const r=await s.auth.updateUser({password});if(r.error)throw r.error;
 },
 async logout(){
  signedPhotos.clear();
  const r=await requireCloud().auth.signOut();if(r.error)throw r.error;
 },
 async requestAccess(info:{email:string;name:string;kind:MemberType;scoutId:string;group:string;referral:string;adult:boolean;website:string}):Promise<void>{
  const r=await requireCloud().rpc('chn_request_access',{
   p_email:info.email.trim(),p_name:info.name.trim(),p_kind:info.kind,
   p_scout_id:info.kind==='scout'?info.scoutId:'',
   p_group:info.kind==='scout'?info.group.trim():'',
   p_referral:info.kind==='supporter'?info.referral.trim():'',
   p_adult:info.adult,p_website:info.website
  });
  if(r.error)throw r.error;
 },
 async accessRequests():Promise<AccessRequest[]>{
  const r=await requireCloud().from('chn_access_requests').select('*').order('created_at',{ascending:false}).limit(1000);
  if(r.error)throw r.error;
  return (r.data||[]) as AccessRequest[];
 },
 async reviewAccess(id:string,approve:boolean):Promise<void>{
  const r=await requireCloud().rpc('chn_review_access',{p_id:id,p_approved:approve});
  if(r.error)throw r.error;
 },
 async enrollExisting():Promise<void>{
  const s=requireCloud();
  const {data:{user},error}=await s.auth.getUser();
  if(error||!user||!user.email_confirmed_at)throw new Error('Debes confirmar tu correo antes de activar tu acceso.');
  const r=await s.rpc('chn_claim_approved_access');
  if(r.error)throw r.error;
 },
 async attestAdult():Promise<void>{
  const s=requireCloud();
  const {data:{user},error}=await s.auth.getUser();
  if(error||!user)throw new Error('Inicia sesión de nuevo para actualizar tus datos.');
  const r=await s.from('chn_profiles').update({adult_attested:true}).eq('id',user.id);
  if(r.error)throw r.error;
 },
 async listCauses():Promise<Cause[]>{
  const s=requireCloud();
  const person=await backend.session();
  if(!canViewCatalogue(person))return [];
  const r=await s.from('chn_causes').select('*, owner:chn_profiles!chn_causes_owner_id_fkey(*)')
    .order('created_at',{ascending:false}).limit(250);
  if(r.error)throw r.error;
  const list=(r.data||[]) as Cause[];
  await authorizeCausePhotos(list);
  return list;
 },
 async createCause(d:CauseDraft,images:string[]):Promise<string>{
  if(images.length<1||images.length>10)throw new Error('Agrega entre 1 y 10 fotos.');
  const r=await requireCloud().rpc('chn_create_cause_v2',{
   p_title:d.title,p_description:d.description,p_category:d.category,
   p_end_at:d.endAt,p_amount:d.amount,p_target:d.target,p_limit:d.maxIntentions,p_images:images
  });
  if(r.error)throw r.error;return String(r.data);
 },
 async reviewCause(id:string,action:'active'|'paused'|'cancelled'):Promise<void>{
  const r=await requireCloud().rpc('chn_review_cause',{p_cause:id,p_action:action});
  if(r.error)throw r.error;
 },
 async availableRecipients():Promise<RecipientOption[]>{
  const r=await requireCloud().rpc('chn_cause_recipients');
  if(r.error)throw r.error;return (r.data||[]) as RecipientOption[];
 },
 async registerCauseIntent(id:string,recipientId:string,note:string):Promise<CauseAcknowledgment>{
  const r=await requireCloud().rpc('chn_submit_cause_intent_v2',{p_cause:id,p_recipient:recipientId,p_note:note});
  if(r.error)throw r.error;
  const record=Array.isArray(r.data)?r.data[0]:r.data;
  if(!record||typeof record.ack_no!=='number')throw new Error('No llegó el folio de confirmación.');
  return record as CauseAcknowledgment;
 },
 async reviewCauseIntent(id:string,approve:boolean):Promise<void>{
  const r=await requireCloud().rpc('chn_review_cause_intent',{p_intent:id,p_approve:approve});
  if(r.error)throw r.error;
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
 async removeUploaded(paths:string[],folder:'avatars'|'listings'):Promise<void>{
  if(!paths.length)return;
  const r=await requireCloud().storage.from(folder==='avatars'?'chn-avatars':'chn-listings').remove(paths);
  if(r.error)throw r.error;
 },
 async supportIntents(userId?:string):Promise<SupportIntent[]>{
  let query=requireCloud().from('chn_support_pledges').select('*').order('created_at',{ascending:false}).limit(1000);
  if(userId)query=query.eq('user_id',userId);
  const r=await query;if(r.error)throw r.error;
  return (r.data||[]) as SupportIntent[];
 },
 async members():Promise<Profile[]>{
  const r=await requireCloud().from('chn_profiles').select('*').order('created_at',{ascending:false}).limit(1000);
  if(r.error)throw r.error;return (r.data||[]) as Profile[];
 },
 async reviewUser(id:string,verified:boolean){
  const r=await requireCloud().rpc('chn_review_user',{p_user:id,p_verified:verified});
  if(r.error)throw r.error;
 },

};
