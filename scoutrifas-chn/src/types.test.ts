import {describe,it,expect} from 'vitest';
import {canPublish,canRequestTickets,canViewCatalogue,defaultDraft,isScoutId,money,salesReady,calculateRaffle,defaultRafflePlan,ackLabel,causeIsActive} from './types';
import type {Listing,Profile} from './types';
const scout:Profile={id:'a',scout_id:'CHN-000123',member_type:'scout',adult_attested:true,display_name:'Test Scout',group_name:'',bio:'',avatar_path:null,role:'member',verified:true,created_at:''};
const supporter:Profile={...scout,member_type:'supporter',scout_id:null,role:'member'};
const listing:Listing={id:'a',owner_id:'a',title:'Rifa',description:'Descripción',type:'raffle',category:'Otros',image_paths:[],status:'active',end_at:new Date(Date.now()+86400000).toISOString(),min_bid:0,bid_step:1,current_bid:0,entry_count:0,bid_count:0,max_entries:100,max_per_user:5,winner_id:null,created_at:'',ticket_price:50,sales_authorized:false,free_entry_authorized:false,free_entry_count:0,permit_number:null,permit_expires_at:null,official_rules_url:null,winning_ticket_no:null};
describe('perfiles y participación',()=>{
 it('acepta solamente IDs CHN válidos',()=>{expect(isScoutId('CHN-000123')).toBe(true);expect(isScoutId('ABC-000123')).toBe(false)});
 it('permite simpatizantes aprobados sin ID scout',()=>{expect(canViewCatalogue(supporter)).toBe(true);expect(canPublish(supporter)).toBe(false)});
 it('rechaza simpatizantes sin aprobación y menores para boletos',()=>{expect(canViewCatalogue({...supporter,verified:false})).toBe(false);expect(canRequestTickets({...scout,adult_attested:false})).toBe(false)});
 it('solo permite publicar a scouts aprobados',()=>{expect(canPublish(scout)).toBe(true);expect(defaultDraft.ticket_price).toBe(50)});
 it('sin autorización de venta no hay solicitudes',()=>{expect(salesReady(listing)).toBe(false);expect(salesReady({...listing,sales_authorized:true,permit_number:'SEGOB-2026',permit_expires_at:new Date(Date.now()+86400000).toISOString(),official_rules_url:'https://ejemplo.mx/bases'})).toBe(true)});
 it('muestra monto MXN',()=>{expect(money(150)).toContain('150')});
});

describe('calculadora de rifas',()=>{
 it('calcula ingreso bruto, comisión y ganancia neta al 100%',()=>{
  const c=calculateRaffle(50,100,{prizeCost:1000,otherCosts:250,profitGoal:3000,feePct:10});
  expect(c.revenue).toBe(5000);expect(c.fees).toBe(500);
  expect(c.profit).toBe(3250);expect(c.breakEven).toBe(28);
  expect(c.goalMet).toBe(true);expect(c.goalTickets).toBe(95);
 });
 it('detecta meta inalcanzable y respeta comisión cero por defecto',()=>{
  expect(defaultRafflePlan.feePct).toBe(0);
  const c=calculateRaffle(20,10,{prizeCost:800,otherCosts:0,profitGoal:300,feePct:0});
  expect(c.profit).toBe(-600);
  expect(c.goalMet).toBe(false);
  expect(c.goalTickets).toBe(55);
 });
});

describe('sorteos independientes de aportaciones',()=>{
 it('el modelo gratuito nunca requiere precio por participación',()=>{
  const draw={...listing, ticket_price:0,free_entry_authorized:false,free_entry_count:0};
  expect(draw.ticket_price).toBe(0);expect(draw.free_entry_authorized).toBe(false);
 });
});

describe('causas reales y acuses',()=>{
 const project={id:'x',owner_id:'member',title:'Apoyo al Grupo 4',description:'Proyecto del Grupo 4 Chihuahua Norte',
  category:'Otros' as const,image_paths:['member/listings/photo.jpg'],fixed_support_amount:100,
  target_amount:5000,end_at:new Date(Date.now()+86400000).toISOString(),
  status:'active' as const,intention_count:0,intention_total:0,created_at:''};
 it('la misma referencia se presenta en un formato único',()=>{
  expect(ackLabel(10001)).toBe('G4-00010001');
  expect(ackLabel(10002)).not.toBe(ackLabel(10001));
 });
 it('solo las causas activas y vigentes aceptan intenciones',()=>{
  expect(causeIsActive(project)).toBe(true);
  expect(causeIsActive({...project,status:'pending'})).toBe(false);
  expect(causeIsActive({...project,end_at:'2020-01-01T00:00:00Z'})).toBe(false);
 });
});
