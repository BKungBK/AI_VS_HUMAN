import './waiting-stage.css';

type WaitGame = {
  cue: string;
  name: string;
  short: string;
  glyph: 'rope' | 'image' | 'caption' | 'mushroom' | 'chat' | 'shield' | 'piece';
};

const games: WaitGame[] = [
  {cue:'02.01',name:'Trust Tug-of-War',short:'ชักเย่อความไว้ใจ',glyph:'rope'},
  {cue:'03.05',name:'Swipe Court',short:'ทายที่มาของภาพ',glyph:'image'},
  {cue:'04.01',name:'Caption & Prompt Battle',short:'เขียนแคปชั่น',glyph:'caption'},
  {cue:'07.01',name:'Death Cap Roulette',short:'วงล้อเห็ด',glyph:'mushroom'},
  {cue:'10.02',name:'Chat Whack-a-Mole',short:'คัดกรองแชต',glyph:'chat'},
  {cue:'11.02',name:'Company Shield',short:'ปกป้องลูกค้า',glyph:'shield'},
  {cue:'14.01',name:'Missing Piece',short:'เติมชิ้นส่วนภาพ',glyph:'piece'},
];

function WaitGlyph({name}:{name:WaitGame['glyph']|'slide'}) {
  const common={fill:'none',stroke:'currentColor',strokeWidth:3,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <svg viewBox="0 0 160 160" role="img" aria-label={name==='slide'?'สไลด์':games.find(g=>g.glyph===name)?.short}>
    {name==='slide'&&<g {...common}><rect x="18" y="25" width="124" height="92" rx="10"/><path d="M18 46h124M38 67h84M38 85h57M55 117v19m50-19v19m-64 0h78"/></g>}
    {name==='rope'&&<g {...common}><path d="M17 81c19-21 38 21 63 0s44 21 63 0"/><path d="M18 96c19-21 38 21 62 0s44 21 62 0"/><path d="M80 54v52m-10-39 20 30m0-30-20 30"/><circle cx="80" cy="80" r="6" fill="currentColor" stroke="none"/></g>}
    {name==='image'&&<g {...common}><rect x="22" y="26" width="116" height="108" rx="16"/><circle cx="58" cy="59" r="10"/><path d="m33 116 34-34 20 19 16-16 24 31"/><path d="M56 12v21m48 94v21M10 80h22m96 0h22"/></g>}
    {name==='caption'&&<g {...common}><path d="M19 28h91a14 14 0 0 1 14 14v43a14 14 0 0 1-14 14H66l-27 22v-22h-7a14 14 0 0 1-14-14V42a14 14 0 0 1 14-14Z"/><path d="M45 57h54M45 75h38"/><path d="M121 26v22m-11-11h22"/></g>}
    {name==='mushroom'&&<g {...common}><path d="M25 71c3-30 25-50 55-50s52 20 55 50H25Z"/><path d="M63 72h34l7 60H56l7-60Z"/><path d="M51 47h.1m27-9h.1m28 15h.1" strokeWidth="8"/><path d="M34 88h92"/></g>}
    {name==='chat'&&<g {...common}><path d="M22 28h91a18 18 0 0 1 18 18v44a18 18 0 0 1-18 18H69l-30 22v-22h-7a18 18 0 0 1-18-18V46a18 18 0 0 1 18-18Z"/><path d="m54 55 34 34m0-34L54 89"/></g>}
    {name==='shield'&&<g {...common}><path d="M80 17 128 36v35c0 32-19 55-48 72-29-17-48-40-48-72V36l48-19Z"/><path d="m55 78 17 17 34-37"/></g>}
    {name==='piece'&&<g {...common}><path d="M26 28h38a16 16 0 1 1 32 0h38v39a16 16 0 1 0 0 32v33H94a16 16 0 1 0-32 0H26V94a16 16 0 1 0 0-32V28Z"/><path d="m82 54 24 24m-20 4 18 18"/></g>}
  </svg>;
}

export default function WaitingStage({
  code,cue,nickname,group,groupSize,online,
}:{code:string;cue:string;nickname:string;group:string;groupSize:number;online:boolean}) {
  const game=games.find(item=>item.cue===cue);
  return <main className="wait-stage" aria-live="polite">
    <section className="wait-card">
      <div className={`wait-art ${game?`wait-${game.glyph}`:'wait-slide'}`}>
        <div className="wait-orbit wait-orbit-one" aria-hidden="true"/><div className="wait-orbit wait-orbit-two" aria-hidden="true"/>
        <span className="wait-orbit-point" aria-hidden="true"/><div className="wait-glyph"><WaitGlyph name={game?.glyph??'slide'}/></div>
      </div>
      <div className="wait-copy">
        <div className="wait-status"><i className={online?'is-online':'is-offline'}/>{online?'เชื่อมต่อแล้ว':'กำลังเชื่อมต่อใหม่'}</div>
        <p className="wait-eyebrow">ห้อง {code}</p>
        <h1>{game?'รอเริ่มเกม':'รอเกมถัดไป'}</h1>
        <p className="wait-game-name">{game?game.name:'ตามสไลด์ของผู้จัด'}</p>
        <p className="wait-instruction">{game?'เมื่อผู้จัดกดเริ่ม หน้าจะเปลี่ยนเอง':'คุณอยู่ในห้องแล้ว ไม่ต้องสแกนซ้ำ'}</p>
        <div className="wait-player"><span>{nickname}</span><b>{group}</b></div>
        <div className="wait-roster"><span>สมาชิกกลุ่มตอนนี้</span><strong>{groupSize}</strong></div>
      </div>
    </section>
  </main>;
}
