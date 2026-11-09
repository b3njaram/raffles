import {describe,it,expect} from 'vitest';
import {canPublish,canRequestTickets,canViewCatalogue,defaultDraft,isScoutId,money,salesReady} from './types';
import type {Listing,Profile} from './types';
const scout:Profile={id:'a',scout_id:'CHN-000123',member_type:'scout',adult_attested:true,display_name:'Test Scout',group_name:'',bio:'',avatar_path:null,role:'member',verified:true,created_at:''};
const supporter:Profile={...scout,member_type:'supporter',scout_id:null,role:'member'};
const listing:Listing={id:'a',owner_id:'a',title:'Rifa',description:'Descripción',type:'raffle',category:'Otros',image_paths:[],status:'active',end_at:new Date(Date.now()+86400000).toISOString(),min_bid:0,bid_step:1,current_bid:0,entry_count:0,bid_count:0,max_entries:100,max_per_user:5,winner_id:null,created_at:'',ticket_price:50,sales_authorized:false,permit_number:null,permit_expires_at:null,official_rules_url:null,winning_ticket_no:null};
describe('perfiles y participación',()=>{
 it('acepta solamente IDs CHN válidos',()=>{expect(isScoutId('CHN-000123')).toBe(true);expect(isScoutId('ABC-000123')).toBe(false)});
 it('permite simpatizantes aprobados sin ID scout',()=>{expect(canViewCatalogue(supporter)).toBe(true);expect(canPublish(supporter)).toBe(false)});
 it('rechaza simpatizantes sin aprobación y menores para boletos',()=>{expect(canViewCatalogue({...supporter,verified:false})).toBe(false);expect(canRequestTickets({...scout,adult_attested:false})).toBe(false)});
 it('solo permite publicar a scouts aprobados',()=>{expect(canPublish(scout)).toBe(true);expect(defaultDraft.ticket_price).toBe(50)});
 it('sin autorización de venta no hay solicitudes',()=>{expect(salesReady(listing)).toBe(false);expect(salesReady({...listing,sales_authorized:true,permit_number:'SEGOB-2026',permit_expires_at:new Date(Date.now()+86400000).toISOString(),official_rules_url:'https://ejemplo.mx/bases'})).toBe(true)});
 it('muestra monto MXN',()=>{expect(money(150)).toContain('150')});
});
