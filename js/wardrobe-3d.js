/* Procedural cabinet + cover flow adapted from the supplied 3d_cover_flow_wardrobe.html.
   All geometry is built in JavaScript; Three.js and GSAP are bundled locally. */
window.Wardrobe3D = (() => {
  const layout = {
    major: [
      ['상의',-2.66,1.5,2.5,5.35,'door'],['아우터',0,1.5,2.5,5.35,'door'],['운동복',2.66,1.5,2.5,5.35,'door'],
      ['하의',-2.66,-2.75,2.5,2.8,'drawer'],['가방',0,-2.75,2.5,2.8,'drawer'],
      ['주얼리',2.66,-2.01,2.5,1.32,'drawer'],['신발',2.66,-3.49,2.5,1.32,'drawer']
    ],
    season: [['여름',-2.03,2.17,3.8,4.0,'door'],['겨울',2.03,2.17,3.8,4.0,'door'],['간절기',-2.03,-2.05,3.8,4.0,'door'],['사계절',2.03,-2.05,3.8,4.0,'door']]
  };
  let host,canvas,scene,camera,renderer,cabinet,room,viewer,rail,faceGroups={},cells=[],labels=[],items=[];
  let mode='major',state='cabinet',active=false,frame=0,timeline=null,resolveTransition=null,selected=null;
  let rows=[],allRows=[],onSelect=()=>{},onOpen=()=>{},onDetail=()=>{},onFailure=()=>{},failed=false,ready=false;
  let scroll=0,targetScroll=0,drag=null,lastTime=0,textures=new Map(),selectedCell=null;
  let baseCamera,baseTarget,look,raycaster,mouse,photoGeo,hookGeo,hookMat;
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const duration=n=>reduced()?0.01:n;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dom=id=>document.getElementById(id);
  function mesh(w,h,d,material,x=0,y=0,z=0,parent=cabinet){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function material(color,roughness=.65,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
  function init(element,callbacks={}){
    if(ready)return;host=element;onSelect=callbacks.onSelect||onSelect;onOpen=callbacks.onOpen||onOpen;onDetail=callbacks.onDetail||onDetail;onFailure=callbacks.onFailure||onFailure;
    try{
      if(!window.THREE||!window.gsap)throw Error('3D 라이브러리를 불러오지 못했습니다.');
      scene=new THREE.Scene();scene.background=new THREE.Color('#ece8e0');
      camera=new THREE.PerspectiveCamera(42,1,.1,250);look=new THREE.Vector3();
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.outputEncoding=THREE.sRGBEncoding;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
      canvas=renderer.domElement;canvas.className='wardrobe-canvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
      scene.add(new THREE.HemisphereLight(0xfff8e9,0x504a43,.9));
      const key=new THREE.DirectionalLight(0xfff4df,1.65);key.position.set(-8,14,16);key.castShadow=true;
      key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-12,right:12,top:14,bottom:-12});key.shadow.normalBias=.04;scene.add(key);
      const fill=new THREE.DirectionalLight(0xc9dcff,.6);fill.position.set(10,4,-6);scene.add(fill);
      room=new THREE.Group();scene.add(room);
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),material('#e4dfd5'));floor.rotation.x=-Math.PI/2;floor.position.y=-4.85;floor.receiveShadow=true;room.add(floor);
      cabinet=new THREE.Group();scene.add(cabinet);
      const wood=material('#c9ab80'),edge=material('#a78860'),inside=material('#b99970'),front=material('#eadcc5'),metal=material('#aa9472',.26,.65);
      mesh(8.5,.24,3.1,wood,0,4.42);mesh(8.5,.24,3.1,wood,0,-4.42);
      mesh(.22,8.9,3.1,wood,-4.14);mesh(.22,8.9,3.1,wood,4.14);
      mesh(8.05,8.6,.14,inside,0,0,0);
      for(const x of [-3.4,3.4])for(const z of [-1.1,1.1])mesh(.3,.38,.3,edge,x,-4.68,z);
      for(const faceMode of ['major','season']){
        const face=new THREE.Group();face.rotation.y=faceMode==='season'?Math.PI:0;cabinet.add(face);faceGroups[faceMode]=face;
        for(const [key,x,y,w,h,type] of layout[faceMode]){
          mesh(w+.08,.1,1.32,inside,x,y-h/2,.73,face);
          mesh(.08,h,1.32,inside,x-w/2,y,.73,face);
          const moving=new THREE.Group();moving.position.set(type==='door'?x-w/2:x,y,1.52);face.add(moving);
          const cx=type==='door'?w/2:0;
          const panel=mesh(w,h,.14,front,cx,0,0,moving);
          // Raised frame and an inset wooden centre make the joinery legible in oblique views.
          mesh(w-.22,h-.22,.035,wood,cx,0,.086,moving);
          mesh(w-.34,h-.34,.04,front,cx,0,.11,moving);
          if(type==='door'){
            mesh(.055,.54,.11,metal,w-.22,-.05,.21,moving);
            for(const hy of [-h*.33,h*.33])mesh(.06,.26,.1,metal,.025,hy,.04,moving);
          }else{
            mesh(Math.min(.85,w*.36),.06,.13,metal,0,h*.24,.2,moving);
            mesh(w-.16,.1,1.35,inside,0,-h/2+.07,-.7,moving);
            mesh(.09,h*.65,1.35,inside,-w/2+.07,-h*.12,-.7,moving);
            mesh(.09,h*.65,1.35,inside,w/2-.07,-h*.12,-.7,moving);
          }
          const cell={key,x,y,w,h,type,faceMode,face,moving,panel,anchor:new THREE.Vector3(x,y+.12,1.75)};panel.userData.cell=cell;cells.push(cell);
        }
      }
      rail=new THREE.Group();rail.visible=false;scene.add(rail);
      const tube=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1,16),material('#c3c5c5',.2,.85));tube.rotation.x=Math.PI/2;rail.add(tube);
      viewer=new THREE.Group();viewer.visible=false;scene.add(viewer);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,70,20),material('#b7bbc3',.2,.8));pole.rotation.z=Math.PI/2;pole.position.y=-4.2;viewer.add(pole);
      photoGeo=new THREE.PlaneGeometry(3.2,4.8);hookGeo=new THREE.TorusGeometry(.18,.025,8,20);hookMat=material('#d7d9df',.2,.8);
      raycaster=new THREE.Raycaster();mouse=new THREE.Vector2();
      const labelLayer=document.createElement('div');labelLayer.className='wardrobe-labels';host.append(labelLayer);
      for(const cell of cells){
        const button=document.createElement('button');button.type='button';button.className='wardrobe-cell-label';button.dataset.catKey=cell.key;
        const name=document.createElement('span'),count=document.createElement('small');name.textContent=cell.key;button.append(name,count);labelLayer.append(button);
        labels.push({cell,button,count});
      }
      canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);
      canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',()=>{drag=null;});
      canvas.addEventListener('wheel',e=>{if(state!=='browse')return;e.preventDefault();step(Math.sign(e.deltaY||e.deltaX));},{passive:false});
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('3D 화면을 사용할 수 없어 목록으로 전환했습니다.');});
      new ResizeObserver(resize).observe(host);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(frame);else if(active)tick();});
      ready=true;resize();setData(allRows);setActive(active);
    }catch(e){fallback(e.message);}
  }
  function fallback(message){failed=true;ready=true;state='cabinet';cancelTransition();cancelAnimationFrame(frame);canvas?.remove();host.querySelector('.wardrobe-labels')?.remove();host.classList.add('wardrobe-fallback');
    host.replaceChildren();for(const [key] of layout[mode]){const b=document.createElement('button');b.type='button';b.dataset.catKey=key;b.className='wd-cell';b.textContent=key;host.append(b);}onFailure(message);
  }
  function setData(data){allRows=data||[];for(const {cell,count,button} of labels){const n=allRows.filter(r=>r['상태']!=='제거됨'&&r[cell.faceMode==='major'?'대분류':'계절']===cell.key).length;count.textContent=n+'벌';button.setAttribute('aria-label',cell.key+' 옷장 열기, '+n+'벌');}updateLabels();}
  function setActive(value){active=value;if(!active){cancelAnimationFrame(frame);if(state!=='cabinet')reset();return;}if(ready&&!failed){resize();cancelAnimationFrame(frame);tick();}}
  function resize(){if(!renderer||failed)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    const distance=Math.max(18,4.9/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
    baseCamera=new THREE.Vector3(distance*.19,distance*.1,distance);baseTarget=new THREE.Vector3(0,-.1,0);
    if(state==='cabinet'||state==='rotating'){camera.position.copy(baseCamera);look.copy(baseTarget);}else if(state==='browse')setBrowseCamera();
    updateLabels();
  }
  function updateLabels(){if(!camera)return;scene.updateMatrixWorld(true);camera.lookAt(look);camera.updateMatrixWorld();
    for(const {cell,button} of labels){const show=state==='cabinet'&&cell.faceMode===mode;button.hidden=!show;button.disabled=!show;if(!show)continue;
      const p=cell.face.localToWorld(cell.anchor.clone()).project(camera);button.style.left=((p.x+1)/2*host.clientWidth)+'px';button.style.top=((-p.y+1)/2*host.clientHeight)+'px';}
  }
  function cancelTransition(){timeline?.kill();timeline=null;if(resolveTransition){resolveTransition(false);resolveTransition=null;}}
  function setOpacity(group,value){group.traverse(o=>{if(o.isMesh){o.material.transparent=value<.999;o.material.opacity=value;}});}
  function reset(){cancelTransition();state='cabinet';selectedCell=null;drag=null;for(const cell of cells){cell.moving.rotation.y=0;cell.moving.position.z=1.52;}
    if(cabinet){cabinet.rotation.y=mode==='major'?0:Math.PI;cabinet.visible=true;room.visible=true;viewer.visible=false;rail.visible=false;setOpacity(cabinet,1);setOpacity(room,1);scene.background.set('#ece8e0');if(baseCamera){camera.position.copy(baseCamera);look.copy(baseTarget);}}
    host?.classList.remove('is-browsing','is-transitioning');updateLabels();
  }
  async function setMode(next){if(next===mode&&state==='cabinet')return true;if(state!=='cabinet'&&state!=='rotating')return false;cancelTransition();if(failed){mode=next;fallback('');return true;}
    const target=next==='season'?Math.PI:0;state='rotating';host.classList.add('is-transitioning');updateLabels();
    return new Promise(resolve=>{resolveTransition=resolve;timeline=gsap.timeline({onComplete:()=>{mode=next;state='cabinet';host.classList.remove('is-transitioning');updateLabels();resolveTransition=null;resolve(true);}}).to(cabinet.rotation,{y:target,duration:duration(.9),ease:'power3.inOut'});});
  }
  function browsePoint(){return viewer.localToWorld(new THREE.Vector3(0,-.6,24));}
  function browseTarget(){return viewer.localToWorld(new THREE.Vector3(0,-1,0));}
  function setBrowseCamera(){camera.position.copy(browsePoint());look.copy(browseTarget());}
  async function open(key,data){if(state!=='cabinet')return false;if(failed){rows=data;return true;}
    const cell=cells.find(c=>c.faceMode===mode&&c.key===key);if(!cell)return false;selectedCell=cell;state='opening';host.classList.add('is-transitioning');updateLabels();
    scene.updateMatrixWorld(true);const orientation=cell.face.getWorldQuaternion(new THREE.Quaternion());
    const railY=cell.y+Math.min(cell.h*.28,1.1);rail.position.copy(cell.face.localToWorld(new THREE.Vector3(cell.x,railY,1.5)));rail.quaternion.copy(orientation);rail.visible=true;rail.children[0].scale.y=.05;rail.children[0].position.z=0;
    viewer.position.copy(cell.face.localToWorld(new THREE.Vector3(cell.x,railY+4.2,6)));viewer.quaternion.copy(orientation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2));
    viewer.updateMatrixWorld(true);
    setRows(data);viewer.visible=false;
    const end=browsePoint(),target=browseTarget();const mid=cell.face.localToWorld(new THREE.Vector3(cell.x+10,railY+3,8));
    const phase={railLength:.05,fade:0};
    return new Promise(resolve=>{resolveTransition=resolve;timeline=gsap.timeline({onComplete:()=>{state='browse';host.classList.remove('is-transitioning');host.classList.add('is-browsing');cabinet.visible=false;room.visible=false;rail.visible=false;resolveTransition=null;resolve(true);}});
      if(cell.type==='door')timeline.to(cell.moving.rotation,{y:-Math.PI*.62,duration:duration(.55),ease:'power3.out'},0);
      else timeline.to(cell.moving.position,{z:3.0,duration:duration(.55),ease:'power3.out'},0);
      timeline.to(phase,{railLength:9,duration:duration(.7),ease:'power2.inOut',onUpdate:()=>{rail.children[0].scale.y=phase.railLength;rail.children[0].position.z=phase.railLength/2;}},duration(.25));
      timeline.to(camera.position,{x:mid.x,y:mid.y,z:mid.z,duration:duration(.7),ease:'power2.inOut'},duration(.45));
      timeline.to(look,{x:target.x,y:target.y,z:target.z,duration:duration(1),ease:'power2.inOut'},duration(.45));
      timeline.to(camera.position,{x:end.x,y:end.y,z:end.z,duration:duration(.75),ease:'power3.inOut'},duration(1));
      timeline.call(()=>{viewer.visible=true;},[],duration(.95));
      timeline.to(phase,{fade:1,duration:duration(.55),ease:'power2.inOut',onUpdate:()=>{setOpacity(cabinet,1-phase.fade);setOpacity(room,1-phase.fade);scene.background.lerpColors(new THREE.Color('#ece8e0'),new THREE.Color('#10151d'),phase.fade);}},duration(1.1));
    });
  }
  async function close(){if(state==='cabinet')return;if(failed){reset();return;}cancelTransition();state='closing';host.classList.add('is-transitioning');
    // The same camera path reverses toward the still-open cabinet before the door settles.
    cabinet.visible=true;room.visible=true;const p={fade:0};
    return new Promise(resolve=>{resolveTransition=resolve;timeline=gsap.timeline({onComplete:()=>{resolveTransition=null;reset();resolve(true);}})
      .to(camera.position,{x:baseCamera.x,y:baseCamera.y,z:baseCamera.z,duration:duration(.7),ease:'power3.inOut'},0)
      .to(look,{x:baseTarget.x,y:baseTarget.y,z:baseTarget.z,duration:duration(.7),ease:'power3.inOut'},0)
      .to(p,{fade:1,duration:duration(.4),onUpdate:()=>{setOpacity(cabinet,p.fade);setOpacity(room,p.fade);scene.background.lerpColors(new THREE.Color('#10151d'),new THREE.Color('#ece8e0'),p.fade);}},0)
      .call(()=>{viewer.visible=false;},[],duration(.2));
      if(selectedCell?.type==='door')timeline.to(selectedCell.moving.rotation,{y:0,duration:duration(.35),ease:'power2.out'},duration(.4));
      else if(selectedCell)timeline.to(selectedCell.moving.position,{z:1.52,duration:duration(.35),ease:'power2.out'},duration(.4));
    });
  }
  function texture(src){if(textures.has(src))return textures.get(src);const tex=new THREE.TextureLoader().load(src);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.set(src,tex);return tex;}
  function sampleLabel(number){
    if(!number)return null;
    const face=document.createElement('canvas');face.width=512;face.height=512;
    const ctx=face.getContext('2d');ctx.fillStyle='rgba(9,15,26,.76)';
    ctx.beginPath();ctx.roundRect?.(28,133,456,246,30);
    if(ctx.roundRect)ctx.fill();else ctx.fillRect(28,133,456,246);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${number.length===3?255:300}px Arial, sans-serif`;
    ctx.lineWidth=18;ctx.strokeStyle='rgba(0,0,0,.62)';ctx.strokeText(number,256,260);
    ctx.fillStyle='#fff';ctx.fillText(number,256,260);
    const map=new THREE.CanvasTexture(face);map.encoding=THREE.sRGBEncoding;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.8),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    mesh.position.set(0,-2.5,.025);mesh.renderOrder=1;return mesh;
  }
  function setRows(data){rows=data||[];if(failed)return;const keep=selected?.['옷_ID'];for(const item of items){gsap.killTweensOf(item);viewer.remove(item.group);item.cloth.material.dispose();if(item.label){item.label.material.map.dispose();item.label.material.dispose();item.label.geometry.dispose();}}items=[];for(const t of textures.values())t.dispose();textures.clear();
    rows.forEach((row,i)=>{const group=new THREE.Group(),hook=new THREE.Mesh(hookGeo,hookMat);hook.rotation.y=Math.PI/2;group.add(hook);
      const src=row['대표사진']||row['사진1'];const mat=new THREE.MeshStandardMaterial({color:src?0xffffff:0xc7b599,map:src?texture(src):null,roughness:.75,side:THREE.DoubleSide});
      const cloth=new THREE.Mesh(photoGeo,mat);cloth.position.y=-2.5;group.add(cloth);
      const label=sampleLabel(sampleNumber(row));if(label)group.add(label);
      viewer.add(group);items.push({row,group,cloth,label,index:i,topWeight:0});});
    const previous=rows.findIndex(r=>r['옷_ID']===keep),index=previous<0?Math.floor(rows.length/2):previous;scroll=targetScroll=index;selected=rows[index]||null;if(items[index])items[index].topWeight=1;notifySelection();layoutItems(1);
  }
  function notifySelection(){onSelect(selected,items.findIndex(i=>i.row===selected),items.length,Math.round(targetScroll));}
  function choose(index){if(!items.length)return;index=clamp(index,0,items.length-1);targetScroll=index;selected=items[index].row;
    for(const item of items)gsap.to(item,{topWeight:item.index===index?1:0,duration:duration(.65),ease:'power3.inOut',overwrite:true});notifySelection();
  }
  function step(delta){if(state!=='browse'||!items.length)return;targetScroll=clamp(Math.round(targetScroll)+delta,0,items.length-1);notifySelection();}
  function pointerDown(e){if(state!=='browse'&&state!=='cabinet')return;drag={x:e.clientX,y:e.clientY,start:targetScroll,distance:0};canvas.setPointerCapture(e.pointerId);}
  function pointerMove(e){if(!drag||state!=='browse')return;const dx=e.clientX-drag.x;drag.distance=Math.max(drag.distance,Math.abs(dx),Math.abs(e.clientY-drag.y));targetScroll=clamp(drag.start-dx/host.clientWidth*12,0,Math.max(0,items.length-1));}
  function pointerUp(e){if(!drag)return;const moved=drag.distance;drag=null;if(state==='browse'&&moved>=6){targetScroll=Math.round(targetScroll);notifySelection();return;}
    const rect=canvas.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);
    if(state==='cabinet'){const hit=raycaster.intersectObjects(cells.filter(c=>c.faceMode===mode).map(c=>c.panel))[0];if(hit)onOpen(hit.object.userData.cell.key);}
    else if(state==='browse'){const hit=raycaster.intersectObjects(items.map(i=>i.cloth))[0];const item=items.find(i=>i.cloth===hit?.object);if(item){if(item.topWeight>.5)onDetail(item.row);else choose(item.index);}}
  }
  const polePos={x:0,y:-4.2,z:0};
  function layoutItems(factor){scroll+=(targetScroll-scroll)*factor;for(const item of items){
    const rel=item.index-scroll,a=Math.abs(rel),sign=Math.sign(rel),curve=1-Math.exp(-a*.5),weight=item.topWeight;
    // Keep the supplied cover-flow's wide center and saturating curve; pack the far sides tighter.
    polePos.x=sign*(6*curve+a*.16);item.group.position.set(polePos.x*(1-weight),-4.2+(2.1+4.2)*weight,11*weight);
    item.group.rotation.set(0,(sign<=0?1:-1)*curve*82*Math.PI/180*(1-weight),0);
  }}
  function tick(now=performance.now()){if(!active||failed||document.hidden)return;cancelAnimationFrame(frame);const dt=Math.min(.06,(now-lastTime)/1000||.016);lastTime=now;
    if(viewer.visible)layoutItems(reduced()?1:1-Math.exp(-10*dt));camera.lookAt(look);renderer.render(scene,camera);frame=requestAnimationFrame(tick);
  }
  return {init,setData,setActive,setMode,open,close,setRows,step,reset,get state(){return state;},get failed(){return failed;},get selected(){return selected;},layout};
})();
