// 리뷰노트 → 우리 앱으로 지원자 목록을 넘기는 북마크(즐겨찾기) 버튼.
// 리뷰노트 비밀번호를 앱에 저장하지 않으려고, 이미 로그인된 리뷰노트 화면에서
// 사용자가 직접 누르면 그 화면이 쓰는 지원자 목록을 읽어 우리 앱 창으로 보낸다.
// 연락처·주소는 보내지 않고 이름·블로그 아이디·리뷰노트 점수만 보낸다.
//
// 리뷰노트 내부 주소 (2026-10-28 확인):
// - /api/campaign?id=  캠페인 정보 (title, status, currentTurn, infNum)
// - /api/applies/applied?campaignId=&turn=&limit=100&page=0..  모집 중 지원자 (status SELECT 일 때)
// - /api/applies/progress?campaignId=&campaignCurrentTurn=  선정된 사람 (체험 중일 때)

export const REVIEWNOTE_ORIGINS = ["https://www.reviewnote.co.kr", "https://reviewnote.co.kr"];

export function buildBookmarklet(appOrigin: string): string {
  const src = `(async()=>{
const APP=${JSON.stringify(appOrigin)};
const m=location.pathname.match(/campaigns\\/(\\d+)/);
if(!/reviewnote\\.co\\.kr$/.test(location.hostname)||!m){alert('리뷰노트 > 체험단 관리 > 캠페인을 연 화면에서 눌러 주세요.');return}
const id=m[1];
const w=window.open(APP+'/recruit?from=reviewnote','_blank');
if(!w){alert('팝업이 막혔어요. 팝업 허용 후 다시 눌러 주세요.');return}
try{
const c=await (await fetch('/api/campaign?id='+id)).json();
const turn=c.currentTurn||1;let list=[];
for(let p=0;p<10;p++){const r=await fetch('/api/applies/applied?campaignId='+id+'&turn='+turn+'&limit=100&page='+p);if(!r.ok)break;const d=await r.json();const o=Array.isArray(d)?d:(d.objects||[]);list=list.concat(o);if(o.length<100)break}
let stage='applied';
if(!list.length){const r=await fetch('/api/applies/progress?campaignId='+id+'&campaignCurrentTurn='+turn);if(r.ok){list=await r.json();stage='selected'}}
const applicants=list.filter(a=>a&&a.user&&(a.user.blogId||a.user.blog)).map(a=>{const u=a.user;let b=u.blogId;if(!b){const mm=String(u.blog).match(/blog\\.naver\\.com\\/([A-Za-z0-9_-]+)/);b=mm&&mm[1]}return{blogId:b,name:u.name||null,rn:{applyId:a.id,exposureScore:u.exposureScore,avgVisit:u.blogAvgFiveDailyVisit,penaltyCount:u.penaltyCount,cancelCount:u.cancelCount,valuation:u.valuation,isInfluence:u.isInfluence}}}).filter(a=>a.blogId);
if(!applicants.length){alert('지원자 블로그를 찾지 못했어요.');return}
const msg={type:'reviewnote-applicants',campaign:{id:String(id),title:c.title||null,infNum:c.infNum||null,stage,offer:c.offer||null,keywords:[c.keyword1,c.keyword2,c.keyword3].filter(Boolean),information:c.information||null,possibleDays:c.possibleDays||null,possibleTime:c.possibleTime||null,scheduleInformation:c.scheduleInformation||null},applicants};
let done=false;const onAck=e=>{if(e.origin===APP&&e.data==='reviewnote-ack'){done=true;window.removeEventListener('message',onAck)}};
window.addEventListener('message',onAck);
for(let i=0;i<60&&!done;i++){w.postMessage(msg,APP);await new Promise(r=>setTimeout(r,500))}
if(!done)alert('앱 창이 응답하지 않았어요. 앱에 로그인돼 있는지 확인해 주세요.');
}catch(e){alert('지원자 목록을 읽지 못했어요: '+e.message)}
})()`;
  return "javascript:" + encodeURIComponent(src.replace(/\n/g, ""));
}
