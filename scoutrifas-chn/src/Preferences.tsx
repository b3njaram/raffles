import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {Languages,Moon,Sun} from 'lucide-react';
import type {Currency} from './types';
import {money} from './types';

export type Language='es'|'en';
export type Theme='light'|'dark';
interface Preferences {
 language:Language; theme:Theme; setLanguage:(v:Language)=>void; setTheme:(v:Theme)=>void;
 t:(es:string,en:string)=>string;
 format:(amount:number,currency:Currency)=>string;
 date:(value:string)=>string;
}
const Context=createContext<Preferences|null>(null);
const stored=<T extends string>(name:string,allowed:readonly T[],fallback:T):T=>{
 try{const value=localStorage.getItem(name) as T|null;return value&&allowed.includes(value)?value:fallback;}catch{return fallback;}
};
export function PreferencesProvider({children}:{children:ReactNode}){
 const [language,setLanguage]=useState<Language>(()=>stored('scoutapoya-language',['es','en'],'es'));
 const [theme,setTheme]=useState<Theme>(()=>stored('scoutapoya-theme',['light','dark'],'light'));
 useEffect(()=>{document.documentElement.lang=language;try{localStorage.setItem('scoutapoya-language',language)}catch{}},[language]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;
  try{localStorage.setItem('scoutapoya-theme',theme)}catch{}},[theme]);
 const value=useMemo<Preferences>(()=>({
  language,theme,setLanguage,setTheme,
  t:(es,en)=>language==='en'?en:es,
  format:(amount,currency)=>money(amount,currency,language),
  date:(value)=>new Date(value).toLocaleString(language==='es'?'es-MX':'en-US')
 }),[language,theme]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreferences():Preferences{
 const context=useContext(Context);if(!context)throw new Error('PreferencesProvider missing');
 return context;
}
export function PreferenceSwitches(){
 const {language,setLanguage,theme,setTheme,t}=usePreferences();
 return <div className="chn-pref-switches" aria-label={t('Preferencias de visualización','Display preferences')}>
  <div className="chn-pref-group" role="group" aria-label={t('Idioma','Language')}>
   <Languages size={15} aria-hidden="true"/>
   <button type="button" aria-label="Español" aria-pressed={language==='es'} className={language==='es'?'active':''} onClick={()=>setLanguage('es')}>ES</button>
   <button type="button" aria-label="English" aria-pressed={language==='en'} className={language==='en'?'active':''} onClick={()=>setLanguage('en')}>EN</button>
  </div>
  <div className="chn-pref-group" role="group" aria-label={t('Apariencia','Appearance')}>
   <button type="button" aria-label={t('Modo claro','Light mode')} aria-pressed={theme==='light'} className={theme==='light'?'active':''} onClick={()=>setTheme('light')}><Sun size={16}/></button>
   <button type="button" aria-label={t('Modo oscuro','Dark mode')} aria-pressed={theme==='dark'} className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')}><Moon size={16}/></button>
  </div>
 </div>;
}
