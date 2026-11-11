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
 image_paths:string[];fixed_support_amount:number;target_amount:number;end_at:string;
 status:CauseStatus;intention_count:number;intention_total:number;max_intentions:number;created_at:string;
}
export interface CauseDraft {
 title:string;description:string;category:Category;endAt:string;amount:number;target:number;maxIntentions:number;
}
export interface CauseAcknowledgment {
 intent_id:string;ack_no:number;amount_mxn:number;cause_title:string;issued_at:string;
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
 id:string;user_id:string;amount:number;purpose:SupportPurpose;note:string;
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
export const money=(amount:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(amount);
export const remaining=(iso:string)=>{
 const delta=new Date(iso).getTime()-Date.now();if(delta<=0)return 'Finalizó';
 const days=Math.floor(delta/86400000),hours=Math.floor(delta%86400000/3600000);
 return days?days+' d '+hours+' h':hours?hours+' h '+Math.floor(delta%3600000/60000)+' min':Math.max(1,Math.ceil(delta/60000))+' min';
};
