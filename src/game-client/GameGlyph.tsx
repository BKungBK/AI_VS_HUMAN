import type {ReactNode,SVGProps} from 'react';

export type GlyphName='pen'|'undo'|'trash'|'art'|'check'|'thumb'|'clock'|'send'|'lock'|'vote'|'star'|'trophy'|'crown'|'key'|'play'|'pause'|'search'|'finish'|'reset'|'building'|'sound-on'|'sound-off'|'bolt'|'document'|'target'|'left'|'right'|'robot'|'chat'|'warning'|'user'|'shield'|'chart'|'stop'|'idea'|'skull';

export default function GameGlyph({name,...props}:{name:GlyphName}&SVGProps<SVGSVGElement>){
 const base={fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
 let drawing;
 switch(name){
  case 'pen':drawing=<><path d="m5 19 4.5-1 9.8-9.8a2.8 2.8 0 0 0-4-4L10.5 9 9 13.5 5 19Z"/><path d="m13 6 5 5M5 19l4.5-1"/></>;break;
  case 'undo':drawing=<><path d="M9 8 4 12l5 4"/><path d="M5 12h8a7 7 0 1 1 0 14"/></>;break;
  case 'trash':drawing=<><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m3 4v6m6-6v6"/></>;break;
  case 'art':drawing=<><path d="M12 3a9 9 0 1 0 0 18h1.3a2 2 0 0 0 1.5-3.3 1.6 1.6 0 0 1 1.2-2.7H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></>;break;
  case 'check':drawing=<path d="m4 13 5 5L20 6"/>;break;
  case 'thumb':drawing=<path d="M8 10v11H4V10h4Zm0 10h8.8a2 2 0 0 0 1.9-1.4l2-6A2 2 0 0 0 18.8 10H14l.7-4.1A2.3 2.3 0 0 0 12.4 3L8 10v10Z"/>;break;
  case 'clock':drawing=<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>;break;
  case 'send':drawing=<><path d="m21 3-7.5 18-3.4-7.1L3 10.5 21 3Z"/><path d="m10.1 13.9 4.4-4.4"/></>;break;
  case 'lock':drawing=<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2"/></>;break;
  case 'vote':drawing=<><path d="M5 4h14v15H5zM8 8h8M8 12h5M8 16h3"/><path d="m9 22 2 2 5-5"/></>;break;
  case 'star':drawing=<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>;break;
  case 'trophy':drawing=<><path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM12 14v5m-5 3h10m-5-3H9a4 4 0 0 0-4 4m7-4h3a4 4 0 0 1 4 4M7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/></>;break;
  case 'crown':drawing=<><path d="m3 8 5 4 4-7 4 7 5-4-2 11H5L3 8Z"/><path d="M5 22h14"/></>;break;
  case 'key':drawing=<><circle cx="8" cy="15" r="5"/><path d="m12 11 8-8m-3 3 3 3m-6 0 3 3"/></>;break;
  case 'play':drawing=<path d="m8 5 12 7-12 7V5Z"/>;break;
  case 'pause':drawing=<><path d="M8 5v14M16 5v14"/></>;break;
  case 'search':drawing=<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>;break;
  case 'finish':drawing=<><path d="M5 21V4m0 1h13l-2 4 2 4H5"/><path d="M3 21h5"/></>;break;
  case 'reset':drawing=<><path d="M4 11a8 8 0 1 1 2 6"/><path d="M4 5v6h6"/></>;break;
  case 'building':drawing=<><path d="M4 21V4h16v17M2 21h20M8 8h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2m-4 5v-4"/></>;break;
  case 'sound-on':drawing=<><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/></>;break;
  case 'sound-off':drawing=<><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="m17 9 5 6m0-6-5 6"/></>;break;
  case 'bolt':drawing=<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>;break;
  case 'document':drawing=<><path d="M6 3h8l5 5v13H6zM14 3v5h5M9 12h7m-7 4h7"/></>;break;
  case 'target':drawing=<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>;break;
  case 'left':drawing=<><path d="M19 12H5m7 7-7-7 7-7"/></>;break;
  case 'right':drawing=<><path d="M5 12h14m-7-7 7 7-7 7"/></>;break;
  case 'robot':drawing=<><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4m-4 6h.1m7.9 0h.1M9 16h6M2 12h2m16 0h2"/></>;break;
  case 'chat':drawing=<><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8m-8 4h5"/></>;break;
  case 'warning':drawing=<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.1"/></>;break;
  case 'user':drawing=<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>;break;
  case 'shield':drawing=<><path d="M12 3 20 6v6c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>;break;
  case 'chart':drawing=<><path d="M4 20V5m0 15h17M8 16l4-5 3 2 5-7"/><path d="M16 6h4v4"/></>;break;
  case 'stop':drawing=<><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h6v6H9z"/></>;break;
  case 'idea':drawing=<><path d="M9 18h6m-5 3h4m-2-18a7 7 0 0 0-4 12.7c.7.5 1 1.2 1 2.3h6c0-1.1.3-1.8 1-2.3A7 7 0 0 0 12 3Z"/></>;break;
  case 'skull':drawing=<><path d="M12 3a8 8 0 0 0-5 14.2V21h10v-3.8A8 8 0 0 0 12 3Z"/><circle cx="9" cy="11" r="1.2"/><circle cx="15" cy="11" r="1.2"/><path d="M10 16h4m-3 2v3m2-3v3"/></>;break;
 }
 return <svg className="game-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}><g {...base}>{drawing}</g></svg>;
}

export function IconLabel({name,children,className}:{name:GlyphName;children:ReactNode;className?:string}){
 return <span className={`game-icon-label${className?` ${className}`:''}`}><GameGlyph name={name}/>{children}</span>;
}
