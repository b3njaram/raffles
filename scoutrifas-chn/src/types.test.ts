import {describe,it,expect} from 'vitest';
import {ackLabel,canPublish,canViewCatalogue,causeIsActive,formatId,isScoutId,money,remaining,intentionProgress} from './types';
import type {Cause,Profile} from './types';
const scout:Profile={id:'scout1',scout_id:'CHN-000123',member_type:'scout',adult_attested:true,
 display_name:'Test Scout',group_name:'Grupo 4',bio:'',avatar_path:null,role:'member',verified:true,created_at:''};
const supporter:Profile={...scout,member_type:'supporter',scout_id:null,role:'member'};
const cause:Cause={id:'cause1',owner_id:scout.id,title:'Transporte para actividades',
 description:'Proyecto de transporte para el Grupo 4.',category:'Aventura',image_paths:[scout.id+'/listings/photo.jpg'],
 fixed_support_amount:100,target_amount:3000,max_intentions:25,end_at:new Date(Date.now()+86400000).toISOString(),
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
 it('muestra la proporción del cupo de intenciones',()=>{expect(intentionProgress({...cause,intention_count:5})).toBe(20);expect(intentionProgress({...cause,intention_count:25})).toBe(100)});
 it('no permite porcentajes superiores a cien ni negativos',()=>{expect(intentionProgress({...cause,intention_count:30})).toBe(100);expect(intentionProgress({...cause,intention_count:0})).toBe(0)});
 it('indica el fin de una causa vencida',()=>expect(remaining('2020-01-01T00:00:00Z')).toBe('Finalizó'));
});
