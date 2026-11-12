export type Currency='MXN'|'USD';
export type Category='Aventura'|'Equipo'|'Coleccionables'|'Experiencias'|'Arte'|'Otros';
export type MemberType='scout'|'supporter';
export type CauseStatus='pending'|'active'|'paused'|'finished'|'cancelled';
export const categories:Category[]=['Aventura','Equipo','Coleccionables','Experiencias','Arte','Otros'];
export interface Profile {
 id:string;scout_id:string|null;display_name:string;group_name:string;bio:string;avatar_path:string|null;
 role:'member'|'admin';verified:boolean;created_at:string;
 member_type:MemberType;adult_attested:boolean;referral_note?:string;
}
export interface Cause {
 id:string;owner_id:string;owner?:Profile;title:string;description:string;category:Category;
 image_paths:string[];fixed_support_amount:number;fixed_support_amount_usd:number|null;target_amount:number;target_amount_usd:number;intention_total_usd:number;end_at:string;
 status:CauseStatus;intention_count:number;intention_total:number;max_intentions:number;created_at:string;
}
export interface CauseDraft {
 title:string;description:string;category:Category;endAt:string;amount:number;amountUsd:number;target:number;targetUsd:number;maxIntentions:number;
}
export interface CauseAcknowledgment {
 intent_id:string;ack_no:number;amount_value:number;currency_code:Currency;cause_title:string;issued_at:string;
 intent_status:'pending'|'approved'|'rejected';recipient_id:string;recipient_name:string;
}
export interface AccessRequest {
 id:string;email:string;display_name:string;member_type:MemberType;scout_id:string|null;
 group_name:string;referral_note:string;adult_attested:boolean;
 status:'pending'|'approved'|'rejected'|'consumed';created_at:string;reviewed_at:string|null;reviewed_by:string|null;
}
export interface RecipientOption {id:string;display_name:string;role:'admin'|'member'}
export const intentionProgress=(c:Pick<Cause,'intention_count'|'max_intentions'>)=>
 Math.min(100,Math.max(0,Math.round(100*c.intention_count/Math.max(1,c.max_intentions))));
export type SupportPurpose='Actividades'|'Transporte'|'Materiales'|'Formación'|'General';
export interface SupportIntent {
 id:string;user_id:string;amount:number;currency_code:Currency;purpose:SupportPurpose;note:string;
 status:'intent'|'pending'|'approved'|'rejected';created_at:string;cause_id:string|null;acknowledgment_no:number;
 recipient_id:string|null;recipient_name:string|null;reviewed_at:string|null;reviewed_by:string|null;
}
export const formatId=(value:string)=>value.trim().toUpperCase().replace(/\s/g,'');
export const isScoutId=(v:string|null|undefined)=>/^CHN-?[A-Z0-9]{4,12}$/.test(formatId(v||''));
export const canViewCatalogue=(p:Profile|null|undefined):boolean=>Boolean(p?.verified&&(
 (p.member_type==='scout'&&isScoutId(p.scout_id))||
 (p.member_type==='supporter'&&!p.scout_id&&p.adult_attested)||
 p.role==='admin'
));
export const canPublish=(p:Profile|null|undefined)=>Boolean(canViewCatalogue(p)&&(p?.member_type==='scout'||p?.role==='admin'));
export const causeIsActive=(c:Cause)=>c.status==='active'&&new Date(c.end_at).getTime()>Date.now();
export const ackLabel=(no:number)=>'G4-'+String(no).padStart(8,'0');
export const money=(amount:number,currency:Currency='MXN',locale:'es'|'en'='es')=>new Intl.NumberFormat(locale==='es'?'es-MX':'en-US',{style:'currency',currency,maximumFractionDigits:0}).format(amount);
export const causeAmount=(c:Cause,currency:Currency):number|null=>currency==='USD'?c.fixed_support_amount_usd:c.fixed_support_amount;
export const causeTotal=(c:Cause,currency:Currency):number=>currency==='USD'?c.intention_total_usd:c.intention_total;
export const causeTarget=(c:Cause,currency:Currency):number=>currency==='USD'?c.target_amount_usd:c.target_amount;
export const categoryLabel=(category:Category,language:'es'|'en'='es')=>language==='es'?category:({Aventura:'Adventure',Equipo:'Equipment',Coleccionables:'Collectibles',Experiencias:'Experiences',Arte:'Art',Otros:'Other'} as Record<Category,string>)[category];
export const remaining=(iso:string,language:'es'|'en'='es')=>{
 const delta=new Date(iso).getTime()-Date.now();if(delta<=0)return language==='en'?'Ended':'Finalizó';
 const days=Math.floor(delta/86400000),hours=Math.floor(delta%86400000/3600000);
 return days?days+(language==='en'?'d ':' d ')+hours+'h':hours?hours+'h '+Math.floor(delta%3600000/60000)+'m':Math.max(1,Math.ceil(delta/60000))+(language==='en'?'m':' min');
};

/** Catalogue filtering is local to the already-authorized cause list; it grants no database access. */
export type CauseSort='newest'|'ending'|'most-progress'|'spaces';
export type CauseFilter='all'|'available'|'full'|'ended';
export interface CauseSearch {
 query:string;category:Category|'all';status:CauseFilter;sort:CauseSort;
}
export const isCauseAvailable=(c:Cause,now=Date.now()):boolean=>
 c.status==='active'&&new Date(c.end_at).getTime()>now&&c.intention_count<c.max_intentions;
export function filterCauses(causes:Cause[],options:CauseSearch,now=Date.now()):Cause[]{
 const q=options.query.trim().toLocaleLowerCase();
 const searchable=(c:Cause)=>[c.title,c.description,c.category,c.owner?.display_name||''].join(' ').toLocaleLowerCase().includes(q);
 const filtered=causes.filter(c=>{
  if(c.status!=='active'&&c.status!=='finished')return false;
  if(options.category!=='all'&&c.category!==options.category)return false;
  if(!searchable(c))return false;
  const available=isCauseAvailable(c,now),expired=new Date(c.end_at).getTime()<=now||c.status==='finished';
  return options.status==='all'||(options.status==='available'&&available)||
   (options.status==='full'&&c.status==='active'&&!expired&&c.intention_count>=c.max_intentions)||
   (options.status==='ended'&&expired);
 });
 return filtered.sort((a,b)=>{
  if(options.sort==='ending'){
   const ad=new Date(a.end_at).getTime(),bd=new Date(b.end_at).getTime();
   const af=ad>now&&a.status==='active',bf=bd>now&&b.status==='active';
   return Number(bf)-Number(af)||(af?ad-bd:bd-ad);
  }
  if(options.sort==='most-progress')return intentionProgress(b)-intentionProgress(a)||
   new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
  if(options.sort==='spaces')return (b.max_intentions-b.intention_count)-(a.max_intentions-a.intention_count);
  return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
 });
}
/** Only an identifier is placed in the shared URL; authorized users still pass RLS. */
export const validCauseId=(id:string|null|undefined):id is string=>
 Boolean(id&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id));
export function causeShareUrl(id:string,currentUrl:string):string{
 if(!validCauseId(id))throw new Error('ID de causa inválido');
 const url=new URL(currentUrl);url.searchParams.set('causa',id);url.hash='';
 return url.toString();
}
export const causeDraftKey=(userId:string)=>'scoutapoya:cause-draft:v1:'+userId;
