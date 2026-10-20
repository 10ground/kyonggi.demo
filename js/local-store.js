// IndexedDB stores photos and records offline. Export JSON before moving PCs.
function sampleNumber(row){const match=/^sample_(\d{3})$/.exec(row?.['옷_ID']||'');return match?String(Number(match[1])):'';}
const LocalCloset = (() => {
  const categories = {상의:['티셔츠','셔츠','블라우스','니트','맨투맨','후드'],하의:['청바지','슬랙스','반바지','스커트'],아우터:['재킷','코트','가디건','패딩'],운동복:['상의','하의','세트'],가방:['숄더백','백팩','크로스백'],주얼리:['목걸이','반지','귀걸이'],신발:['운동화','구두','부츠','샌들']};
  const seasons = ['여름','겨울','간절기','사계절'];
  const colors = ['블랙','그레이','화이트','베이지','브라운','네이비','카키','원색','혼합','메탈'];
  function seed() {
    const settings=[];
    const add=(type,values,parent='')=>values.forEach((v,i)=>settings.push({'설정종류':type,'상위값':parent,'값':v,'정렬':i}));
    add('대분류',Object.keys(categories));add('계절',seasons);add('색상',colors);
    Object.entries(categories).forEach(([k,v])=>add('중분류',v,k));
    const clothes=Array.from({length:100},(_,i)=>{
      const major=Object.keys(categories)[i%7],middle=categories[major][Math.floor(i/7)%categories[major].length];
      const r={'옷_ID':`sample_${String(i+1).padStart(3,'0')}`,'등록일':'2026-10-20','대분류':major,'중분류':middle,'계절':['가방','주얼리'].includes(major)?'사계절':seasons[Math.floor(i/7)%4],'메인색':colors[i%8],'이름':`샘플 ${i+1} ${middle}`,'상태':'보유중','메모':'제출 시연용 샘플 데이터'};
      r['검색텍스트']=Object.values(r).join(' ').toLowerCase();
      r['사진1']=SAMPLE_PHOTOS[major];r['대표사진']=r['사진1'];return r;
    });
    return {version:1,settings,clothes,outfits:[],undo:null,sampleExpansionV2:true};
  }
  const dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open('closet-local-submission',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('data');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('로컬 저장소를 열 수 없습니다. 일반 Chrome 또는 Edge 창에서 실행해 주세요.'));
  });
  async function transact(fn,write=true) {
    const db=await dbPromise;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('data',write?'readwrite':'readonly'),store=tx.objectStore('data');
      let result,failure;
      const request=store.get('state');
      request.onsuccess=()=>{try{const state=request.result||seed();if(!state.sampleExpansionV2){
        if(state.clothes.some(r=>r['옷_ID']==='sample_001')){
          const existing=new Set(state.clothes.map(r=>r['옷_ID']));
          state.clothes.push(...seed().clothes.slice(50).filter(r=>!existing.has(r['옷_ID'])));
        }
        state.sampleExpansionV2=true;
      }result=fn(state);if(write)store.put(state,'state');}catch(e){failure=e;tx.abort();}};
      tx.oncomplete=()=>resolve(result);
      tx.onabort=tx.onerror=()=>reject(failure||new Error('저장 실패: 브라우저 저장 공간을 확인해 주세요.'));
    });
  }
  const mappings={date:'등록일',majorCategory:'대분류',middleCategory:'중분류',subCategory:'소분류',season:'계절',mainColor:'메인색',subColor1:'세부색1',subColor2:'세부색2',name:'이름',memo:'메모',status:'상태'};
  function request(path,body) {
    return transact(state=>{
      if(body===undefined){
        const key={'/clothes':'clothes','/settings':'settings','/outfits':'outfits'}[path];
        if(!key)throw new Error('알 수 없는 요청');
        return {ok:true,rows:structuredClone(state[key])};
      }
      if(path==='/undo'){
        if(!state.undo)throw new Error('되돌릴 작업이 없습니다.');
        const {id,before}=state.undo,index=state.clothes.findIndex(r=>r['옷_ID']===id);
        if(before){if(index<0)state.clothes.push(before);else state.clothes[index]=before;}
        else if(index>=0)state.clothes.splice(index,1);
        state.undo=null;return {ok:true,message:'마지막 변경을 되돌렸습니다.'};
      }
      if(path==='/clothes/save'){
        const index=state.clothes.findIndex(r=>r['옷_ID']===body.id);
        if(body.id&&index<0)throw new Error('옷을 찾을 수 없습니다.');
        if(!body.majorCategory||!body.date)throw new Error('등록일과 대분류가 필요합니다.');
        const before=index<0?null:structuredClone(state.clothes[index]);
        const item=before?structuredClone(before):{'옷_ID':crypto.randomUUID()};
        Object.entries(mappings).forEach(([a,b])=>item[b]=String(body[a]||''));
        item['상태']=body.status||'보유중';item['계절']=body.season||'사계절';
        item['이름']=body.name||[body.mainColor,body.middleCategory||body.majorCategory].filter(Boolean).join(' ');
        const photos=body.photos||[];
        if(photos.length>4||photos.some(p=>!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data)))throw new Error('사진 형식을 확인해 주세요.');
        if(photos.length)for(let i=1;i<=4;i++){item[`사진${i}`]=photos[i-1]?.data||'';item[`사진파일ID${i}`]='';}
        const rep=Math.max(0,Math.min(Number(body.representativeIndex)||0,(photos.length||4)-1));
        item['대표사진']=item[`사진${rep+1}`]||'';item['대표사진파일ID']='';
        item['수정일']=new Date().toISOString();item['검색텍스트']=Object.values(mappings).map(k=>item[k]).join(' ').toLowerCase();
        if(index<0)state.clothes.push(item);else state.clothes[index]=item;
        state.undo={id:item['옷_ID'],before};return {ok:true,item:structuredClone(item)};
      }
      if(path==='/clothes/remove'){
        const item=state.clothes.find(r=>r['옷_ID']===body.id);if(!item)throw new Error('옷을 찾을 수 없습니다.');
        state.undo={id:body.id,before:structuredClone(item)};item['상태']='제거됨';return {ok:true,removed:body.id};
      }
      if(path==='/outfits/save'){
        const item={'코디_ID':body.id||crypto.randomUUID(),'이름':String(body.name||''),'옷ID목록':(body.items||[]).join(',')};
        const index=state.outfits.findIndex(r=>r['코디_ID']===item['코디_ID']);
        if(index<0)state.outfits.push(item);else state.outfits[index]=item;return {ok:true,item};
      }
      if(path==='/outfits/remove'){state.outfits=state.outfits.filter(r=>r['코디_ID']!==body.id);return {ok:true};}
      throw new Error('알 수 없는 요청');
    });
  }
  function validateBackup(data){
    if(data?.version!==1||!Array.isArray(data.clothes)||!Array.isArray(data.settings)||!Array.isArray(data.outfits))throw new Error('이 앱의 백업 파일이 아닙니다.');
    const ids=new Set();
    for(const r of data.clothes){
      if(!r||typeof r['옷_ID']!=='string'||ids.has(r['옷_ID'])||Object.values(r).some(v=>typeof v!=='string'))throw new Error('옷 데이터가 올바르지 않습니다.');
      for(const key of ['대표사진','사진1','사진2','사진3','사진4'])if(r[key]&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r[key]))throw new Error('백업에는 로컬 사진 데이터만 사용할 수 있습니다.');
      if(Object.values(r).some(v=>/[<>]/.test(v)))throw new Error('백업 텍스트에 HTML 태그를 사용할 수 없습니다.');
      ids.add(r['옷_ID']);
    }
    for(const r of data.settings)if(!r||['설정종류','상위값','값'].some(k=>typeof r[k]!=='string'||/[<>"'&]/.test(r[k])))throw new Error('설정 데이터가 올바르지 않습니다.');
    return {...data,undo:null,sampleExpansionV2:true};
  }
  return {request,seed,validateBackup,export:()=>transact(s=>structuredClone(s)),import:data=>{const valid=validateBackup(data);return transact(s=>{Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,valid);});}};
})();
