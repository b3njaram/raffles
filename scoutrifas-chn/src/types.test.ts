import {describe,it,expect} from 'vitest';
import {ackLabel,canPublish,canViewCatalogue,causeIsActive,formatId,isScoutId,money,remaining,intentionProgress,causeAmount,causeTotal,causeTarget,filterCauses,isCauseAvailable,validCauseId,causeShareUrl,causeDraftKey} from './types';
import type {Cause,Profile} from './types';
const scout:Profile={id:'scout1',scout_id:'CHN-000123',member_type:'scout',adult_attested:true,
 display_name:'Test Scout',group_name:'Grupo 4',bio:'',avatar_path:null,role:'member',verified:true,created_at:''};
const supporter:Profile={...scout,member_type:'supporter',scout_id:null,role:'member'};
const cause:Cause={id:'cause1',owner_id:scout.id,title:'Transporte para actividades',
 description:'Proyecto de transporte para el Grupo 4.',category:'Aventura',image_paths:[scout.id+'/listings/photo.jpg'],
 fixed_support_amount:100,fixed_support_amount_usd:7,target_amount:3000,target_amount_usd:150,intention_total_usd:0,max_intentions:25,end_at:new Date(Date.now()+86400000).toISOString(),
 status:'active',intention_count:0,intention_total:0,created_at:''};
describe('identidad y acceso',()=>{
 it('valida el identificador Scout CHN',()=>{
  expect(isScoutId('CHN-000123')).toBe(true);expect(isScoutId('ABC-000123')).toBe(false);
  expect(formatId(' chn-000123 ')).toBe('CHN-000123');
 });
 it('no permite ver causas a usuarios sin aprobación',()=>expect(canViewCatalogue({...supporter,verified:false})).toBe(false));
 it('permite el acceso a simpatizantes aprobados',()=>expect(canViewCatalogue(supporter)).toBe(true));
 it('sólo permite crear causas a scouts aprobados',()=>{
  expect(canPublish(scout)).toBe(true);expect(canPublish(supporter)).toBe(false);
 });
 it('no permite gestionar causas a scouts sin verificar',()=>expect(canPublish({...scout,verified:false})).toBe(false));
});
describe('causas comunitarias',()=>{
 it('reconoce las causas activas y vigentes',()=>expect(causeIsActive(cause)).toBe(true));
 it('impide registrar intenciones en causas pendientes',()=>expect(causeIsActive({...cause,status:'pending'})).toBe(false));
 it('impide registrar intenciones al finalizar',()=>expect(causeIsActive({...cause,end_at:'2020-01-01T00:00:00Z'})).toBe(false));
 it('diferencia folios consecutivos',()=>{
  expect(ackLabel(10001)).toBe('G4-00010001');expect(ackLabel(10002)).toBe('G4-00010002');
 });
 it('formatea montos en MXN',()=>expect(money(150)).toContain('150'));
 it('mantiene importes por moneda sin convertirlos',()=>{expect(money(10,'USD')).toContain('10');expect(causeAmount(cause,'MXN')).toBe(100);expect(causeAmount(cause,'USD')).toBe(7);expect(causeTotal(cause,'USD')).toBe(0);expect(causeTarget(cause,'USD')).toBe(150)});
 it('muestra la proporción del cupo de intenciones',()=>{expect(intentionProgress({...cause,intention_count:5})).toBe(20);expect(intentionProgress({...cause,intention_count:25})).toBe(100)});
 it('no permite porcentajes superiores a cien ni negativos',()=>{expect(intentionProgress({...cause,intention_count:30})).toBe(100);expect(intentionProgress({...cause,intention_count:0})).toBe(0)});
 it('indica el fin de una causa vencida',()=>expect(remaining('2020-01-01T00:00:00Z')).toBe('Finalizó'));
});


describe('discovery of authorized causes',()=>{
 const earlier={...cause,id:'1033cf9c-50cf-45d1-8a63-a96b84ac9c24',title:'Transporte',created_at:'2026-10-10T00:00:00Z',
  end_at:'2026-12-01T00:00:00Z',intention_count:24};
 const later={...cause,id:'44aabbc1-dd11-42cb-8e3f-ec64484a83a6',title:'Equipo para acampar',category:'Equipo' as const,
  created_at:'2026-11-10T00:00:00Z',end_at:'2026-11-20T00:00:00Z',intention_count:25};
 const current=Date.parse('2026-11-11T00:00:00Z');
 it('sorts newest first and filters categories without exposing pending causes',()=>{
  const data=[earlier,later,{...cause,status:'pending' as const}];
  expect(filterCauses(data,{query:'',category:'all',status:'all',sort:'newest'},current).map(c=>c.id)).toEqual([later.id,earlier.id]);
  expect(filterCauses(data,{query:'',category:'Equipo',status:'all',sort:'newest'},current).map(c=>c.title)).toEqual([later.title]);
 });
 it('distinguishes open and full causes and orders soonest closing',()=>{
  expect(isCauseAvailable(earlier,current)).toBe(true);
  expect(isCauseAvailable(later,current)).toBe(false);
  expect(filterCauses([earlier,later],{query:'',category:'all',status:'available',sort:'ending'},current)).toHaveLength(1);
  expect(filterCauses([earlier,later],{query:'',category:'all',status:'full',sort:'ending'},current)[0].id).toBe(later.id);
 });
 it('searches owner and description, and sorts by available spaces',()=>{
  const settings={query:'equipo',category:'all' as const,status:'all' as const,sort:'spaces' as const};
  expect(filterCauses([earlier,later],settings,current).map(c=>c.title)).toEqual([later.title]);
  expect(filterCauses([earlier,later],{...settings,query:''},current)[0].id).toBe(earlier.id);
 });
});
describe('private cause deep links and local drafts',()=>{
 const id='1033cf9c-50cf-45d1-8a63-a96b84ac9c24';
 it('accepts valid cause ids and rejects malformed links',()=>{
  expect(validCauseId(id)).toBe(true);
  expect(validCauseId('../../bad')).toBe(false);
  expect(validCauseId(null)).toBe(false);
 });
 it('preserves the existing origin and query parameters without sensitive content',()=>{
  const result=causeShareUrl(id,'https://scoutapoya-chn.vercel.app/?lang=es#causas');
  expect(result).toBe('https://scoutapoya-chn.vercel.app/?lang=es&causa='+id);
  expect(()=>causeShareUrl('../../bad','https://scoutapoya-chn.vercel.app/')).toThrow();
 });
 it('isolates a cause draft by organizer account',()=>{
  expect(causeDraftKey('owner-a')).not.toBe(causeDraftKey('owner-b'));
 });
});
