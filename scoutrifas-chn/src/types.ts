export type ListingType = 'raffle' | 'auction'; // auction sólo legado; nuevas publicaciones: raffle
export type ListingStatus = 'pending' | 'active' | 'paused' | 'finished' | 'cancelled';
export type Category = 'Aventura'|'Equipo'|'Coleccionables'|'Experiencias'|'Arte'|'Otros';
export type MemberType = 'scout'|'supporter';
export const categories:Category[]=['Aventura','Equipo','Coleccionables','Experiencias','Arte','Otros'];

export interface Profile {
 id:string; scout_id:string|null; display_name:string;group_name:string;
 bio:string; avatar_path:string|null; role:'member'|'admin';verified:boolean; created_at:string;
 member_type:MemberType; adult_attested:boolean; referral_note?:string;
}
export interface Listing {
 id:string;owner_id:string;owner?:Profile;title:string;description:string;
 type:ListingType; category:Category; image_paths:string[]; status:ListingStatus;end_at:string;
 min_bid:number;bid_step:number;current_bid:number;entry_count:number;bid_count:number;
 max_entries:number;max_per_user:number;winner_id:string|null;created_at:string;
 ticket_price:number;sales_authorized:boolean;free_entry_authorized:boolean;free_entry_count:number;permit_number:string|null;permit_expires_at:string|null;
 official_rules_url:string|null;winning_ticket_no:number|null;
}
export interface Draft {
 title:string; description:string;category:Category;end_at:string;
 ticket_price:number;max_entries:number;max_per_user:number;
}
export interface AccessRequest {
 id:string;email:string;display_name:string;member_type:MemberType;scout_id:string|null;
 group_name:string;referral_note:string;adult_attested:boolean;
 status:'pending'|'approved'|'rejected'|'consumed';created_at:string;reviewed_at:string|null;reviewed_by:string|null;
}
export interface RafflePlan {
 prizeCost:number;otherCosts:number;profitGoal:number;feePct:number;
}
export function calculateRaffle(price:number,count:number,plan:RafflePlan){
 const revenue=Math.max(0,price)*Math.max(0,count);
 const fees=revenue*Math.max(0,plan.feePct)/100;
 const profit=revenue-fees-Math.max(0,plan.prizeCost)-Math.max(0,plan.otherCosts);
 const breakEven=price>0&&plan.feePct<100?Math.ceil((Math.max(0,plan.prizeCost)+Math.max(0,plan.otherCosts))/(price*(1-plan.feePct/100))):Infinity;
 const goalTickets=price>0&&plan.feePct<100?Math.ceil((Math.max(0,plan.prizeCost)+Math.max(0,plan.otherCosts)+Math.max(0,plan.profitGoal))/(price*(1-plan.feePct/100))):Infinity;
 return {revenue,fees,profit,breakEven,goalTickets,margin:revenue>0?100*profit/revenue:0,goalMet:profit>=plan.profitGoal};
}
export type SupportPurpose='Actividades'|'Transporte'|'Materiales'|'Formación'|'General';
export const supportPurposes:SupportPurpose[]=['Actividades','Transporte','Materiales','Formación','General'];

export interface Cause {
 id:string;owner_id:string;owner?:Profile;title:string;description:string;category:Category;
 image_paths:string[];fixed_support_amount:number;target_amount:number;end_at:string;
 status:ListingStatus;intention_count:number;intention_total:number;created_at:string;
}
export interface CauseDraft {
 title:string;description:string;category:Category;endAt:string;
 amount:number;target:number;
}
export interface CauseAcknowledgment {
 intent_id:string;ack_no:number;amount_mxn:number;cause_title:string;issued_at:string;
}
export function causeIsActive(c:Cause):boolean{
 return c.status==='active'&&new Date(c.end_at).getTime()>Date.now();
}
export function ackLabel(no:number):string{
 return 'G4-'+String(no).padStart(8,'0');
}
export interface SupportIntent {
 id:string;user_id:string;amount:number;purpose:SupportPurpose;note:string;
 status:'intent';created_at:string;cause_id:string|null;acknowledgment_no:number;
}
export interface FreeDrawEntry {
 id:string;listing_id:string;user_id:string;entry_no:number;created_at:string;
}
export const freeDrawReady=(l:Listing):boolean=>isLive(l)&&l.free_entry_authorized
 &&Boolean(l.permit_number)&&Boolean(l.official_rules_url)
 &&Boolean(l.permit_expires_at)&&new Date(l.permit_expires_at||'').getTime()>Date.now();
export interface TicketOrder {
 id:string;listing_id:string;user_id:string;quantity:number;unit_price:number;total_price:number;
 status:'pending'|'confirmed'|'cancelled'|'expired';expires_at:string;created_at:string;
 reviewed_at:string|null;reviewed_by:string|null;
}
export interface TicketNumber {
 id:string;listing_id:string;order_id:string;user_id:string;ticket_no:number;issued_at:string;
}
export interface AdminReport {
 orders:TicketOrder[];tickets:TicketNumber[];confirmed:number;pending:number;totalTickets:number;
 totalOrders:number;totalReference:number;memberCount:number;pendingMembers:number;supportersCount:number;
}
export const defaultRafflePlan:RafflePlan={prizeCost:0,otherCosts:0,profitGoal:2000,feePct:0};
export const defaultDraft:Draft={
 title:'',description:'',category:'Aventura',end_at:'',ticket_price:50,max_entries:100,max_per_user:5
};
export const formatId=(value:string)=>value.trim().toUpperCase().replace(/\s/g,'');
export const isScoutId=(v:string|null|undefined)=>/^CHN-?[A-Z0-9]{4,12}$/.test(formatId(v||''));
export const canViewCatalogue=(p:Profile|null|undefined):boolean=>Boolean(p?.verified&&(
 (p.member_type==='scout' && isScoutId(p.scout_id))||
 (p.member_type==='supporter' && !p.scout_id && p.adult_attested)||
 p.role==='admin'
));
export const canPublish=(p:Profile|null|undefined)=>Boolean(canViewCatalogue(p)&&(p?.member_type==='scout'||p?.role==='admin'));
export const canRequestTickets=(p:Profile|null|undefined)=>Boolean(canViewCatalogue(p)&&p?.adult_attested);
export const money=(n:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n);
export const remaining=(iso:string)=>{
 const delta=new Date(iso).getTime()-Date.now();if(delta<=0)return 'Finalizó';
 const days=Math.floor(delta/86400000),hours=Math.floor(delta%86400000/3600000);
 return days?String(days)+' d '+String(hours)+' h':hours?String(hours)+' h '+String(Math.floor(delta%3600000/60000))+' min':String(Math.max(1,Math.ceil(delta/60000)))+' min';
};
export const isLive=(l:Listing)=>l.status==='active'&&new Date(l.end_at).getTime()>Date.now();
export const salesReady=(l:Listing)=>isLive(l)&&l.sales_authorized&&Boolean(l.permit_number)&&Boolean(l.official_rules_url)&&Boolean(l.permit_expires_at)&&new Date(l.permit_expires_at||'').getTime()>Date.now();
