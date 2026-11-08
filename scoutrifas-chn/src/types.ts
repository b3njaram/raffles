export type ListingType = 'raffle' | 'auction';
export type ListingStatus = 'pending' | 'active' | 'paused' | 'finished' | 'cancelled';
export type Category = 'Aventura' | 'Equipo' | 'Coleccionables' | 'Experiencias' | 'Arte' | 'Otros';
export const categories: Category[] = ['Aventura','Equipo','Coleccionables','Experiencias','Arte','Otros'];
export interface Profile {
  id: string; scout_id: string; display_name: string; group_name: string;
  bio: string; avatar_path: string|null; role: 'member'|'admin';
  verified: boolean; created_at: string;
}
export interface Listing {
  id: string; owner_id: string; owner?: Profile; title: string;
  description: string; type: ListingType; category: Category;
  image_paths: string[]; status: ListingStatus; end_at: string;
  min_bid: number; bid_step: number; current_bid: number;
  entry_count: number; bid_count: number; max_entries: number;
  max_per_user: number; winner_id: string|null; created_at: string;
}
export interface Activity { id: string; listing_id: string; user_id: string; amount?: number; joined_at?: string; created_at?: string }
export interface Draft {
  title: string; description: string; type: ListingType; category: Category;
  end_at: string; min_bid: number; bid_step: number; max_entries: number; max_per_user: number;
}
export const defaultDraft: Draft = { title:'',description:'',type:'raffle',category:'Aventura',end_at:'',min_bid:100,bid_step:20,max_entries:100,max_per_user:1 };
export const formatId = (value: string) => value.trim().toUpperCase().replace(/\s/g,'');
export const isScoutId = (value: string) => /^CHN-?[A-Z0-9]{4,12}$/.test(formatId(value));
export const minimumBid = (l: Listing) => l.bid_count ? l.current_bid+l.bid_step : l.min_bid;
export const money = (n: number) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n);
export const remaining = (iso: string) => {
  const delta = new Date(iso).getTime()-Date.now();
  if(delta<=0) return 'Finalizó';
  const days=Math.floor(delta/86400000), hours=Math.floor(delta%86400000/3600000);
  if(days) return `${days} d ${hours} h`;
  const mins=Math.max(1,Math.ceil(delta/60000));
  return hours ? `${hours} h ${Math.floor(delta%3600000/60000)} min` : `${mins} min`;
};
export const isLive = (l:Listing) => l.status==='active' && new Date(l.end_at).getTime()>Date.now();
