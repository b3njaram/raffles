import {describe,it,expect} from 'vitest';
import {formatId,isScoutId,minimumBid,remaining} from './types';
import type {Listing} from './types';
describe('Validaciones de comunidad',()=>{
  it('requiere ID empezando con CHN y longitud razonable',()=>{
    expect(isScoutId(' chn-012345 ')).toBe(true);
    expect(isScoutId('CHNABCD1')).toBe(true);
    expect(isScoutId('MX-012345')).toBe(false);
    expect(isScoutId('CHN-')).toBe(false);
    expect(isScoutId('CHN-AB!')).toBe(false);
    expect(formatId(' chn-0123 ')).toBe('CHN-0123');
  });
  it('escala las pujas con el incremento configurado',()=>{
    expect(minimumBid({bid_count:0,min_bid:100,current_bid:0,bid_step:20} as Listing)).toBe(100);
    expect(minimumBid({bid_count:2,min_bid:100,current_bid:300,bid_step:20} as Listing)).toBe(320);
  });
  it('muestra la finalización de eventos pasados',()=>{
    expect(remaining('2000-01-01')).toBe('Finalizó');
  });
});
