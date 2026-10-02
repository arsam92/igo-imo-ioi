import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';
import * as RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.21.0/rapier.es.js';

await RAPIER.init();

const T = THREE.MathUtils;
const V3 = THREE.Vector3;
const Q = THREE.Quaternion;
const CFG = {
  field:{halfW:9, halfL:14, goalW:3.4, goalDepth:2.4},
  gravity:-18,
  player:{height:2.8,radius:.42,speed:6.4,jump:7.8,kickRange:2.15,kickPower:13},
  ball:{radius:.68,mass:2.8},
  maxPlayers:4,
  physicsHz:60,
  shake:true,
  volume:.65,
  weather:'clear',
  graphics:'Medium',
  fpsCap:0,
  matchLength:90,
  mode:'quick'
};

const MODES = {
  quick:['QUICK MATCH','90 seconds • random abilities'],
  draft:['DRAFT MODE','Pick from 3 random abilities'],
  first5:['FIRST TO 5','First team to score five'],
  sudden:['SUDDEN DEATH','Golden goal ends the match'],
  chaos:['CHAOS MODE','All abilities • double force'],
  practice:['PRACTICE','No timer • free abilities'],
  rarity:['RARITY RUMBLE','Epic+ abilities only']
};

const RARITY = {
  Common:{color:0xbfc7d5,weight:50},
  Uncommon:{color:0x61e7a5,weight:30},
  Rare:{color:0x59a9ff,weight:15},
  Epic:{color:0xa56cff,weight:4},
  Legendary:{color:0xffc14d,weight:.9},
  Mythic:{color:0xff4f8d,weight:.1}
};

// Single source of truth for tunable rarity/ability weights.
const ABILITY_CONFIG = {
  sprint:{name:'SPRINT',rarity:'Common',weight:12,cd:12,desc:'+40% move speed for 3 seconds.',icon:'💨'},
  superKick:{name:'SUPER KICK',rarity:'Common',weight:10,cd:14,desc:'Next kick sends the ball at 2.5x power.',icon:'💥'},
  slideMaster:{name:'SLIDE MASTER',rarity:'Common',weight:9,cd:15,desc:'Slide distance doubled, knocks over hits.',icon:'🛝'},
  stickyHands:{name:'STICKY HANDS',rarity:'Common',weight:8,cd:16,desc:'Next touch captures the ball for 3s.',icon:'🧤'},
  shieldBubble:{name:'SHIELD BUBBLE',rarity:'Common',weight:6,cd:20,desc:'Invincible 2.5s while still able to kick.',icon:'🫧'},
  heavyBody:{name:'HEAVY BODY',rarity:'Common',weight:5,cd:18,desc:'+80% effective mass for 5 seconds.',icon:'🪨'},
  doubleJumpBoost:{name:'DOUBLE JUMP BOOST',rarity:'Uncommon',weight:8,cd:15,desc:'Gain a third jump with bigger height.',icon:'🪂'},
  freezeShot:{name:'FREEZE SHOT',rarity:'Uncommon',weight:7,cd:20,desc:'Freeze a nearby target for 2.5s.',icon:'❄️'},
  magnetPull:{name:'MAGNET PULL',rarity:'Uncommon',weight:6,cd:18,desc:'Pull the ball toward you from 8m.',icon:'🧲'},
  rageMode:{name:'RAGE MODE',rarity:'Uncommon',weight:5,cd:22,desc:'+35% speed and +50% tackle force for 6s.',icon:'😡'},
  rocketDash:{name:'ROCKET DASH',rarity:'Uncommon',weight:4,cd:18,desc:'Dash forward; launch anyone in path.',icon:'🚀'},
  giantMode:{name:'GIANT MODE',rarity:'Rare',weight:5,cd:25,desc:'Grow 2x for 5 seconds.',icon:'🗿'},
  teleport:{name:'TELEPORT',rarity:'Rare',weight:4,cd:25,desc:'Blink to the ball.',icon:'🌀'},
  shockwaveSlam:{name:'SHOCKWAVE SLAM',rarity:'Rare',weight:3,cd:25,desc:'Launch everyone within 6m.',icon:'🌊'},
  timeSlow:{name:'TIME SLOW',rarity:'Rare',weight:3,cd:30,desc:'Other players move at 0.5x speed for 4s.',icon:'⏳'},
  cloneArmy:{name:'CLONE ARMY',rarity:'Epic',weight:1.5,cd:35,desc:'Spawn 2 AI clones for 10s.',icon:'👥'},
  blackHole:{name:'BLACK HOLE',rarity:'Epic',weight:1.5,cd:40,desc:'Singularity pulls players and ball for 3s.',icon:'🕳️'},
  meteorStrike:{name:'METEOR STRIKE',rarity:'Epic',weight:1,cd:45,desc:'Call a meteor with huge knockback + stun.',icon:'☄️'},
  phoenixRebirth:{name:'PHOENIX REBIRTH',rarity:'Legendary',weight:.4,cd:60,desc:'On knockout, revive in a fire explosion.',icon:'🔥'},
  gravityFlip:{name:'GRAVITY FLIP',rarity:'Legendary',weight:.3,cd:50,desc:'Opponents fall upward for 4s.',icon:'🔃'},
  dragonForm:{name:'DRAGON FORM',rarity:'Legendary',weight:.2,cd:60,desc:'Fly and breathe fire for 6s; 4x kick.',icon:'🐉'},
  jetpack:{name:'JETPACK',rarity:'Mythic',weight:.001,subWeight:1,cd:30,desc:'Fly freely for 5s with double air-kick.',icon:'🛩️'},
  realityBender:{name:'REALITY BENDER',rarity:'Mythic',weight:.099,subWeight:.1,once:true,desc:'Rewind 4 seconds of state, keeping your memory.',icon:'🪄'}
};

const ABILITIES = Object.entries(ABILITY_CONFIG).map(([id,a])=>({id,...a,color:RARITY[a.rarity].color}));
const KEYS = {
  0:{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',kick:'KeyF',ability:'KeyQ'},
  1:{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',jump:'ShiftRight',kick:'Period',ability:'Slash'},
  2:{up:'KeyI',down:'KeyK',left:'KeyJ',right:'KeyL',jump:'KeyU',kick:'KeyO',ability:'KeyP'},
  3:{up:'Numpad8',down:'Numpad5',left:'Numpad4',right:'Numpad6',jump:'Numpad0',kick:'NumpadDecimal',ability:'Numpad1'}
};
const TOUCH = [0,1,2,3].map(()=>({x:0,z:0,jump:false,kick:false,ability:false}));
const keyState=new Set(); const keyPressed=new Set();
window.addEventListener('keydown',e=>{if(!keyState.has(e.code)) keyPressed.add(e.code); keyState.add(e.code); if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault(); if(e.code==='Escape') togglePause();});
window.addEventListener('keyup',e=>keyState.delete(e.code));

let scene,camera,renderer,clock,world,ball,matchStarted=false,paused=false,matchClock=CFG.matchLength,score=[0,0],goalLock=0,replayClock=0,gameOver=false,lastStateTime=0;
let players=[],particles=[],texts=[],clones=[],abilityFX=[],weatherPoints;
let audioCtx=null,musicGain=null,musicTimer=null;
const tmpV=new V3(),tmpV2=new V3(),tmpQ=new Q();

const $=id=>document.getElementById(id);
const ui={hud:$('hud'), menu:$('menu'), settings:$('settings'), controls:$('controls'), dev:$('dev'), draft:$('draft'), pause:$('pause'), victory:$('victory'), blueScore:$('blueScore'),redScore:$('redScore'),timer:$('timer'),abilityIcon:$('abilityIcon'),cool:$('coolOverlay'),abilityName:$('abilityName'),abilityMeta:$('abilityMeta'),go:$('goText'),count:$('countdown'),flash:$('flash'),touch:$('touchRoot'),playersHud:$('playersHud')};

function showScreen(id){for(const el of [ui.menu,ui.settings,ui.controls,ui.dev,ui.draft,ui.pause,ui.victory])el.classList.remove('active'); if(id) $(id).classList.add('active');}
function hex(c){return '#'+c.toString(16).padStart(6,'0')}
function rand(a,b){return a+Math.random()*(b-a)}
function pickWeighted(list){let total=list.reduce((s,x)=>s+x.weight,0),r=Math.random()*total;for(const x of list){r-=x.weight;if(r<=0)return x}return list[list.length-1]}
function pickAbility(mode='quick'){
  let pool=ABILITIES;
  if(mode==='rarity')pool=ABILITIES.filter(a=>['Epic','Legendary','Mythic'].includes(a.rarity));
  const byRarity={}; for(const a of pool)(byRarity[a.rarity]??=[]).push(a);
  let rarityWeights=pool.reduce((m,a)=>(m[a.rarity]=RARITY[a.rarity].weight,m),{});
  if(mode==='rarity'){rarityWeights={Epic:4,Legendary:.9,Mythic:.1};}
  const rarityList=Object.entries(rarityWeights).filter(([r])=>byRarity[r]).map(([r,w])=>({rarity:r,weight:w}));
  const rarity=pickWeighted(rarityList).rarity; const selected=byRarity[rarity];
  if(rarity==='Mythic'){const total=selected.reduce((s,x)=>s+(x.subWeight??1),0);let r=Math.random()*total;for(const a of selected){r-=a.subWeight??1;if(r<=0)return a}}
  return pickWeighted(selected);
}
function forceAbility(id){return ABILITY_CONFIG[id]?ABILITIES.find(a=>a.id===id):null}

function makeRenderer(){
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(devicePixelRatio,CFG.graphics==='Low'?1.25:CFG.graphics==='Ultra'?2:1.6)); renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=CFG.graphics!=='Low';renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;document.getElementById('app').prepend(renderer.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0x06111c,32,70);
  camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,160);camera.position.set(0,18,24);camera.lookAt(0,0,0);
  clock=new THREE.Clock();
}
function addLights(){
  const hemi=new THREE.HemisphereLight(0xa9d8ff,0x163620,CFG.weather==='night'?.28:1.25);scene.add(hemi);scene.userData.hemi=hemi;
  const sun=new THREE.DirectionalLight(0xfff4d6,2.4);sun.position.set(10,24,8);sun.intensity=CFG.weather==='night'?.18:2.4;scene.userData.sun=sun;sun.castShadow=renderer.shadowMap.enabled;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;scene.add(sun);
  for(const x of [-8,8]){for(const z of [-12,12]){const l=new THREE.SpotLight(0xd6ecff,.9,40,Math.PI/7,.55,1.2);l.position.set(x*1.5,10,z*1.1);l.target.position.set(0,0,z*.7);scene.add(l,l.target)}}
}
function mat(color,rough=.75,metal=0){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal})}
function box(w,h,d,color,cast=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.castShadow=cast;m.receiveShadow=true;return m}
function cyl(r1,r2,h,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,10),mat(color));m.castShadow=true;m.receiveShadow=true;return m}
function sph(r,color){const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),mat(color));m.castShadow=true;m.receiveShadow=true;return m}

function addField(){
  const field=box(18,.35,28,0x1d8b4d,false);field.position.y=-.2;scene.add(field);
  for(let i=-8;i<9;i++){const stripe=box(2.1,.37,28,0x249957,false);stripe.position.set(i*2.1+.9,.02,0);stripe.material.roughness=1;scene.add(stripe)}
  const center= new THREE.Mesh(new THREE.RingGeometry(2.0,2.12,64),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.5,side:THREE.DoubleSide}));center.rotation.x=-Math.PI/2;center.position.y=.19;scene.add(center);
  const lineMat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.5});
  const pts=[new V3(-9,.21,-14),new V3(9,.21,-14),new V3(9,.21,14),new V3(-9,.21,14),new V3(-9,.21,-14),new V3(-9,.21,0),new V3(9,.21,0)];const geo=new THREE.BufferGeometry().setFromPoints(pts);scene.add(new THREE.LineSegments(geo,lineMat));
  buildEndWalls();buildGoals();buildCrowd();buildBanners();
}
function buildEndWalls(){
  const c=0x102338; for(const z of [-15.5,15.5]){for(const s of [-1,1]){const w=box(9-1.7,.9,.7,c);w.position.set(s*5.65,.45,z);scene.add(w)}} for(const x of [-9.8,9.8]){const w=box(.7,.9,30,c);w.position.set(x,.45,0);scene.add(w)}
}
function buildGoals(){
  for(const side of [-1,1]){
    const z=side*15.1; const postMat=mat(0xeef4ff,.45,.05); for(const x of [-1.7,1.7]){const p=cyl(.12,.12,3.1,0xffffff);p.position.set(x,1.55,z);scene.add(p)} const bar=box(3.5,.18,.18,0xffffff);bar.position.set(0,3.05,z);scene.add(bar);
    for(let x=-1.7;x<=1.7;x+=.35){const net=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(x,.15,z),new V3(x,3,z+side*1.7)]),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.16}));scene.add(net)}
    for(let y=.3;y<=3;y+=.4){const net=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(-1.7,y,z),new V3(1.7,y,z)]),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.16}));scene.add(net)}
  }
}
function buildCrowd(){
  const group=new THREE.Group(); for(const z of [-19,19]){for(let i=-11;i<=11;i++){for(let r=0;r<2;r++){const c=0x25374b+(r*0x101010);const m=cyl(.28,.36,1.1,c);m.position.set(i*1.05,0.7+r*.85,z+ (z>0?1:-1)*r*.2);group.add(m)}}} scene.add(group)
}
function canvasBanner(text){const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle='#101a2a';x.fillRect(0,0,c.width,c.height);x.fillStyle='#d9f4ff';x.font='800 54px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2);return new THREE.CanvasTexture(c)}
function buildBanners(){for(const z of [-18.7,18.7]){const m=new THREE.Mesh(new THREE.PlaneGeometry(8,2),new THREE.MeshBasicMaterial({map:canvasBanner('CHAOS SOCCER • 2V2'),side:THREE.DoubleSide}));m.position.set(0,3.2,z);m.rotation.y=z>0?Math.PI:0;scene.add(m)}}

function createParticleSystem(){
  const max=1400; const pos=new Float32Array(max*3),col=new Float32Array(max*3),size=new Float32Array(max); const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setAttribute('size',new THREE.BufferAttribute(size,1)); const matp=new THREE.PointsMaterial({size:.11,vertexColors:true,transparent:true,opacity:.9,depthWrite:false});const p=new THREE.Points(geo,matp);scene.add(p);return {mesh:p,items:[],max}}
const dust=createParticleSystem(),sparks=createParticleSystem(),confetti=createParticleSystem();
function spawnBurst(type,pos,count=24,spread=4){const sys=type==='dust'?dust:type==='sparks'?sparks:confetti;for(let i=0;i<count&&sys.items.length<sys.max;i++){sys.items.push({p:pos.clone().add(new V3(rand(-.15,.15),rand(0,.25),rand(-.15,.15))),v:new V3(rand(-1,1)*spread,rand(.5,1.3)*spread,rand(-1,1)*spread),life:rand(.3,.9),maxLife:rand(.3,.9),size:rand(.08,.22),type})}}
function updateParticles(dt){for(const sys of [dust,sparks,confetti]){const pos=sys.mesh.geometry.attributes.position.array,col=sys.mesh.geometry.attributes.color.array,size=sys.mesh.geometry.attributes.size.array;for(let i=sys.items.length-1;i>=0;i--){const p=sys.items[i];p.life-=dt;p.v.y+=-10*dt*.35;p.p.addScaledVector(p.v,dt); if(p.type==='dust'){p.v.multiplyScalar(.92);p.size*=1.01} if(p.type==='sparks')p.v.multiplyScalar(.97); if(p.type==='confetti'){p.v.x+=Math.sin(p.life*10)*1.2*dt;p.v.z+=Math.cos(p.life*8)*.9*dt}
      const idx=i*3; if(p.life<=0){sys.items[i]=sys.items[sys.items.length-1];sys.items.pop();continue}pos[idx]=p.p.x;pos[idx+1]=p.p.y;pos[idx+2]=p.p.z;const t=p.life/p.maxLife;col[idx]=1;col[idx+1]=typeTone(p.type,0);col[idx+2]=typeTone(p.type,1);size[i]=p.size*(.5+.5*t)
    }sys.mesh.geometry.setDrawRange(0,sys.items.length);sys.mesh.geometry.attributes.position.needsUpdate=true;sys.mesh.geometry.attributes.color.needsUpdate=true;sys.mesh.geometry.attributes.size.needsUpdate=true}}
function typeTone(type,k){if(type==='confetti')return k?.6:1;if(type==='sparks')return k?.25:1;if(type==='dust')return k?.65:1}

function addWeather(){if(weatherPoints){scene.remove(weatherPoints);weatherPoints.geometry.dispose();weatherPoints.material.dispose()} if(CFG.weather==='clear'||CFG.weather==='night')return;const n=CFG.graphics==='Low'?350:700;const arr=new Float32Array(n*3);for(let i=0;i<n;i++){arr[i*3]=rand(-22,22);arr[i*3+1]=rand(2,16);arr[i*3+2]=rand(-24,24)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(arr,3));const m=new THREE.PointsMaterial({color:CFG.weather==='snow'?0xffffff:0x9dd7ff,size:CFG.weather==='snow'?.07:.04,transparent:true,opacity:.75});weatherPoints=new THREE.Points(g,m);scene.add(weatherPoints)}
function updateWeather(dt){if(!weatherPoints)return;const a=weatherPoints.geometry.attributes.position.array;for(let i=0;i<a.length;i+=3){a[i+1]-=(CFG.weather==='snow'?1.2:8)*dt;if(a[i+1]<.3){a[i+1]=rand(11,16);a[i]=rand(-22,22);a[i+2]=rand(-24,24)}}weatherPoints.geometry.attributes.position.needsUpdate=true}

function rigidDesc(dynamic=true){return dynamic?RAPIER.RigidBodyDesc.dynamic():RAPIER.RigidBodyDesc.fixed()}
function capsuleCollider(h,r){return RAPIER.ColliderDesc.capsule(h,r)}
function addBodyMesh(body,mesh){mesh.userData.body=body;scene.add(mesh);return mesh}

class Player{
  constructor(i,team,opts={}){this.index=i;this.team=team;this.name=['NOVA','RUSH','BYTE','VEX'][i]??`P${i+1}`;this.opts=opts;this.isClone=!!opts.clone;this.inputType='K';this.jumps=0;this.maxJumps=2;this.health=100;this.knockout=0;this.frozen=0;this.speedMul=1;this.heavyUntil=0;this.shieldUntil=0;this.rageUntil=0;this.giantUntil=0;this.dragonUntil=0;this.jetpackUntil=0;this.gravityFlipUntil=0;this.stun=0;this.rewindUsed=false;this.carryUntil=0;this.ability=this.opts.ability||pickAbility(CFG.mode);this.cool=0;this.pressState={jump:false,kick:false,ability:false};this.lastJump=0;this.forward=new V3(0,0,1);this.targetDir=new V3();this.flash=0;this.build();}
  build(){
    const x=this.team===0?-4:4; const z=this.index%2===0?-4:4; const base=new V3(x,1.9,z); this.bodies={};this.meshes={};
    const makePart=(name,pos,size,color,collider)=>{const rb=world.createRigidBody(rigidDesc(true).setTranslation(pos.x,pos.y,pos.z).setLinearDamping(.6).setAngularDamping(.75).setCanSleep(false));const co=world.createCollider(collider,rb);co.setFriction(.75);co.setRestitution(.15);const mesh=addBodyMesh(rb,box(size.x,size.y,size.z,color));mesh.userData.part=this;this.bodies[name]=rb;this.meshes[name]=mesh;return rb};
    const teamColor=this.team===0?0x3ea7ff:0xff5278, skin=0xf0b189, dark=0x202b3b;
    makePart('pelvis',base,new V3(.9,.65,.58),teamColor,RAPIER.ColliderDesc.capsule(.28,.43));
    makePart('torso',base.clone().add(new V3(0,.82,0)),new V3(1.1,1.25,.62),teamColor,RAPIER.ColliderDesc.cuboid(.5,.58,.3));
    const head=world.createRigidBody(rigidDesc(true).setTranslation(base.x,base.y+1.78,base.z)); world.createCollider(RAPIER.ColliderDesc.ball(.38),head).setFriction(.6); const hm=addBodyMesh(head,sph(.4,skin));hm.userData.part=this;this.bodies.head=head;this.meshes.head=hm;
    const parts=[['lUArm',[-.78,.9,.0],[.75,.22,.22],skin],['rUArm',[.78,.9,.0],[.75,.22,.22],skin],['lLArm',[-1.25,.65,.0],[.7,.18,.18],skin],['rLArm',[1.25,.65,.0],[.7,.18,.18],skin],['lULeg',[-.28,-.75,.0],[.3,.9,.34],dark],['rULeg',[.28,-.75,.0],[.3,.9,.34],dark],['lFoot',[-.28,-1.52,.22],[.34,.2,.65],teamColor],['rFoot',[.28,-1.52,.22],[.34,.2,.65],teamColor]];
    for(const [n,off,sz,c] of parts){const p=base.clone().add(new V3(off[0],off[1]+.6,off[2]));let desc=RAPIER.ColliderDesc.cuboid(sz[0]/2,sz[1]/2,sz[2]/2);makePart(n,p,new V3(...sz),c,desc)}
    this.joint('pelvis','torso',new V3(0,.25,0),new V3(0,-.55,0));this.joint('torso','head',new V3(0,.58,0),new V3(0,-.37,0));
    this.joint('torso','lUArm',new V3(-.5,.25,0),new V3(.32,.0,0));this.joint('torso','rUArm',new V3(.5,.25,0),new V3(-.32,.0,0));this.joint('lUArm','lLArm',new V3(-.3,0,0),new V3(.3,0,0));this.joint('rUArm','rLArm',new V3(.3,0,0),new V3(-.3,0,0));
    this.joint('pelvis','lULeg',new V3(-.23,-.27,0),new V3(0,.4,0));this.joint('pelvis','rULeg',new V3(.23,-.27,0),new V3(0,.4,0));this.joint('lULeg','lFoot',new V3(0,-.42,0),new V3(0,.05,-.15));this.joint('rULeg','rFoot',new V3(0,-.42,0),new V3(0,.05,-.15));
    this.root=this.bodies.pelvis;this.root.userData={player:this};
    this.group=new THREE.Group();this.label=this.makeLabel();this.group.add(this.label);scene.add(this.group);
    this.respawn(x,z);this.appear=0;
  }
  joint(a,b,aa,bb){const jd=RAPIER.JointData.spherical({x:aa.x,y:aa.y,z:aa.z},{x:bb.x,y:bb.y,z:bb.z});world.createImpulseJoint(jd,this.bodies[a],this.bodies[b],true)}
  makeLabel(){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.fillStyle='rgba(5,12,20,.72)';x.roundRect(4,5,248,54,18);x.fill();x.font='800 22px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#ffffff';x.fillText(this.name,128,32);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));s.scale.set(2.5,.62,1);return s}
  respawn(x=this.team===0?-4:4,z=0){const y=2.5;for(const [n,b] of Object.entries(this.bodies)){const offsets={pelvis:[0,0,0],torso:[0,.82,0],head:[0,1.78,0],lUArm:[-.78,1.0,0],rUArm:[.78,1.0,0],lLArm:[-1.25,.75,0],rLArm:[1.25,.75,0],lULeg:[-.28,-.15,0],rULeg:[.28,-.15,0],lFoot:[-.28,-.92,.22],rFoot:[.28,-.92,.22]}[n]||[0,0,0]; b.setTranslation({x:x+offsets[0],y:y+offsets[1],z:z+offsets[2]},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);b.wakeUp()}this.health=100;this.knockout=0;this.jumps=0;this.frozen=0}
  state(){if(this.knockout>0)return 'knockout';if(this.stun>0)return 'tackle';if(this.dragonUntil>performance.now()/1000)return 'dragon';if(this.carryUntil>performance.now()/1000)return 'carry';const v=this.root.linvel();const s=Math.hypot(v.x,v.z);if(s>.6)return 'run';return 'idle'}
  pos(){const t=this.root.translation();return new V3(t.x,t.y,t.z)}
  updateInput(){if(this.isClone){this.aiInput();return} if(this.knockout>0||gameOver||paused||replayClock>0){this.pressState={jump:false,kick:false,ability:false};return}const k=KEYS[this.index]??KEYS[0];const p=TOUCH[this.index];const g=getGamepadInput(this.index);const left=keyState.has(k.left),right=keyState.has(k.right),up=keyState.has(k.up),down=keyState.has(k.down);
    let x=(right?1:0)-(left?1:0),z=(down?1:0)-(up?1:0);if(Math.hypot(p.x,p.z)>.1){x=p.x;z=p.z} if(g.active){x=g.x;z=g.z;this.inputType='G'} else if(p.active){this.inputType='T'} else this.inputType='K';const jump=!this.pressState.jump&&(keyState.has(k.jump)||p.jump||g.jump);const kick=!this.pressState.kick&&(keyState.has(k.kick)||p.kick||g.kick);const ability=!this.pressState.ability&&(keyState.has(k.ability)||p.ability||g.ability);this.input={x,z};this.buttons={jump,kick,ability};this.pressState={jump:keyState.has(k.jump)||p.jump||g.jump,kick:keyState.has(k.kick)||p.kick||g.kick,ability:keyState.has(k.ability)||p.ability||g.ability};
  }
  aiInput(){const p=this.pos(),b=ball?.pos()||new V3();tmpV2.copy(b).sub(p);if(Math.abs(tmpV2.z)>14)tmpV2.multiplyScalar(-1);tmpV2.y=0;tmpV2.normalize();this.input={x:tmpV2.x,z:tmpV2.z};this.buttons={jump:Math.random()<.01,kick:tmpV2.length()>0&&p.distanceTo(b)<2,ability:false}}
  drive(dt){if(this.knockout>0){this.root.applyImpulse({x:-this.root.linvel().x*.03,y:0,z:-this.root.linvel().z*.03},true);return} if(this.frozen>0){this.frozen-=dt;this.root.setLinvel({x:0,y:this.root.linvel().y,z:0},true);return} let speed=CFG.player.speed*this.speedMul;
    const now=performance.now()/1000; if(this.slideMasterUntil>now) speed*=1.22;if(this.rageUntil>performance.now()/1000)speed*=1.35;if(this.isClone)speed*=.86;if(replayClock>0)speed*=.15;if(this.team!==undefined&&activeGravityFlip(this)){} const slow=othersSlow(this)?0.5:1;speed*=slow;
    let move=new V3(this.input?.x||0,0,this.input?.z||0);if(move.lengthSq()>1)move.normalize();this.targetDir.copy(move);this.forward.lerp(move.lengthSq()>.01?move:this.forward,1-Math.pow(.001,dt));
    const v=this.root.linvel();const desired=new V3(move.x*speed, v.y, move.z*speed);this.root.applyImpulse({x:(desired.x-v.x)*.12,y:0,z:(desired.z-v.z)*.12},true);
    const state=this.state();const t=performance.now()/1000;this.group.scale.setScalar(this.giantUntil>t?2:1);
    if(this.buttons?.jump){if(this.jumps<this.maxJumps){const jumpPower=this.jumps===0?CFG.player.jump:(this.ability.id==='doubleJumpBoost'?9.2:8.4);this.root.applyImpulse({x:0,y:jumpPower,z:0},true);this.jumps++;playSound('jump');spawnBurst('dust',this.pos(),10,1.3)}}
    if(this.stickyReady && !ball.carrier && this.pos().distanceTo(ball.pos())<1.25){ball.carryWith(this)}
    if(this.buttons?.kick){this.kick()}
    if(this.buttons?.ability){useAbility(this)}
    if(this.jetpackUntil>now || this.dragonUntil>now){this.root.applyImpulse({x:move.x*1.8,y:10*simLift(this),z:move.z*1.8},true)}
    // procedural animation pulses keep the ragdoll expressive without an external asset.
    const pulse=Math.sin(t*14+this.index);const armMul=state==='run'?1:0.35;for(const n of ['lLArm','rLArm','lULeg','rULeg']){const b=this.bodies[n];if(!b)continue;b.applyTorqueImpulse({x:0,y:pulse*0.015*armMul,z:(n.includes('l')?1:-1)*pulse*.012*armMul},true)}
    if(this.root.translation().y<1.15){this.jumps=0}
    if(this.heavyUntil>t)this.root.applyImpulse({x:-v.x*.003*CFG.ball.mass,y:0,z:-v.z*.003*CFG.ball.mass},true);
    if(this.shieldUntil<=t)this.flash*=.92;
  }
  kick(){const p=this.pos();if(this.carryUntil>performance.now()/1000&&ball){ball.releaseFromCarry();} const b=ball?.pos();if(!b)return;const d=p.distanceTo(b);if(d>CFG.player.kickRange* (this.giantUntil>performance.now()/1000?1.3:1))return;const dir=new V3().subVectors(b,p);dir.y=.15;dir.normalize();let power=CFG.player.kickPower;const superKickNow=!!this.superKickReady;if(superKickNow){power*=2.5;this.superKickReady=false;} if(this.giantUntil>performance.now()/1000)power*=1.35;if(this.dragonUntil>performance.now()/1000)power*=4;if(CFG.mode==='chaos')power*=2; if(this.dragonUntil>performance.now()/1000){for(const t of opponents(this,4.8)){t.frozen=Math.max(t.frozen,1.2);t.damage(20,{x:dir.x*7,y:4,z:dir.z*7},this)}spawnBurst('sparks',b,35,4)} if(this.jetpackUntil>performance.now()/1000)power*=2;ball.kick(dir,power,this);playSound('kick');screenShake(.38);spawnBurst(superKickNow?'sparks':'dust',b,18,3)}
  damage(amount,impulse,source){if(this.shieldUntil>performance.now()/1000||this.knockout>0)return;this.health=Math.max(0,this.health-amount);if(this.health<=0)this.knockoutNow(source);if(impulse){const m=this.heavyUntil>performance.now()/1000?.32:1;this.root.applyImpulse({x:impulse.x*m,y:impulse.y*m,z:impulse.z*m},true);this.root.applyTorqueImpulse({x:rand(-1,1),y:rand(-1,1),z:rand(-1,1)},true)}showHitText(this.pos(),Math.round(amount),this.team)}
  knockoutNow(source){this.knockout=1.6;this.stun=.9;this.health=0;playSound('tackle');spawnBurst('sparks',this.pos(),30,4);screenShake(.6);if(this.ability.id==='phoenixRebirth'&&this.cool<=0){this.cool=ABILITY_CONFIG.phoenixRebirth.cd;setTimeout(()=>this.rebirth(),800);}}
  rebirth(){this.knockout=0;this.health=100;this.root.setTranslation({...this.root.translation(),y:4},true);this.root.setLinvel({x:0,y:7,z:0},true);spawnBurst('confetti',this.pos(),60,5);playSound('ability');screenShake(.9);flashScreen()}
  syncMeshes(){for(const [n,b] of Object.entries(this.bodies)){const mesh=this.meshes[n],t=b.translation(),r=b.rotation();mesh.position.set(t.x,t.y,t.z);mesh.quaternion.set(r.x,r.y,r.z,r.w)}const p=this.pos();this.group.position.set(p.x,p.y+2.15,p.z);this.label.material.opacity=this.knockout>0?.25:1;}
}

class Ball{
  constructor(){const rb=world.createRigidBody(rigidDesc(true).setTranslation(0,1.5,0).setLinearDamping(.08).setAngularDamping(.05).setCanSleep(false));const co=world.createCollider(RAPIER.ColliderDesc.ball(CFG.ball.radius),rb);co.setRestitution(.68);co.setFriction(.35);this.body=rb;this.mesh=sph(CFG.ball.radius,0xf8f8f2);this.mesh.material.roughness=.44;scene.add(this.mesh);this.trail=[];this.carrier=null;this.posLast=this.pos();this.lastKick=0;}
  pos(){const t=this.body.translation();return new V3(t.x,t.y,t.z)}
  kick(dir,power,player){const p=this.pos();this.body.applyImpulse({x:dir.x*power,y:Math.max(.2,dir.y)*power*.9,z:dir.z*power},true);this.body.applyTorqueImpulse({x:rand(-2,2),y:rand(-7,7),z:rand(-2,2)},true);this.lastKick=performance.now()/1000;if(player?.ability.id==='stickyHands'){this.carrier=player;this.body.setEnabled(false);player.carryUntil=performance.now()/1000+3}}
  carryWith(player){if(this.carrier)return;this.carrier=player;player.carryUntil=performance.now()/1000+3;this.body.setEnabled(false)}
  releaseFromCarry(){if(!this.carrier)return;const p=this.carrier.pos();this.body.setEnabled(true);this.body.setTranslation({x:p.x,y:p.y+.25,z:p.z+this.carrier.forward.z*.9},true);this.body.setLinvel({x:this.carrier.root.linvel().x+this.carrier.forward.x*7,y:3,z:this.carrier.root.linvel().z+this.carrier.forward.z*7},true);this.carrier=null}
  update(dt){if(this.carrier){const p=this.carrier.pos();this.body.setEnabled(true);this.body.setTranslation({x:p.x+this.carrier.forward.x*.5,y:p.y+.4,z:p.z+this.carrier.forward.z*.5},true);this.body.setLinvel({x:0,y:0,z:0},true);this.body.setEnabled(false);return}this.body.setEnabled(true);const p=this.pos();this.mesh.position.copy(p);this.mesh.quaternion.copy(new Q(this.body.rotation().x,this.body.rotation().y,this.body.rotation().z,this.body.rotation().w));const speed=this.body.linvel();if(Math.hypot(speed.x,speed.z)>12)spawnTrail(p);if(p.distanceTo(this.posLast)>1.2)spawnBurst('dust',p,3,1);this.posLast.copy(p);}
  reset(){this.carrier=null;this.body.setEnabled(true);this.body.setTranslation({x:0,y:2,z:0},true);this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true)}
}

function simLift(p){return p.jetpackUntil>performance.now()/1000?1:(p.dragonUntil>performance.now()/1000?.75:0)}
function othersSlow(p){const t=performance.now()/1000;return timeSlowUntil>t && p.index!==timeSlowOwner}
function activeGravityFlip(p){return gravityFlipOwner!==p.index && performance.now()/1000<gravityFlipUntil}
let timeSlowUntil=0,timeSlowOwner=-1,gravityFlipUntil=0,gravityFlipOwner=-1;

function useAbility(p){if(p.cool>0||p.knockout>0)return;const a=p.ability; if(a.once&&p.rewindUsed)return;
  switch(a.id){
    case 'sprint':p.speedMul=1.4;setTimeout(()=>p.speedMul=1,3000);break;
    case 'superKick':p.superKick=true;break;
    case 'slideMaster':p.slideMasterUntil=performance.now()/1000+4;break;
    case 'stickyHands':p.stickyReady=true;break;
    case 'shieldBubble':p.shieldUntil=performance.now()/1000+2.5;break;
    case 'heavyBody':p.heavyUntil=performance.now()/1000+5;break;
    case 'doubleJumpBoost':p.maxJumps=3;setTimeout(()=>p.maxJumps=2,6000);break;
    case 'freezeShot':{const t=nearestOpponent(p,7);if(t){t.frozen=2.5;spawnBeam(p.pos(),t.pos(),0x9eeaff);impact(t,0,0,1)}}break;
    case 'magnetPull':{const b=ball.pos(),d=p.pos().distanceTo(b);if(d<8){const dir=p.pos().sub(b).normalize();ball.body.applyImpulse({x:dir.x*8,y:1,z:dir.z*8},true);spawnBeam(b,p.pos(),0xa9fff0)}}break;
    case 'rageMode':p.rageUntil=performance.now()/1000+6;rageFlash=true;setTimeout(()=>rageFlash=false,6000);break;
    case 'rocketDash':{const d=p.forward.clone().setY(0).normalize();p.root.applyImpulse({x:d.x*18,y:1.5,z:d.z*18},true);for(const t of opponents(p,2.5)){t.damage(26,{x:d.x*8,y:5,z:d.z*8},p)}}break;
    case 'giantMode':p.giantUntil=performance.now()/1000+5;break;
    case 'teleport':{const b=ball.pos();p.root.setTranslation({x:b.x,y:3.2,z:b.z},true);p.root.setLinvel({x:0,y:1,z:0},true);spawnBurst('confetti',b,20,3);break}
    case 'shockwaveSlam':{const pp=p.pos();for(const t of opponents(p,6)){const d=t.pos().sub(pp);d.y=0;d.normalize();t.damage(34,{x:d.x*13,y:9,z:d.z*13},p)}for(let i=0;i<28;i++){const a=i/28*Math.PI*2;spawnBurst('sparks',pp.clone().add(new V3(Math.cos(a)*2,0,Math.sin(a)*2)),1,2)}screenShake(.9);break}
    case 'timeSlow':timeSlowOwner=p.index;timeSlowUntil=performance.now()/1000+4;break;
    case 'cloneArmy':for(let i=0;i<2;i++)spawnClone(p);break;
    case 'blackHole':spawnBlackHole(p.pos().addScaledVector(p.forward,2),3);break;
    case 'meteorStrike':{const target=nearestOpponent(p,10)?.pos()||ball.pos();spawnMeteor(target);break}
    case 'phoenixRebirth':break;
    case 'gravityFlip':gravityFlipOwner=p.index;gravityFlipUntil=performance.now()/1000+4;break;
    case 'dragonForm':p.dragonUntil=performance.now()/1000+6;p.giantUntil=p.dragonUntil;break;
    case 'jetpack':p.jetpackUntil=performance.now()/1000+5;break;
    case 'realityBender':p.rewindUsed=true;rewindState();break;
  }
  p.cool=a.cd;playSound('ability');abilityFX.push({kind:a.id,p:p.pos().clone(),life:1,color:a.color});screenShake(a.rarity==='Mythic'?.95:a.rarity==='Legendary'?.7:.25);
}
function nearestOpponent(p,r){let best=null,bd=r;for(const t of opponents(p,99)){if(t.knockout>0)continue;const d=p.pos().distanceTo(t.pos());if(d<bd){bd=d;best=t}}return best}
function opponents(p,r){return players.filter(t=>t!==p&&t.team!==p.team&&p.pos().distanceTo(t.pos())<=r)}
function impact(t,amount=0,dx=0,dy=0){if(amount)t.damage(amount,{x:dx,y:dy,z:dx},null);spawnBurst('sparks',t.pos(),10,2)}
function spawnClone(src){const c=new Player(players.length,src.team,{clone:true,ability:src.ability});c.name=src.name+'•CLONE';clones.push(c);players.push(c);setTimeout(()=>destroyClone(c),10000)}
function destroyClone(c){const idx=players.indexOf(c);if(idx>=0)players.splice(idx,1);for(const b of Object.values(c.bodies))world.removeRigidBody(b);for(const m of Object.values(c.meshes))scene.remove(m);scene.remove(c.group)}

function spawnBlackHole(pos,dur){const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.18,12,36),new THREE.MeshBasicMaterial({color:0x9f6bff,transparent:true,opacity:.95}));g.add(ring);const core=new THREE.Mesh(new THREE.SphereGeometry(.9,16,12),new THREE.MeshBasicMaterial({color:0x090414}));g.add(core);g.position.copy(pos);scene.add(g);const until=performance.now()/1000+dur;const tick=()=>{const now=performance.now()/1000;if(now>until){scene.remove(g);return}g.rotation.y+=.08;const gp=g.position;for(const p of players){const d=gp.distanceTo(p.pos());if(d<7){const dir=gp.clone().sub(p.pos()).normalize();p.root.applyImpulse({x:dir.x*1.8,y:dir.y*.2,z:dir.z*1.8},true)}}const bp=ball.pos();const bd=gp.distanceTo(bp);if(bd<7){const dir=gp.clone().sub(bp).normalize();ball.body.applyImpulse({x:dir.x*2.2,y:0,z:dir.z*2.2},true)}requestAnimationFrame(tick)};tick()}
function spawnMeteor(target){const marker=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,.05,32),new THREE.MeshBasicMaterial({color:0xff6455,transparent:true,opacity:.45}));marker.position.set(target.x,.23,target.z);scene.add(marker);setTimeout(()=>{scene.remove(marker);const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1.1,1),new THREE.MeshStandardMaterial({color:0x66504d,emissive:0x5a170f,emissiveIntensity:2}));rock.position.set(target.x,12,target.z);scene.add(rock);const start=performance.now();const fall=()=>{const t=Math.min(1,(performance.now()-start)/600);rock.position.y=12*(1-t)+.7;if(t<1){requestAnimationFrame(fall);return}scene.remove(rock);spawnBurst('sparks',new V3(target.x,.8,target.z),100,7);for(const p of players){const d=p.pos().distanceTo(new V3(target.x,0,target.z));if(d<7){const dir=p.pos().sub(new V3(target.x,0,target.z)).setY(0).normalize();p.damage(55,{x:dir.x*18,y:12,z:dir.z*18},null);p.stun=1.5}}screenShake(1);flashScreen()},30)}

function spawnBeam(a,b,color){const matl=new THREE.LineBasicMaterial({color,transparent:true,opacity:.9});const g=new THREE.BufferGeometry().setFromPoints([a,b]);const l=new THREE.Line(g,matl);scene.add(l);setTimeout(()=>{scene.remove(l);g.dispose();matl.dispose()},180)}
function spawnTrail(p){const m=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xffcf66,transparent:true,opacity:.7}));m.position.copy(p);scene.add(m);setTimeout(()=>scene.remove(m),90)}
function showHitText(p,n,team){const c=document.createElement('canvas');c.width=160;c.height=64;const x=c.getContext('2d');x.font='900 30px system-ui';x.textAlign='center';x.fillStyle='#fff';x.strokeStyle='#06101a';x.lineWidth=8;x.strokeText('-'+n,80,40);x.fillText('-'+n,80,40);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));s.position.copy(p);s.scale.set(1.3,.52,1);scene.add(s);texts.push({s,life:1,v:new V3(0,1.4,0)})}
function updateTexts(dt){for(let i=texts.length-1;i>=0;i--){const t=texts[i];t.life-=dt;t.s.position.addScaledVector(t.v,dt);t.s.material.opacity=Math.max(0,t.life);if(t.life<=0){scene.remove(t.s);texts.splice(i,1)}}}

function doTackles(){for(const p of players){if(p.knockout>0)continue;const v=p.root.linvel();if(Math.hypot(v.x,v.z)<7)continue;for(const t of opponents(p,1.15)){if(t.knockout>0)continue;const d=t.pos().sub(p.pos()).setY(0).normalize();const force=p.rageUntil>performance.now()/1000?18:12;const dmg=p.giantUntil>performance.now()/1000?40:26;t.damage(dmg,{x:d.x*force,y:6,z:d.z*force},p);t.stun=.65;spawnBurst('sparks',t.pos(),16,3);screenShake(.3)}}}
function checkGroundAndOOB(){for(const p of players){if(p.pos().y<-5||Math.abs(p.pos().x)>12||Math.abs(p.pos().z)>20){p.respawn(p.team===0?-4:4,rand(-4,4))}}
  const bp=ball.pos(); if(Math.abs(bp.z)>16 || Math.abs(bp.x)>11){if(Math.abs(bp.z)>14.2 && Math.abs(bp.x)<CFG.field.goalW/2){scoreGoal(bp.z>0?0:1)}else ball.reset()}
}
function scoreGoal(team){if(goalLock>0)return;goalLock=2;score[team]++;ui.blueScore.textContent=score[0];ui.redScore.textContent=score[1];for(const el of [ui.blueScore,ui.redScore]){el.animate([{transform:'scale(1)'},{transform:'scale(1.35) rotate(-2deg)'},{transform:'scale(1)'}],{duration:420,easing:'cubic-bezier(.2,.85,.2,1)'})}ui.go.classList.remove('goTextShow');void ui.go.offsetWidth;ui.go.classList.add('goTextShow');spawnBurst('confetti',new V3(0,1,team===0?14:-14),220,8);playSound('goal');screenShake(1.1);replayClock=2;setTimeout(()=>{ball.reset();for(const p of players){if(!p.isClone)p.respawn(p.team===0?-4:4,p.index%2?3:-3)}goalLock=0;},2000);if(CFG.mode==='sudden'||score[team]>=5|| (CFG.mode!=='practice'&&matchClock<=0))endMatch(team)}

let draftChoices=[];
function beginDraft(){
  draftChoices=players.filter(p=>p.index<4).map(p=>({player:p,options:[pickAbility('quick'),pickAbility('quick'),pickAbility('quick')],picked:null}));
  showScreen('draft');
  const g=$('draftGrid');g.innerHTML='';
  for(const d of draftChoices){const card=document.createElement('div');card.className='card';card.innerHTML=`<b>${d.player.name}</b><div class="row" style="margin-top:8px"></div>`;const row=card.querySelector('.row');d.options.forEach((a,idx)=>{const b=document.createElement('button');b.style.borderColor=hex(a.color);b.innerHTML=`${idx+1}. ${a.icon} ${a.name}<br><span class="tiny">${a.rarity}</span>`;b.onclick=()=>{d.picked=a;[...row.children].forEach(x=>x.style.boxShadow='');b.style.boxShadow=`0 0 0 2px ${hex(a.color)} inset`;updateDraftReady();};row.appendChild(b)});g.appendChild(card)}
  $('draftAuto').onclick=()=>{for(const d of draftChoices)if(!d.picked)d.picked=d.options[0];updateDraftReady();const buttons=g.querySelectorAll('button');buttons.forEach(b=>{if(!b.style.boxShadow)b.style.opacity=.55})};
  $('draftLaunch').onclick=launchDraft;
}
function updateDraftReady(){$('draftLaunch').disabled=draftChoices.some(d=>!d.picked)}
function launchDraft(){for(const d of draftChoices)d.player.ability=d.picked;showScreen(null);ui.hud.hidden=false;matchStarted=true;gameOver=false;paused=false;score=[0,0];matchClock=CFG.matchLength;goalLock=0;replayClock=0;makeAudio();rollReveal()}

function startMatch(mode=CFG.mode){CFG.mode=mode; if(mode==='draft'){matchStarted=false;ui.hud.hidden=true;beginDraft();return;} gameOver=false;paused=false;matchStarted=true;score=[0,0];matchClock=mode==='practice'?Infinity:CFG.matchLength;goalLock=0;replayClock=0;showScreen(null);ui.hud.hidden=false;players.forEach(p=>{p.ability=mode==='chaos'?pickAbility('quick'):pickAbility(mode);p.cool=0;p.rewindUsed=false;p.respawn(p.team===0?-4:4,p.index%2?3:-3)});rollReveal();makeAudio();}
function rollReveal(){const seq=[];for(const p of players.filter(p=>!p.isClone)){seq.push(`${p.name}: ${p.ability.name}`)}showGoText(seq.join('  •  '),pColor(players[0]?.ability?.rarity||'Common'));setTimeout(()=>{$('goText').textContent='3';showCountdown(['3','2','1','GO!']);},850)}
function showGoText(text,rar){ui.go.textContent=text;ui.go.style.fontSize='clamp(30px,7vw,80px)';ui.go.classList.remove('goTextShow');void ui.go.offsetWidth;ui.go.classList.add('goTextShow');ui.go.style.color=hex(RARITY[rar]?.color||0xffffff);setTimeout(()=>ui.go.style.fontSize='',850)}
function pColor(r){return r}
async function showCountdown(list){for(const s of list){ui.count.textContent=s;ui.count.style.opacity='1';ui.count.animate([{transform:'scale(.55)',opacity:0},{transform:'scale(1)',opacity:1},{transform:'scale(1.1)',opacity:0}],{duration:700,easing:'cubic-bezier(.2,.85,.2,1)'});await new Promise(r=>setTimeout(r,700));}ui.count.textContent='';ui.count.style.opacity='0'}
function endMatch(winner){if(gameOver)return;gameOver=true;matchStarted=false;ui.hud.hidden=true;showScreen('victory');$('victoryTitle').textContent=winner===0?'BLUE WINS!':'RED WINS!';$('victoryTitle').style.color=winner===0?'#55c7ff':'#ff6688';$('victorySub').textContent=`Final score ${score[0]} — ${score[1]}`;const hs=players.filter(p=>p.index<4);$('victoryStats').innerHTML=hs.map(p=>`<div class="stat"><span>${p.name}</span><b>${Math.max(0,Math.round(p.health))}</b><small>${p.ability.name}</small></div>`).join('');playSound('whistle');}
function togglePause(){if(!matchStarted||gameOver||replayClock>0)return;paused=!paused;if(paused){ui.hud.hidden=true;showScreen('pause')}else{ui.hud.hidden=false;showScreen(null)}}
function flashScreen(){ui.flash.animate([{opacity:.8},{opacity:0}],{duration:260,easing:'ease-out'})}
let shakeAmp=0,shakeT=0;function screenShake(a){if(!CFG.shake)return;shakeAmp=Math.max(shakeAmp,a);shakeT=.35}
function updateCamera(dt){const live=players.filter(p=>p.knockout<1);const c=ball.pos();let cx=c.x,cz=c.z;if(live.length){let avg=new V3();for(const p of live)avg.add(p.pos());avg.multiplyScalar(1/live.length);cx=T.damp(camera.position.x,cx*.55,4,dt);cz=T.damp(camera.position.z,avg.z*.45+8,4,dt)}camera.position.x=T.damp(camera.position.x,cx,4,dt);const spread=players.filter(p=>p.index<4&&p.knockout<1).reduce((m,p)=>Math.max(m,c.distanceTo(p.pos())),4); const camY=T.clamp(17+spread*.48,17,25); const camZ=T.clamp(18+spread*.25,18,24);camera.position.y=T.damp(camera.position.y,camY,4,dt);camera.position.z=T.damp(camera.position.z,cz+camZ,4,dt);camera.lookAt(c.x*.35,1.1,c.z*.25);if(shakeT>0){shakeT-=dt;camera.position.x+=rand(-shakeAmp,shakeAmp)*shakeT;camera.position.y+=rand(-shakeAmp,shakeAmp)*.3*shakeT}else shakeAmp*=.88}
function updateHUD(){ui.timer.textContent=CFG.mode==='practice'?'∞':`${Math.max(0,Math.ceil(matchClock)/60|0)}:${String(Math.max(0,Math.ceil(matchClock)%60)).padStart(2,'0')}`;const main=players[0];if(main){const a=main.ability;ui.abilityIcon.textContent=a.icon;ui.abilityIcon.style.borderColor=hex(a.color);ui.abilityName.textContent=a.name;ui.abilityMeta.textContent=main.cool>0?`${main.cool.toFixed(1)}s • ${a.rarity}`:`READY • ${a.rarity} • Q`}
 ui.cool.style.setProperty('--cool',`${main&&main.cool>0?(main.cool/Math.max(.1,main.ability.cd))*360:0}deg`);ui.playersHud.innerHTML=players.filter(p=>p.index<4).map(p=>`<div class="phud"><div class="top"><span>${p.inputType==='G'?'🎮 ':''}${p.name} <span class="pill" style="color:${hex(p.ability.color)}">${p.ability.rarity}</span></span><b>${Math.max(0,Math.round(p.health))}</b></div><div class="meter"><i style="width:${Math.max(0,p.health)}%"></i></div></div>`).join('');}

function snapshotState(){return {t:performance.now()/1000,score:[...score],clock:matchClock,ball:{p:ball.pos().toArray(),v:Object.values(ball.body.linvel())},players:players.filter(p=>p.index<4).map(p=>({i:p.index,p:p.pos().toArray(),v:Object.values(p.root.linvel()),hp:p.health,ko:p.knockout}))}}
const snapshots=[];
function saveSnapshot(){snapshots.push(snapshotState());while(snapshots.length>120)snapshots.shift()}
function rewindState(){const now=performance.now()/1000;const target=now-4;const s=[...snapshots].reverse().find(s=>s.t<=target);if(!s)return;score=s.score;matchClock=s.clock;ball.body.setTranslation({x:s.ball.p[0],y:s.ball.p[1],z:s.ball.p[2]},true);ball.body.setLinvel({x:s.ball.v[0],y:s.ball.v[1],z:s.ball.v[2]},true);for(const d of s.players){const p=players.find(x=>x.index===d.i);if(p){p.root.setTranslation({x:d.p[0],y:d.p[1],z:d.p[2]},true);p.root.setLinvel({x:d.v[0],y:d.v[1],z:d.v[2]},true);p.health=d.hp;p.knockout=d.ko}}flashScreen();}

function createWorld(){world=new RAPIER.World({x:0,y:CFG.gravity,z:0});world.integrationParameters.dt=1/CFG.physicsHz;world.integrationParameters.maxCcdSubsteps=4;addField();addLights();ball=new Ball();players=[];for(let i=0;i<4;i++)players.push(new Player(i,i<2?0:1));addWeather();buildDevUI();buildModeUI();buildTouchControls();}
function buildModeUI(){const g=$('modeGrid');g.innerHTML='';for(const [id,[n,d]] of Object.entries(MODES)){const b=document.createElement('button');b.className='modeCard'+(id===CFG.mode?' active':'');b.dataset.mode=id;b.innerHTML=`<b>${n}</b><small>${d}</small>`;b.onclick=()=>{CFG.mode=id;document.querySelectorAll('.modeCard').forEach(x=>x.classList.remove('active'));b.classList.add('active')};g.appendChild(b)}}
function buildDevUI(){const g=$('devGrid');g.innerHTML='';for(const a of ABILITIES){const b=document.createElement('button');b.className='card';b.style.borderColor=hex(a.color);b.innerHTML=`<b>${a.icon} ${a.name}</b><small>${a.rarity} • ${a.cd}s</small>`;b.onclick=()=>{for(const p of players.filter(p=>p.index<4))p.ability=a;showGoText(`FORCED: ${a.name}`,a.rarity)};g.appendChild(b)}}
function buildTouchControls(){ui.touch.innerHTML='';for(let i=0;i<4;i++){const q=document.createElement('div');q.className=`touchQuad q${i}`;const stick=document.createElement('div');stick.className='touchStick';const knob=document.createElement('div');knob.className='touchKnob';stick.appendChild(knob);const btns=document.createElement('div');btns.className='touchBtns';for(const [name,label] of [['jump','JUMP'],['kick','KICK'],['ability','ULT']]){const b=document.createElement('button');b.className='touchBtn '+name;b.textContent=label;b.dataset.p=i;btns.appendChild(b);const down=ev=>{ev.preventDefault();TOUCH[i][name]=true;b.setPointerCapture?.(ev.pointerId)};const up=ev=>{ev.preventDefault();TOUCH[i][name]=false};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up)}q.appendChild(stick);q.appendChild(btns);stick.addEventListener('pointerdown',e=>{e.preventDefault();stick.setPointerCapture?.(e.pointerId);setStick(i,e,stick,knob)});stick.addEventListener('pointermove',e=>{if(stick.hasPointerCapture?.(e.pointerId))setStick(i,e,stick,knob)});stick.addEventListener('pointerup',()=>resetStick(i,knob));stick.addEventListener('pointercancel',()=>resetStick(i,knob));ui.touch.appendChild(q)}}
function setStick(i,e,el,knob){const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.38,mag=Math.min(max,Math.hypot(dx,dy));const nx=mag?dx/Math.hypot(dx,dy):0,ny=mag?dy/Math.hypot(dx,dy):0;knob.style.transform=`translate(${nx*mag}px,${ny*mag}px)`;TOUCH[i].x=nx;TOUCH[i].z=ny;TOUCH[i].active=true}
function resetStick(i,knob){knob.style.transform='translate(0,0)';TOUCH[i].x=0;TOUCH[i].z=0;TOUCH[i].active=false}

function getGamepadInput(i){const gps=navigator.getGamepads?navigator.getGamepads():[];const gp=gamepadSlots[i]!=null?gps[gamepadSlots[i]]:null;if(!gp)return {active:false,x:0,z:0,jump:false,kick:false,ability:false};return {active:true,x:deadzone(gp.axes[0]||0),z:deadzone(gp.axes[1]||0),jump:!!gp.buttons[0]?.pressed,kick:!!gp.buttons[1]?.pressed,ability:!!gp.buttons[3]?.pressed}}
function deadzone(v){return Math.abs(v)<.12?0:v}
const gamepadSlots=[null,null,null,null];function scanGamepads(){const gps=navigator.getGamepads?navigator.getGamepads():[];for(let i=0;i<gps.length;i++){const gp=gps[i];if(!gp)continue;if(!gamepadSlots.includes(i)){const slot=gamepadSlots.findIndex(x=>x==null);if(slot>=0)gamepadSlots[slot]=i}}}window.addEventListener('gamepadconnected',scanGamepads);window.addEventListener('gamepaddisconnected',e=>{const i=gamepadSlots.indexOf(e.gamepad.index);if(i>=0)gamepadSlots[i]=null});

function makeAudio(){if(audioCtx)return;audioCtx=new AudioContext();musicGain=audioCtx.createGain();musicGain.gain.value=CFG.volume*.08;musicGain.connect(audioCtx.destination);let last=0;musicTimer=setInterval(()=>{if(!audioCtx||paused||!matchStarted)return;const now=audioCtx.currentTime;if(now-last<.08)return;last=now;const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type='triangle';osc.frequency.value=[110,146.8,164.8,196][Math.floor(Math.random()*4)];g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(.04*CFG.volume,now+.01);g.gain.exponentialRampToValueAtTime(.0001,now+.16);osc.connect(g).connect(musicGain);osc.start(now);osc.stop(now+.17)},180)}
function playSound(kind){if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),n=audioCtx.currentTime;const set=(f1,f2,d=.15,type='sine',vol=.12)=>{o.type=type;o.frequency.setValueAtTime(f1,n);o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),n+d);g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(vol*CFG.volume,n+.01);g.gain.exponentialRampToValueAtTime(.0001,n+d);o.connect(g).connect(audioCtx.destination);o.start(n);o.stop(n+d+.02)};
switch(kind){case 'jump':set(420,180,.13,'triangle',.08);break;case 'kick':set(160,65,.1,'square',.09);break;case 'tackle':set(110,42,.22,'sawtooth',.18);break;case 'goal':set(140,520,.7,'sawtooth',.2);setTimeout(()=>set(300,80,.28,'triangle',.16),220);break;case 'ability':set(220,880,.35,'triangle',.15);break;case 'whistle':set(1100,780,.38,'square',.1);break}}

function destroyWorld(){while(scene.children.length)scene.remove(scene.children[0]);if(ball?.mesh)scene.remove(ball.mesh);players=[];clones=[];particles=[]}

function step(dt){
  if(!matchStarted||paused)return;
  if(replayClock>0)replayClock-=dt;
  const simDt=replayClock>0?dt*.18:dt; if(CFG.mode!=='practice'){matchClock-=simDt;if(matchClock<=0){matchClock=0;endMatch(score[0]>=score[1]?0:1);return}}
  for(const p of players){p.cool=Math.max(0,p.cool-simDt);p.stun=Math.max(0,p.stun-simDt);p.updateInput();if(activeGravityFlip(p))p.root.applyImpulse({x:0,y:12*simDt,z:0},true);p.drive(simDt)}
  world.integrationParameters.dt=1/CFG.physicsHz;world.step();doTackles();ball.update(simDt);for(const p of players)p.syncMeshes();checkGroundAndOOB();saveSnapshot();updateHUD();
  if(goalLock<=0 && ball.pos().y<.8)spawnBurst('dust',ball.pos(),2,1.2);
  updateParticles(simDt);updateTexts(simDt);updateWeather(simDt);updateCamera(simDt);updateAbilityFx(simDt);
}
function updateAbilityFx(dt){for(let i=abilityFX.length-1;i>=0;i--){const f=abilityFX[i];f.life-=dt; if(f.kind==='shockwaveSlam'){const r=3*(1-f.life);const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.01,r),.05,8,40),new THREE.MeshBasicMaterial({color:f.color,transparent:true,opacity:f.life}));ring.rotation.x=-Math.PI/2;ring.position.copy(f.p);scene.add(ring);setTimeout(()=>scene.remove(ring),90)} if(f.life<=0)abilityFX.splice(i,1)}}

function animate(){requestAnimationFrame(animate);const raw=clock.getDelta();const cap=CFG.fpsCap?1/CFG.fpsCap:0;const dt=cap?Math.min(raw,cap):Math.min(raw,.033);scanGamepads();step(dt);renderer.render(scene,camera);keyPressed.clear();}

$('startBtn').onclick=()=>startMatch(CFG.mode);$('resumeBtn').onclick=()=>togglePause();$('pauseMenuBtn').onclick=()=>{paused=false;matchStarted=false;ui.hud.hidden=true;showScreen('menu')};$('practiceBtn').onclick=()=>{CFG.mode='practice';startMatch('practice')};$('settingsBtn').onclick=()=>showScreen('settings');$('controlsBtn').onclick=()=>showScreen('controls');$('devBtn').onclick=()=>showScreen('dev');$('settingsBack').onclick=()=>{CFG.matchLength=+$('setLength').value;CFG.weather=$('setWeather').value;CFG.graphics=$('setGraphics').value;CFG.shake=$('setShake').value==='1';CFG.volume=+$('setVolume').value;CFG.fpsCap=+$('setFps').value;addWeather();if(scene.userData.hemi)scene.userData.hemi.intensity=CFG.weather==='night'?.28:1.25;if(scene.userData.sun)scene.userData.sun.intensity=CFG.weather==='night'?.18:2.4;showScreen('menu')};$('controlsBack').onclick=()=>showScreen('menu');$('devBack').onclick=()=>showScreen('menu');$('rematchBtn').onclick=()=>startMatch(CFG.mode);$('menuBtn').onclick=()=>{showScreen('menu');ui.hud.hidden=true};
window.addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);document.body.classList.toggle('touchable',matchMedia('(pointer:coarse)').matches||innerWidth<700)});

document.body.classList.toggle('touchable',matchMedia('(pointer:coarse)').matches||innerWidth<700);

makeRenderer();createWorld();animate();
