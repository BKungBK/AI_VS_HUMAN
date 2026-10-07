import ReactDOM from 'react-dom/client';
import {lazy,Suspense} from 'react';
import './style.css';
const gameRoute=/^\/(games|play|presenter|display)(\/|$)/.test(location.pathname);
// Keep the import expressions in separate callbacks so Vite associates each CSS chunk correctly.
const GameView=lazy(()=>import('./game-client/GameApp'));
const DeckView=lazy(()=>import('./App'));
const View=gameRoute?GameView:DeckView;
ReactDOM.createRoot(document.getElementById('root')!).render(<Suspense fallback={<p style={{padding:24,color:'#f8f9fa'}}>กำลังโหลด…</p>}><View/></Suspense>);
