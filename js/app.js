function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
let settingsRows=[], clothes=[], selectedPhotos=[], representativeIndex=0, filters={major:'',season:'',color:''};
let pickerTarget=null, inputMode='home', currentScreen='input', prevNav=null, modalStack=[];
let viewPhotos=[], viewPhotoIdx=0, viewTouchStartX=0, viewDragDelta=0, viewDragging=false, viewBoxWidth=0;
let closetMode='major';
const WARDROBE_MAJOR=[{key:'상의',cls:'wd-top'},{key:'아우터',cls:'wd-top wd-outer'},{key:'운동복',cls:'wd-top'},{key:'하의',cls:'wd-bottom'},{key:'가방',cls:'wd-bottom'}];
const WARDROBE_MAJOR_SPLIT=['주얼리','신발'];
const WARDROBE_SEASON=['여름','겨울','간절기','사계절'];
const WARDROBE_MAJOR_FILTERS=['상의','하의','아우터','운동복','가방','주얼리','신발'];
const NO_SEASON_CATS=['가방','주얼리'];
let pickerCatKey='', pickerFilterValues=[], pickerHasFilter=true;
const selected={majorCategory:'',middleCategory:'',season:'',mainColor:'',subColor1:'',subColor2:'',filterMajor:'',filterSeason:'',filterColor:''};
function toast(msg,duration=1800){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),duration)}
function hideToast(){const t=$('#toast');clearTimeout(t._timer);t.classList.remove('show')}
async function apiGet(p){return LocalCloset.request(p)}
async function apiPost(p,b={}){return LocalCloset.request(p,b)}
let confirmCallback=null;
function showConfirm(title,message,okLabel,onOk){
  $('#confirmTitle').textContent=title;
  $('#confirmMessage').textContent=message;
  $('#confirmOkBtn').textContent=okLabel;
  $('#confirmOkBtn').className='btn '+(okLabel==='제거'?'danger':'primary');
  confirmCallback=onOk;
  openModal('confirmModal');
}
function showSuccess(message){$('#successMessage').textContent=message;openModal('successModal')}
function closeSuccess(){closeModal('successModal')}
async function undoLastChange(){try{const d=await apiPost('/undo',{});await loadClothes();closeSuccess();toast(d.message||'마지막 작업을 취소했습니다');showInputHome()}catch(e){toast('취소 실패: '+e.message)}}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function options(type,parent){return settingsRows.filter(r=>r['설정종류']===type && (arguments.length<2 || r['상위값']===parent)).sort((a,b)=>(+a['정렬']||0)-(+b['정렬']||0)).map(r=>r['값'])}
const COLOR_STYLE={블랙:['#111','#fff'],화이트:['#fff','#222'],그레이:['#888','#fff'],베이지:['#d8c4a5','#2f2923'],네이비:['#17264a','#fff'],브라운:['#6b442e','#fff'],카키:['#6f7745','#fff'],원색:['#f3a6bd','#2f2923'],핑크:['#f3a6bd','#2f2923'],혼합:['checker','#2f2923'],메탈:['linear-gradient(135deg,#c0c0c0 0%,#e8e8e8 40%,#a8a8a8 60%,#d0d0d0 100%)','#2f2923'],기타:['#f0dfcb','#2f2923']};
const COLOR_GROUPS=[['블랙','그레이','화이트'],['베이지','브라운',null],['네이비','카키',null],['원색','혼합','메탈']];
function colorStyle(v){const c=COLOR_STYLE[v]; if(!c)return ''; return `style="background:${c[0]};color:${c[1]};border-color:rgba(0,0,0,.18)"`}
function colorSwatch(v,c1,c2){if(v==='혼합'){const a=c1&&COLOR_STYLE[c1]?COLOR_STYLE[c1][0]:'#111';const b=c2&&COLOR_STYLE[c2]?COLOR_STYLE[c2][0]:'#fff';return `<div class="color-swatch checker"><span style="background:${a}"></span><span style="background:${b}"></span><span style="background:${b}"></span><span style="background:${a}"></span></div>`;}const c=COLOR_STYLE[v];const bg=c?c[0]:'#eee';return `<div class="color-swatch" style="background:${bg}"></div>`;}
function applySelectVisual(id,value){const el=$('#'+id); if(!el)return; el.textContent=value||'선택 안함'; el.classList.toggle('empty',!value); el.removeAttribute('style'); if(['mainColor','subColor1','subColor2','filterColor'].includes(id)&&value&&value!=='혼합') el.setAttribute('style', colorStyle(value).replace(/^style="|"$/g,''));}
function setSelect(id,value){selected[id]=value||''; applySelectVisual(id,value); if(!id.startsWith('filter')) updateProgressiveFields();}
function initSelect(id,title,getOpts){const el=$('#'+id); if(!el)return; el.addEventListener('click',()=>openPicker(id,title,getOpts()))}
function openPicker(id,title,opts){
  pickerTarget=id; $('#pickerTitle').textContent=title;
  const allowBlank=['subColor1','subColor2','filterMajor','filterSeason','filterColor'].includes(id);
  const isColor=['mainColor','subColor1','subColor2','filterColor'].includes(id);
  if(isColor){
    let html=allowBlank?`<button class="picker-option color-blank-opt" data-pick="">선택 안함</button>`:'';
    const sheetColors=new Set(opts);
    const grouped=new Set();
    html+=COLOR_GROUPS.map(row=>{
      const cells=row.map(v=>{if(!v)return '<div></div>';if(!sheetColors.has(v))return '<div></div>';grouped.add(v);return `<button class="picker-option color-option" data-pick="${v}">${colorSwatch(v)}${v}</button>`;});
      return cells.every(c=>c==='<div></div>')?'':`<div class="color-group-row">${cells.join('')}</div>`;
    }).join('');
    const extra=opts.filter(v=>!grouped.has(v));
    if(extra.length)html+=`<div class="color-group-row">${extra.map(v=>`<button class="picker-option color-option" data-pick="${v}">${colorSwatch(v)}${v}</button>`).join('')}</div>`;
    $('#pickerOptions').innerHTML=html;
  } else {
    const arr=allowBlank?['선택 안함',...opts]:opts;
    $('#pickerOptions').innerHTML=arr.map(v=>`<button class="picker-option" data-pick="${v==='선택 안함'?'':v}">${v}</button>`).join('');
  }
  openModal('pickerModal');
}
const PROGRESSIVE_FIELD_ORDER=['majorCategory','middleCategory','season','mainColor','subColor1','subColor2'];
function isFieldVisible(el){ return el && getComputedStyle(el).display!=='none'; }
function showField(id,label,show){
  const el=$('#'+id); if(!el) return;
  const wasVisible=isFieldVisible(el);
  el.style.display=show?'flex':'none';
  if(show && !wasVisible){ el.classList.remove('field-appear'); void el.offsetWidth; el.classList.add('field-appear'); }
  if(!show) el.classList.remove('field-appear','field-next');
}
function updateNextFieldHighlight(){
  const next=PROGRESSIVE_FIELD_ORDER.find(id=>{ const el=$('#'+id); return isFieldVisible(el) && !selected[id]; });
  PROGRESSIVE_FIELD_ORDER.forEach(id=>{ const el=$('#'+id); if(el) el.classList.toggle('field-next', id===next); });
}
function updateProgressiveFields(){
  const hasMajor=!!selected.majorCategory, hasMiddle=!!selected.middleCategory;
  const noSeason=NO_SEASON_CATS.includes(selected.majorCategory);
  const midDone=hasMajor && (hasMiddle || !options('중분류', selected.majorCategory).length);
  showField('middleCategory','중분류',hasMajor);
  const showSeason=!noSeason && midDone;
  showField('season','계절',showSeason);
  if(!showSeason && selected.season){selected.season='';applySelectVisual('season','')}
  const showColor=noSeason ? midDone : !!selected.season;
  showField('mainColor','색',showColor);
  if(!showColor && selected.mainColor){selected.mainColor='';applySelectVisual('mainColor','')}
  const mixed=selected.mainColor==='혼합';
  if(!mixed){selected.subColor1='';selected.subColor2='';applySelectVisual('subColor1','');applySelectVisual('subColor2','')}
  showField('subColor1','혼합색1',mixed);
  showField('subColor2','혼합색2',mixed && !!selected.subColor1);
  updateNextFieldHighlight();
}
function updateActiveTab(){
  $$('.tab').forEach(b=>{
    const action=b.dataset.action, target=b.dataset.target;
    if(action==='undo'){b.classList.remove('active');return}
    if(action==='home') b.classList.toggle('active',currentScreen==='input'&&inputMode==='home');
    else if(action==='new') b.classList.toggle('active',currentScreen==='input'&&inputMode!=='home');
    else b.classList.toggle('active',target===currentScreen);
  });
}
function updateScrollLock(screen,mode){const needsScroll=screen==='input'&&mode!=='home';document.querySelector('main').style.overflow=needsScroll?'auto':'hidden';}
function switchScreen(id){closeAllModals();currentScreen=id;$$('.screen').forEach(x=>x.classList.toggle('active',x.id===id));$('#pageTitle').textContent=id==='input'?'입력':id==='search'?'검색':'옷장';if(id==='search')renderResults();if(id==='closet')renderWardrobe();Wardrobe3D.setActive(id==='closet');updateActiveTab();updateScrollLock(id,inputMode)}
function setInputMode(mode){
  inputMode=mode;
  const isHome=mode==='home', isCreate=mode==='create', isEdit=mode==='edit';
  $('#inputHome')?.classList.toggle('hidden',!isHome);
  $('#inputForm')?.classList.toggle('hidden',isHome);
  $('#saveBtn')?.classList.toggle('hidden',!isCreate);
  $('#updateBtn')?.classList.toggle('hidden',!isEdit);
  $('#removeBtn')?.classList.toggle('hidden',!isEdit);
  if($('#pageTitle')) $('#pageTitle').textContent=isHome?'홈':isCreate?'새옷 추가':'옷 관리';
  updateActiveTab();updateScrollLock(currentScreen,mode);
}
function openModal(id){if(!modalStack.includes(id))modalStack.push(id);$('#'+id).classList.add('show');document.body.style.overflow='hidden'}
function closeModal(id){if(id==='outfitPickerModal'){Wardrobe3D.close();$('#wardrobeHint').classList.remove('hidden');$('#closetModeToggle').classList.remove('hidden');}modalStack=modalStack.filter(m=>m!==id);const el=$('#'+id);if(el)el.classList.remove('show');if(id==='confirmModal')confirmCallback=null;if(!modalStack.length)document.body.style.overflow=''}
function closeTopModal(){if(!modalStack.length)return;closeModal(modalStack[modalStack.length-1])}
function anyModalOpen(){return modalStack.length>0}
function closeAllModals(){[...modalStack].reverse().forEach(id=>closeModal(id));modalStack=[]}
function showInputHome(){closeAllModals();prevNav=null;switchScreen('input');setInputMode('home')}
function startCreate(){switchScreen('input');clearForm();setInputMode('create')}
function goBack(){if(anyModalOpen()){closeTopModal();return}if(prevNav){const p=prevNav;prevNav=null;if(p.screen==='input'){switchScreen('input');setInputMode(p.inputMode)}else switchScreen(p.screen)}else{switchScreen('input');setInputMode('home')}}
function openFullscreenPhoto(src){if(!src)return;$('#photoFullscreenImg').src=src;$('#photoFullscreen').style.display='flex'}
function syncThumbs(){$$('#viewThumbStrip .thumb').forEach((t,i)=>t.classList.toggle('active',i===viewPhotoIdx))}
function setViewTrackPos(trackPos,animate){
  const track=$('#viewSlideTrack'); if(!track)return;
  track.style.transition=animate?'transform .3s cubic-bezier(.25,.46,.45,.94)':'none';
  track.style.transform=`translateX(${-trackPos*100}%)`;
}
function goToPhotoLogical(logicalIdx,animate){
  viewPhotoIdx=((logicalIdx%viewPhotos.length)+viewPhotos.length)%viewPhotos.length;
  setViewTrackPos(viewPhotoIdx+1,animate);
  syncThumbs();
}
function buildViewSlideTrack(){
  const track=$('#viewSlideTrack'), box=$('#viewPhotoBox'), ph=$('#viewNoPhoto');
  if(!viewPhotos.length){track.innerHTML='';track.style.transform='translateX(0)';box.classList.remove('has-photo');if(ph)ph.style.display='';return}
  box.classList.add('has-photo');if(ph)ph.style.display='none';
  const srcs=viewPhotos.map(p=>p.url||p.preview);
  const all=[srcs[srcs.length-1],...srcs,srcs[0]];
  track.innerHTML=all.map(src=>`<img class="view-slide-img" src="${src}" />`).join('');
  goToPhotoLogical(viewPhotoIdx,false);
}
function openViewModal(id){
  const r=clothes.find(x=>x['옷_ID']===id); if(!r) return;
  for(const el of [$('#viewPhotoBox'),$('#photoFullscreen')]){const number=sampleNumber(r);if(number)el.dataset.sampleNumber=number;else delete el.dataset.sampleNumber;}
  $('#viewName').textContent=r['이름']||r['옷_ID'];
  $('#viewClothId').textContent=r['옷_ID'];
  viewPhotos=existingPhotosFromRow(r);
  if(!viewPhotos.length){const s=imageUrl(r);if(s)viewPhotos=[{url:s}]}
  viewPhotoIdx=0;
  const strip=$('#viewThumbStrip');
  if(viewPhotos.length>1){strip.className='view-thumb-strip has-thumbs';strip.innerHTML=viewPhotos.map((p,i)=>`<button class="thumb${i===0?' active':''}" data-vthumb="${i}" type="button"><img src="${p.url||p.preview}"/></button>`).join('')}
  else{strip.className='view-thumb-strip';strip.innerHTML=''}
  buildViewSlideTrack();
  const has중=!!r['중분류'];
  const 메인=r['메인색']||'';const s1=r['세부색1']||'';const s2=r['세부색2']||'';
  function renderColorValue(){
    if(!메인)return '';
    if(메인==='혼합'&&(s1||s2)){
      const label=[s1,s2].filter(Boolean).join('/');
      return `<div class="view-color-display">${colorSwatch('혼합',s1,s2)}<span>${label}</span></div>`;
    }
    const singles=[메인,s1,s2].filter(Boolean);
    return singles.map(v=>`<div class="view-color-display">${colorSwatch(v)}<span>${escapeHtml(v)}</span></div>`).join('');
  }
  const 색상HTML=renderColorValue();
  const infoRow=([l,v])=>`<div class="view-info-row"><span class="view-info-label">${escapeHtml(l)}</span><span class="view-info-value">${escapeHtml(v)}</span></div>`;
  const colorRow=`<div class="view-info-row"><span class="view-info-label">색상</span><div class="view-info-colors">${색상HTML}</div></div>`;
  const leftTopItems=has중?[['분류',[r['대분류'],r['중분류']].join(' / ')]].filter(([,v])=>v):[['대분류',r['대분류']||'']].filter(([,v])=>v);
  const leftBotItems=[['계절',r['계절']||'']].filter(([,v])=>v);
  const leftHTML=leftTopItems.map(infoRow).join('')+(색상HTML?colorRow:'')+leftBotItems.map(infoRow).join('');
  const rightItems=[['등록일',(r['등록일']||'').slice(0,10)],['상태',r['상태']||'보유중']].filter(([,v])=>v);
  const memo=r['메모']?`<div class="view-info-memo">${infoRow(['메모',r['메모']])}</div>`:'';
  $('#viewInfo').innerHTML=`<div class="view-info-cols"><div class="view-info-col">${leftHTML}</div><div class="view-info-col">${rightItems.map(infoRow).join('')}</div></div>${memo}`;
  $('#viewEditBtn').dataset.viewEditId=id;
  openModal('viewModal');
}
function startEdit(){switchScreen('input');setInputMode('edit')}
function applySettings(){ if(!selected.majorCategory) setSelect('majorCategory',''); updateMiddleOptions(); updateProgressiveFields(); }
function updateMiddleOptions(){ const mids=options('중분류',selected.majorCategory); if(selected.middleCategory&&!mids.includes(selected.middleCategory)) selected.middleCategory=''; setSelect('middleCategory',selected.middleCategory); }
function readFileAsDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
function _drawToJpeg(src,w,h,maxDim,quality){if(Math.max(w,h)>maxDim){const s=maxDim/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(src,0,0,w,h);return c.toDataURL('image/jpeg',quality)}
async function compressImage(file,maxDim=1080,quality=.62){
  try{const dataUrl=await readFileAsDataURL(file);const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('img decode 실패'));im.src=dataUrl});return _drawToJpeg(img,img.width,img.height,maxDim,quality)}
  catch(e){ // <img> 디코드 실패(HEIC 등 일부 브라우저) 시 createImageBitmap 폴백
    if(typeof createImageBitmap==='function'){const bmp=await createImageBitmap(file);try{return _drawToJpeg(bmp,bmp.width,bmp.height,maxDim,quality)}finally{if(bmp.close)bmp.close()}}
    throw e;
  }
}
function showPhoto(src){const b=$('#photoBox'),i=$('#photoPreview');if(src){i.src=src;b.classList.add('has-photo')}else{i.removeAttribute('src');b.classList.remove('has-photo')}} 
function renderPhotos(){
  const src = selectedPhotos[representativeIndex]?.preview || selectedPhotos[representativeIndex]?.url || '';
  showPhoto(src);
  const strip=$('#thumbStrip');
  if(selectedPhotos.length<=1){strip.innerHTML='';strip.style.display='none';return}
  strip.style.display='grid';
  strip.innerHTML=selectedPhotos.map((p,i)=>`<button class="thumb ${i===representativeIndex?'active':''}" data-thumb="${i}" type="button"><img src="${p.preview||p.url}" /></button>`).join('');
}
function existingPhotosFromRow(r){const out=[];for(let i=1;i<=4;i++){if(r[`사진${i}`])out.push({url:r[`사진${i}`],link:r[`사진${i}`],fileId:""})}return out}
function formData(){return{id:$('#clothId').value,date:$('#dateInput').value,majorCategory:selected.majorCategory,middleCategory:selected.middleCategory,season:selected.season,mainColor:selected.mainColor,subColor1:selected.subColor1,subColor2:selected.subColor2,name:$('#nameInput').value,memo:$('#memoInput').value,status:'보유중',photos:selectedPhotos.filter(p=>p.data).map(p=>({name:p.name,data:p.data})),representativeIndex}}
function clearForm(){ $('#clothId').value=''; $('#clothIdDisplay').textContent='새옷-ID없음'; $('#dateInput').value=today(); $('#nameInput').value=''; $('#memoInput').value=''; selectedPhotos=[]; representativeIndex=0; $('#photoInput').value=''; renderPhotos(); Object.assign(selected,{majorCategory:'',middleCategory:'',season:'',mainColor:'',subColor1:'',subColor2:''}); ['majorCategory','middleCategory','season','mainColor','subColor1','subColor2'].forEach(id=>setSelect(id,selected[id])); updateProgressiveFields(); }
function editItem(id){const r=clothes.find(x=>x['옷_ID']===id);if(!r)return;startEdit();$('#clothId').value=r['옷_ID']||'';$('#clothIdDisplay').textContent=r['옷_ID']||'새옷-ID없음';$('#dateInput').value=(r['등록일']||today()).slice(0,10);selected.majorCategory=r['대분류']||'';selected.middleCategory=r['중분류']||r['소분류']||'';selected.season=r['계절']||'';selected.mainColor=r['메인색']||'';selected.subColor1=r['세부색1']||'';selected.subColor2=r['세부색2']||'';['majorCategory','middleCategory','season','mainColor','subColor1','subColor2'].forEach(id=>setSelect(id,selected[id]));$('#nameInput').value=r['이름']||'';$('#memoInput').value=r['메모']||'';selectedPhotos=existingPhotosFromRow(r);representativeIndex=Math.max(0,selectedPhotos.findIndex(p=>p.url===r['대표사진'])); if(representativeIndex<0) representativeIndex=0; renderPhotos();toast(`${id} 수정 모드`)}
async function saveItem(){const b=formData();if(!b.date)return toast('날짜를 입력해줘');if(!b.majorCategory)return toast('대분류를 선택해줘');const isEdit=!!b.id;const label=isEdit?'수정':'저장';const msg=isEdit?`${b.id} 을(를) 수정하시겠습니까?`:`새 옷을 저장하시겠습니까?`;showConfirm(label,msg,label,async()=>{const btn=isEdit?$('#updateBtn'):$('#saveBtn');try{if(btn)btn.disabled=true;toast(isEdit?'수정 중...':'저장 중...',30000);const d=await apiPost('/clothes/save',b);await loadClothes();hideToast();editItem(d.item['옷_ID']);showSuccess(isEdit?`${d.item['옷_ID']} 수정이 완료되었습니다.`:`${d.item['옷_ID']} 저장이 완료되었습니다.`)}catch(e){toast('저장 실패: '+e.message,6000)}finally{if(btn)btn.disabled=false}})}
async function removeItem(){const id=$('#clothId').value;if(!id)return;showConfirm('제거',`${id} 을(를) 제거하시겠습니까?`,'제거',async()=>{try{await apiPost('/clothes/remove',{id});await loadClothes();clearForm();showInputHome();showSuccess(`${id} 제거가 완료되었습니다.`)}catch(e){toast('제거 실패: '+e.message)}})}
function imageUrl(r){return r['대표사진']||''}
function numberedPhoto(r,wrapper,imgClass,noClass){const number=sampleNumber(r);return `<div class="${wrapper}"${number?` data-sample-number="${number}"`:''}>${imageUrl(r)?`<img class="${imgClass}" src="${imageUrl(r)}">`:`<div class="${noClass}"></div>`}</div>`;}
function filteredRows(){const q=$('#searchInput').value.trim().toLowerCase();return clothes.filter(r=>{if((r['상태']||'보유중')==='제거됨')return false;const text=(r['검색텍스트']||Object.values(r).join(' ')).toLowerCase();if(q&&!text.includes(q))return false;if(filters.major&&r['대분류']!==filters.major)return false;if(filters.season&&r['계절']!==filters.season)return false;if(filters.color&&![r['메인색'],r['세부색1'],r['세부색2']].includes(filters.color))return false;return true}).reverse()}
function renderFilterChips(){const vals=[filters.major,filters.season,filters.color].filter(Boolean);$('#activeFilters').innerHTML=vals.map(v=>`<span class="chip">${escapeHtml(v)}</span>`).join('')}
function renderResults(){renderFilterChips();const rows=filteredRows();if(!rows.length){$('#resultList').innerHTML='<div class="empty">검색 결과 없음</div>';return}$('#resultList').innerHTML=rows.map(r=>`<div class="cloth-card" data-view-id="${escapeHtml(r['옷_ID'])}">${numberedPhoto(r,'cloth-photo','cloth-img','cloth-img')}<div class="cloth-info"><strong>${escapeHtml(r['이름']||r['옷_ID'])}</strong><p>${escapeHtml(r['옷_ID'])} · ${escapeHtml(r['대분류'])}${r['중분류']?' · '+r['중분류']:''}${r['소분류']?' · '+r['소분류']:''}</p><p>${escapeHtml(r['계절'])} · ${[r['메인색'],r['세부색1'],r['세부색2']].filter(Boolean).join('/')}</p><p>${escapeHtml(r['메모']||'')}</p></div><button class="edit-btn" data-edit-id="${escapeHtml(r['옷_ID'])}">수정</button></div>`).join('')}
async function loadClothes(){const d=await apiGet('/clothes');clothes=d.rows||[];renderResults();Wardrobe3D.setData(clothes);if(modalStack.includes('outfitPickerModal'))renderWardrobePickerResults()}
async function refreshAll(){try{const s=await apiGet('/settings');settingsRows=s.rows||[];await loadClothes();applySettings();toast('로컬 데이터 불러옴')}catch(e){toast('불러오기 실패: '+e.message)}}
let wardrobeListView=false;
function updateWardrobeSelection(row,index,total,position=index){
  $('#wardrobePrev').disabled=!total||position===0;$('#wardrobeNext').disabled=!total||position===total-1;
}
function setWardrobeListView(value){
  wardrobeListView=value||Wardrobe3D.failed;
  $('#outfitPickerModal').classList.toggle('list-view',wardrobeListView);
  $('#outfitPickerOptions').classList.toggle('hidden',!wardrobeListView);
  $('#outfitPickerModal').classList.toggle('has-filters',pickerHasFilter);
  $('#wardrobeListToggle').textContent=wardrobeListView?'3D 보기':'목록 보기';
  $('#wardrobeListToggle').setAttribute('aria-pressed',String(wardrobeListView));
  $('#wardrobeListToggle').disabled=Wardrobe3D.failed;
}
function renderWardrobe(){
  Wardrobe3D.init($('#wardrobe'),{onOpen:openWardrobeCatPicker,onSelect:updateWardrobeSelection,onDetail:row=>openViewModal(row['옷_ID']),onFailure:message=>{if(message)toast(message,4000);setWardrobeListView(true);}});
  Wardrobe3D.setData(clothes);
}
async function openWardrobeCatPicker(key){
  if(Wardrobe3D.state!=='cabinet')return;

  pickerCatKey=key;
  const isSeason=closetMode==='season';
  let filterOptions;
  if(isSeason) filterOptions = key==='사계절' ? WARDROBE_MAJOR_FILTERS : WARDROBE_MAJOR_FILTERS.filter(v=>!NO_SEASON_CATS.includes(v));
  else filterOptions = NO_SEASON_CATS.includes(key) ? [] : WARDROBE_SEASON;
  pickerHasFilter=filterOptions.length>0;
  pickerFilterValues=[...filterOptions];
  $('#outfitPickerTitle').textContent=key+' 옷 보기';
  $('#filterClearAllBtn').classList.toggle('hidden',!pickerHasFilter);
  $('#outfitPickerFilters').innerHTML=filterOptions.map(v=>`<label class="picker-filter-check"><input type="checkbox" value="${v}" checked />${v}</label>`).join('');
  renderWardrobePickerResults();
  $('#wardrobeHint').classList.add('hidden');
  $('#closetModeToggle').classList.add('hidden');
  const opened=await Wardrobe3D.open(key,getWardrobePickerRows());
  if(opened&&currentScreen==='closet'){setWardrobeListView(false);openModal('outfitPickerModal');}
  else{$('#wardrobeHint').classList.remove('hidden');$('#closetModeToggle').classList.remove('hidden');}

}
function getWardrobePickerRows(){
  const isSeason=closetMode==='season';
  const rows=clothes.filter(r=>{
    if((r['상태']||'보유중')==='제거됨')return false;
    if(isSeason ? r['계절']!==pickerCatKey : r['대분류']!==pickerCatKey)return false;
    if(!pickerHasFilter)return true;
    const secondaryValue=isSeason?r['대분류']:r['계절'];
    return pickerFilterValues.includes(secondaryValue);
  });
  return rows;
}
function renderWardrobePickerResults(){
  const rows=getWardrobePickerRows();
  Wardrobe3D.setRows(rows);
  $('#wardrobeEmpty').classList.toggle('hidden',rows.length>0);
  $('#outfitPickerOptions').innerHTML=rows.length?rows.map(r=>`<button class="outfit-pick-option" data-view-id="${escapeHtml(r['옷_ID'])}" type="button">${numberedPhoto(r,'outfit-photo','outfit-pick-img','outfit-pick-noimg')}<span>${escapeHtml(r['이름']||r['옷_ID'])}</span></button>`).join(''):'<div class="empty">등록된 옷이 없음</div>';
}
function initEvents(){
  $$('.tab').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.action,t=b.dataset.target;if(a==='home')showInputHome();else if(a==='new')startCreate();else if(a==='back')goBack();else if(t)switchScreen(t)}));$('#refreshBtn').addEventListener('click',refreshAll);$('#newClothBtn').addEventListener('click',startCreate);$('#manageClothBtn').addEventListener('click',()=>switchScreen('search'));$('#closeInputBtn').addEventListener('click',showInputHome);$('#pickPhotoBtn').addEventListener('click',()=>$('#photoInput').click());$('#photoInput').addEventListener('change',async e=>{const rawFiles=[...e.target.files];const files=rawFiles.slice(0,4);selectedPhotos=[];representativeIndex=0;let _failed=0;for(const f of files){try{selectedPhotos.push({name:f.name,preview:URL.createObjectURL(f),data:await compressImage(f)})}catch(_e){_failed++}}renderPhotos(); if(_failed) toast(`사진 ${_failed}장 처리 실패(형식 확인). 나머지는 정상 첨부됨`,4000); else if(rawFiles.length>4) toast('사진은 최대 4장까지 가능')});$('#thumbStrip').addEventListener('click',e=>{const b=e.target.closest('[data-thumb]');if(!b)return;representativeIndex=Number(b.dataset.thumb);renderPhotos()});$('#saveBtn').addEventListener('click',saveItem);$('#updateBtn').addEventListener('click',saveItem);$('#removeBtn').addEventListener('click',removeItem);$('#searchInput').addEventListener('input',renderResults);$('#resultList').addEventListener('click',e=>{const editBtn=e.target.closest('[data-edit-id]');if(editBtn){prevNav={screen:currentScreen,inputMode};editItem(editBtn.dataset.editId);return}const card=e.target.closest('[data-view-id]');if(card){prevNav={screen:currentScreen,inputMode};openViewModal(card.dataset.viewId)}});
  initSelect('majorCategory','대분류',()=>options('대분류')); initSelect('middleCategory','중분류',()=>options('중분류',selected.majorCategory)); initSelect('season','계절',()=>options('계절')); initSelect('mainColor','색',()=>options('색상')); initSelect('subColor1','혼합색1',()=>options('색상').filter(v=>v!=='혼합')); initSelect('subColor2','혼합색2',()=>options('색상').filter(v=>v!=='혼합')); initSelect('filterMajor','대분류 필터',()=>options('대분류')); initSelect('filterSeason','계절 필터',()=>options('계절')); initSelect('filterColor','색상 필터',()=>options('색상'));
  $('#pickerOptions').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;setSelect(pickerTarget,b.dataset.pick); if(pickerTarget==='majorCategory'){selected.middleCategory='';updateMiddleOptions()} closeModal('pickerModal')});$('[data-close-picker]').addEventListener('click',()=>closeModal('pickerModal'));
  $('#filterBtn').addEventListener('click',()=>openModal('filterModal'));$('[data-close-modal]').addEventListener('click',()=>closeModal('filterModal'));$('#applyFilterBtn').addEventListener('click',()=>{filters={major:selected.filterMajor,season:selected.filterSeason,color:selected.filterColor};closeModal('filterModal');renderResults()});$('#resetFilterBtn').addEventListener('click',()=>{filters={major:'',season:'',color:''};setSelect('filterMajor','');setSelect('filterSeason','');setSelect('filterColor','');renderResults()});$('#successCloseBtn').addEventListener('click',closeSuccess);$('#successUndoBtn').addEventListener('click',undoLastChange);
  $('#confirmCancelBtn').addEventListener('click',()=>closeModal('confirmModal'));
  $('#confirmOkBtn').addEventListener('click',async()=>{const cb=confirmCallback;confirmCallback=null;closeModal('confirmModal');if(cb){try{await cb()}catch(e){toast('오류: '+e.message,6000)}}})
  $('#wardrobe').addEventListener('click',e=>{const b=e.target.closest('[data-cat-key]');if(!b)return;openWardrobeCatPicker(b.dataset.catKey)});
  $('#closetModeToggle').addEventListener('click',async e=>{const b=e.target.closest('[data-mode]');if(!b||b.disabled||b.dataset.mode===closetMode)return;
    const buttons=$$('#closetModeToggle .toggle-btn');buttons.forEach(x=>x.disabled=true);
    const changed=await Wardrobe3D.setMode(b.dataset.mode);
    if(changed){closetMode=b.dataset.mode;buttons.forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});}
    buttons.forEach(x=>x.disabled=false);
  });
  $('#wardrobePrev').addEventListener('click',()=>Wardrobe3D.step(-1));
  $('#wardrobeNext').addEventListener('click',()=>Wardrobe3D.step(1));
  $('#wardrobeListToggle').addEventListener('click',()=>setWardrobeListView(!wardrobeListView));
  document.addEventListener('keydown',e=>{if(currentScreen!=='closet'||modalStack.at(-1)!=='outfitPickerModal'||e.target.matches('input,textarea'))return;
    if(e.key==='ArrowLeft'){e.preventDefault();Wardrobe3D.step(-1);}if(e.key==='ArrowRight'){e.preventDefault();Wardrobe3D.step(1);}if(e.key==='Escape')closeModal('outfitPickerModal');
  });
  $('#outfitPickerOptions').addEventListener('click',e=>{const b=e.target.closest('[data-view-id]');if(!b)return;openViewModal(b.dataset.viewId)});
  $('#viewCloseTopBtn').addEventListener('click',()=>closeModal('viewModal'));
  $('#viewDismissBtn').addEventListener('click',()=>closeModal('viewModal'));
  $('#viewEditBtn').addEventListener('click',()=>{const id=$('#viewEditBtn').dataset.viewEditId;closeModal('viewModal');if(!prevNav)prevNav={screen:currentScreen,inputMode};editItem(id)});
  $('#viewThumbStrip').addEventListener('click',e=>{const b=e.target.closest('[data-vthumb]');if(!b)return;e.stopPropagation();goToPhotoLogical(Number(b.dataset.vthumb),true)});
  const vBox=$('#viewPhotoBox');
  vBox.addEventListener('touchstart',e=>{viewTouchStartX=e.touches[0].clientX;viewDragDelta=0;viewDragging=true;viewBoxWidth=vBox.offsetWidth;$('#viewSlideTrack').style.transition='none'},{passive:true});
  vBox.addEventListener('touchmove',e=>{if(!viewDragging||viewPhotos.length<=1)return;viewDragDelta=e.touches[0].clientX-viewTouchStartX;const offset=-(viewPhotoIdx+1)*100+(viewDragDelta/viewBoxWidth*100);$('#viewSlideTrack').style.transform=`translateX(${offset}%)`},{passive:true});
  vBox.addEventListener('touchend',e=>{
    if(!viewDragging)return;viewDragging=false;
    viewDragDelta=e.changedTouches[0].clientX-viewTouchStartX;
    if(Math.abs(viewDragDelta)>=viewBoxWidth*0.3&&viewPhotos.length>1){
      const dir=viewDragDelta<0?1:-1;const N=viewPhotos.length;
      if(dir===1&&viewPhotoIdx===N-1){setViewTrackPos(N+1,true);setTimeout(()=>{viewPhotoIdx=0;setViewTrackPos(1,false);syncThumbs()},320);}
      else if(dir===-1&&viewPhotoIdx===0){setViewTrackPos(0,true);setTimeout(()=>{viewPhotoIdx=N-1;setViewTrackPos(N,false);syncThumbs()},320);}
      else{goToPhotoLogical(viewPhotoIdx+dir,true);}
    }else{goToPhotoLogical(viewPhotoIdx,true);}
  },{passive:true});
  vBox.addEventListener('click',e=>{if(Math.abs(viewDragDelta)>8)return;const src=viewPhotos[viewPhotoIdx]?.url||viewPhotos[viewPhotoIdx]?.preview;openFullscreenPhoto(src)});
  $('#photoBox').addEventListener('click',e=>{if(!$('#photoBox').classList.contains('has-photo'))return;const p=selectedPhotos[representativeIndex];const src=p?.preview||p?.url;openFullscreenPhoto(src)});
  $('#photoFullscreen').addEventListener('click',()=>{$('#photoFullscreen').style.display='none'});
  $$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeTopModal()}));
  $('#outfitPickerFilters').addEventListener('change',e=>{const cb=e.target.closest('input[type=checkbox]');if(!cb)return;if(cb.checked){if(!pickerFilterValues.includes(cb.value))pickerFilterValues.push(cb.value)}else{pickerFilterValues=pickerFilterValues.filter(v=>v!==cb.value)}renderWardrobePickerResults()});
  $('#filterClearAllBtn').addEventListener('click',()=>{pickerFilterValues=[];$$('#outfitPickerFilters input[type=checkbox]').forEach(cb=>cb.checked=false);renderWardrobePickerResults()});
  $('[data-close-outfit-picker]').addEventListener('click',()=>closeModal('outfitPickerModal'));
}
document.addEventListener('DOMContentLoaded',async()=>{
  $('#wardrobeShell').append($('#outfitPickerModal'));

  $('#exportBackup').addEventListener('click',async()=>{try{
    const blob=new Blob([JSON.stringify(await LocalCloset.export(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`closet-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(e){toast(e.message,6000)}});
  $('#importBackup').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;
    try{const data=LocalCloset.validateBackup(JSON.parse(await file.text()));
      showConfirm('백업 불러오기','현재 로컬 데이터를 이 백업으로 교체합니다. 먼저 현재 데이터를 백업해 주세요.','불러오기',async()=>{await LocalCloset.import(data);await refreshAll();clearForm();showInputHome();toast('백업을 불러왔습니다.');});
    }catch(err){toast('불러오기 실패: '+err.message,6000)}finally{e.target.value='';}
  });
initEvents();renderWardrobe();clearForm();setInputMode('home');await refreshAll()});
