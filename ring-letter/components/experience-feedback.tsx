'use client';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

async function post(data:object){
  const r=await fetch('/api/letter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const d=await r.json() as {error?:string};if(!r.ok)throw new Error(d.error||'暫時無法儲存，請稍後再試。');return d;
}
type FeedbackContextValue={consent:boolean;setConsent:(v:boolean)=>void;send:(story:string,kind:string,note?:string)=>Promise<void>;reset:()=>void};
const FeedbackContext=createContext<FeedbackContextValue|null>(null);
export function FeedbackProvider({children}:{children:ReactNode}){
  const [consent,setConsent]=useState(false);
  const session=useRef<Promise<unknown>|null>(null);
  async function send(story:string,kind:string,note=''){
    if(!consent)throw new Error('請先勾選同意保存回饋；不勾選也可以繼續閱讀。');
    if(!session.current)session.current=post({action:'session'}).catch(e=>{session.current=null;throw e;});
    await session.current;
    try{await post({action:'feedback',story,kind,note,consent:true});}catch(e){session.current=null;throw e;}
  }
  return <FeedbackContext.Provider value={{consent,setConsent,send,reset:()=>{session.current=null;setConsent(false);}}}>{children}</FeedbackContext.Provider>;
}
export function useFeedback(){const v=useContext(FeedbackContext);if(!v)throw new Error('FeedbackProvider required');return v;}
export function FeedbackConsent(){const {consent,setConsent}=useFeedback();return <label className="check feedback-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>我已滿 18 歲，同意團隊保存這次回饋與接下來的讀信、換信次數，供改善網站使用。只在本次頁面有效，可隨時取消；資料提供 30 天存取，可在「我的片段」刪除。不勾選也能讀信與投稿。</label>;}
export function SiteFeedback({page}:{page:string}){
  const {consent,send}=useFeedback();const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);setError('');setStatus('');
    const note=JSON.stringify({page,category:f.get('category'),purpose:f.get('purpose'),situation:f.get('situation'),message:String(f.get('message')||'').trim()});
    try{await send('site','site_feedback',note);setStatus('謝謝，回饋已送到團隊的管理信箱。你可以繼續閱讀，不需要等我們回覆。');form.reset();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <details id="site-feedback" className="site-feedback feedback-box" key={page}><summary>使用上卡住了？留一點回饋給我們</summary><p className="quiet">不用寫得完整。一個不懂的地方，或一個希望保留的細節，都能幫助我們。</p><form onSubmit={submit} className="feedback-form"><label>想告訴我們什麼？<select name="category" required><option value="">請選擇</option><option>看不懂網站在做什麼</option><option>操作或畫面有問題</option><option>讀完的感受</option><option>投稿不順利</option><option>希望增加或保留的功能</option></select></label><label>這次來，最想做什麼？（選填）<select name="purpose"><option value="">先不回答</option><option>讀到類似經歷，感覺有人理解</option><option>記下自己的心情</option><option>分享過去，讓別人參考</option><option>只是好奇看看</option></select></label><label>最近比較接近哪種情境？（選填）<select name="situation"><option value="">先不回答</option><option>職涯轉折</option><option>搬家獨居</option><option>感情</option><option>家人關係</option><option>其他／沒有特定情境</option></select></label><label>哪裡卡住了，或希望怎麼改？（選填）<textarea name="message" rows={3} maxLength={300} placeholder="最多 300 字。請不要留下姓名、聯絡方式或他人的私密資訊。"/></label><p className="quiet">回饋僅供管理團隊查看，不會成為公開信件，也不是寫給信件作者的回音。</p><FeedbackConsent/><button className="secondary" disabled={busy||!consent}>{busy?'正在送出…':'送出使用回饋'}</button>{error&&<p role="alert">{error} 內容還在，可以稍後重試。</p>}{status&&<p role="status">{status}</p>}</form></details>;
}
