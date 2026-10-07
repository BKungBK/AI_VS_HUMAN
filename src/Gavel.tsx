import {useId} from 'react';

/** Authored SVG materials; no mesh, external texture or rasterized text. */
export function Gavel(){
 const id=`gavel-${useId().replace(/[^a-zA-Z0-9-]/g,'')}`,paint=(name:string)=>`url(#${id}-${name})`;
 return <svg viewBox="0 0 560 360" className="gavel material-gavel" role="img" aria-label="ค้อนผู้พิพากษาไม้ มีเงาและฐานรอง ภาพประกอบ SVG">
  <defs>
   <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#241B1A"/><stop offset=".18" stopColor="#80564A"/><stop offset=".43" stopColor="#B88B72"/><stop offset=".62" stopColor="#694338"/><stop offset=".84" stopColor="#3A2725"/><stop offset="1" stopColor="#1C1719"/></linearGradient>
   <linearGradient id={`${id}-handle`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#BB9179"/><stop offset=".22" stopColor="#80574A"/><stop offset=".62" stopColor="#493029"/><stop offset="1" stopColor="#211C1D"/></linearGradient>
   <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#444955"/><stop offset=".25" stopColor="#A8AFBB"/><stop offset=".4" stopColor="#E0D8C9"/><stop offset=".53" stopColor="#8C909B"/><stop offset=".79" stopColor="#343A45"/><stop offset="1" stopColor="#242B35"/></linearGradient>
   <linearGradient id={`${id}-top`} x1="0" y1="0" x2=".4" y2="1"><stop stopColor="#AD8470"/><stop offset=".45" stopColor="#704A40"/><stop offset="1" stopColor="#2B2223"/></linearGradient>
   <radialGradient id={`${id}-shadow`}><stop stopColor="#05090D" stopOpacity=".8"/><stop offset="1" stopColor="#05090D" stopOpacity="0"/></radialGradient>
  </defs>
  <ellipse cx="277" cy="326" rx="178" ry="22" fill={paint('shadow')}/>
  <g className="gavel-block">
   <path d="M151 284V309C151 330 369 330 369 309V284Z" fill={paint('handle')} stroke="#D6B19A" strokeOpacity=".17" strokeWidth="1"/>
   <ellipse cx="260" cy="284" rx="109" ry="22" fill={paint('top')} stroke="#CEA38A" strokeOpacity=".35" strokeWidth="1.5"/>
   <ellipse cx="260" cy="284" rx="85" ry="14" fill="none" stroke="#1A1920" strokeOpacity=".45"/>
   <path d="M170 313Q260 329 350 313" fill="none" stroke="#E4B299" strokeOpacity=".16" strokeWidth="1.5"/>
   <path className="gavel-block-rim" d="M152 284C162 300 341 309 368 287" fill="none" stroke="#FF6B6B" strokeOpacity=".4" strokeWidth="1.5"/>
  </g>
  <ellipse className="gavel-contact-shadow" cx="263" cy="279" rx="62" ry="12" fill="#080D13" opacity=".5"/>
  <ellipse className="gavel-impact" cx="261" cy="280" rx="48" ry="9" fill="none" stroke="#FF6B6B" strokeWidth="2" opacity="0"/>
  <g className="gavel-tool">
   <path d="M281 192C330 191 381 192 425 200L447 199Q464 207 451 224L424 222C376 213 329 211 281 212Z" fill={paint('handle')} stroke="#CE9F85" strokeOpacity=".25" strokeWidth="1"/>
   <path d="M312 197C346 196 393 201 421 205M310 205C351 204 395 208 420 213" fill="none" stroke="#D7AF92" strokeOpacity=".17" strokeWidth="1.3"/>
   <path d="M422 200L420 220M430 201L428 221" stroke="#241C20" strokeOpacity=".5" strokeWidth="2"/>
   <path d="M282 189Q296 185 298 199V214Q291 223 282 217Z" fill={paint('metal')}/>
   <path d="M216 160C216 150 298 150 298 160V250C298 269 216 269 216 250Z" fill={paint('wood')} stroke="#D5AC94" strokeOpacity=".25" strokeWidth="1.3"/>
   <path d="M227 174C232 195 223 226 229 242M244 176C251 199 239 222 246 245M264 178C269 200 263 222 271 241M285 175C279 193 290 229 285 244" fill="none" stroke="#241B1F" strokeOpacity=".3" strokeWidth="1.4"/>
   <path d="M234 173C238 197 229 222 237 244M254 175C257 195 250 224 259 245" fill="none" stroke="#E6BB98" strokeOpacity=".22" strokeWidth="1"/>
   <path d="M214 158V174C214 187 300 187 300 174V158Z" fill={paint('metal')}/>
   <ellipse cx="257" cy="158" rx="43" ry="13" fill={paint('top')} stroke="#D9CBB6" strokeOpacity=".5" strokeWidth="1.4"/>
   <ellipse cx="257" cy="158" rx="31" ry="8" fill="none" stroke="#312329" strokeOpacity=".45"/>
   <path d="M214 238V254C214 270 300 270 300 254V238C299 252 216 252 214 238Z" fill={paint('metal')}/>
   <ellipse cx="257" cy="254" rx="43" ry="12" fill={paint('top')}/>
   <path d="M217 245C230 253 281 256 298 246" fill="none" stroke="#F8F9FA" strokeOpacity=".4" strokeWidth="1.3"/>
   <path d="M215 176V235" stroke="#FF6B6B" strokeOpacity=".55" strokeWidth="1.3"/>
  </g>
 </svg>;
}
