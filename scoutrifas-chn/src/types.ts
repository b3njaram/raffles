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
 ticket_price:number;sales_authorized:boolean;permit_number:string|null;permit_expires_at:string|null;
 official_rules_url:string|null;winning_ticket_no:number|null;
}
export interface Draft {
 title:string; description:string;category:Category;end_at:string;
 ticket_price:number;max_entries:number;max_per_user:number;
}
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
