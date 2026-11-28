window.addEventListener("error", function (event) {
  let panel = document.getElementById("fatal-game-error");
  if (!panel) {
    panel = document.createElement("pre");
    panel.id = "fatal-game-error";
    panel.style.cssText = "position:fixed;z-index:99999;left:8px;right:8px;top:8px;max-height:45vh;overflow:auto;margin:0;padding:12px;background:#260b0b;color:#fff;border:2px solid #ff5555;font:13px/1.4 monospace;white-space:pre-wrap";
    document.body.appendChild(panel);
  }
  panel.textContent = "UNDERTALE WEB RUNTIME ERROR
" +
    (event.message || "Unknown error") + "
" +
    (event.filename || "") + ":" + (event.lineno || 0) + ":" + (event.colno || 0);
});
window.addEventListener("unhandledrejection", function (event) {
  let panel = document.getElementById("fatal-game-error");
  if (!panel) {
    panel = document.createElement("pre");
    panel.id = "fatal-game-error";
    panel.style.cssText = "position:fixed;z-index:99999;left:8px;right:8px;top:8px;max-height:45vh;overflow:auto;margin:0;padding:12px;background:#260b0b;color:#fff;border:2px solid #ff5555;font:13px/1.4 monospace;white-space:pre-wrap";
    document.body.appendChild(panel);
  }
  panel.textContent = "UNDERTALE WEB PROMISE ERROR
" + String(event.reason);
});

(() => {
  "use strict";
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const statsEl = document.querySelector("#stats");
  const goldEl = document.querySelector("#gold");
  const roomEl = document.querySelector("#room");
  const helpEl = document.querySelector("#help");

  const W = 320, H = 240, SAVE_KEY = "undertale-web-save";
  const keys = new Set();
  let mode = "title", roomId = "entrance", dialog = null, toast = "", toastUntil = 0;
  let lastTime = 0, battle = null, menuIndex = 0, menuPage = "root";
  let encounterCooldown = 0, stepCount = 0, mossEncounterDone = false;
  let openingStage = 0, floweyAttack = null;
  let playerName = "CHARA", titleIndex = 0, hasSave = false, nameBuffer = "", nameCursor = 0;

  const player = { x: 160, y: 174, hp: 20, maxHp: 20, lv: 1, gold: 0, items: ["Familiar Candy"], facing: "up" };
  // Full Ruins route based on the supplied complete-map reference.
  // Each node is a playable room; links create real door-to-door transitions.
  const ruinsNodes = [
    ["entrance","Ruins Entrance",0,3,"start"],
    ["flowerbed","Golden Flower Bed",1,3,"flowers"],
    ["switch-hall","Switch Hall",2,3,"switch"],
    ["leaf-puzzle","Leaf Puzzle",3,3,"puzzle"],
    ["side-chamber-a","Quiet Chamber",3,2,"side"],
    ["long-corridor","Long Corridor",4,3,"corridor"],
    ["pressure-room","Pressure Plate Room",5,3,"plate"],
    ["side-chamber-b","Old Storage",5,4,"side"],
    ["dummy-room","Training Room",6,3,"dummy"],
    ["crossroads","Ruins Crossroads",7,3,"cross"],
    ["spider-room","Spider Bake Sale",7,2,"spider"],
    ["water-room","Waterfall Drip Room",8,3,"water"],
    ["mural-hall","Ancient Mural Hall",9,3,"mural"],
    ["switch-room","Hidden Switch Room",9,4,"switch"],
    ["bridge-room","Broken Bridge",10,3,"bridge"],
    ["pillar-room","Pillar Puzzle",11,3,"puzzle"],
    ["side-chamber-c","Forgotten Nook",11,2,"side"],
    ["toriel-approach","Toriel's Approach",12,3,"approach"],
    ["home-entry","Home Entrance",12,2,"home"],
    ["home-hall","Home Hall",13,2,"home"],
    ["home-kitchen","Home Kitchen",13,1,"home"],
    ["home-bedroom","Home Bedroom",14,1,"home"],
    ["home-exit","Home Exit",14,2,"home"],
    ["final-hall","Final Ruins Hall",15,2,"final"]
  ];
  const ruinsLinks = [
    ["entrance","flowerbed"],["flowerbed","switch-hall"],["switch-hall","leaf-puzzle"],
    ["leaf-puzzle","side-chamber-a"],["leaf-puzzle","long-corridor"],
    ["long-corridor","pressure-room"],["pressure-room","side-chamber-b"],
    ["pressure-room","dummy-room"],["dummy-room","crossroads"],
    ["crossroads","spider-room"],["crossroads","water-room"],
    ["water-room","mural-hall"],["mural-hall","switch-room"],
    ["mural-hall","bridge-room"],["bridge-room","pillar-room"],
    ["pillar-room","side-chamber-c"],["pillar-room","toriel-approach"],
    ["toriel-approach","home-entry"],["home-entry","home-hall"],
    ["home-hall","home-kitchen"],["home-kitchen","home-bedroom"],
    ["home-hall","home-exit"],["home-exit","final-hall"]
  ];
  const ruinsById = Object.fromEntries(ruinsNodes.map(n=>[n[0],n]));
  const ruinsAdj = Object.fromEntries(ruinsNodes.map(n=>[n[0],[]]));
  ruinsLinks.forEach(([a,b])=>{ruinsAdj[a].push(b);ruinsAdj[b].push(a);});
  const world = Object.fromEntries(ruinsNodes.map(([id,label,gx,gy,type])=>{
    const exits=ruinsAdj[id].map(to=>{
      const n=ruinsById[to], dx=n[2]-gx, dy=n[3]-gy;
      if(dx>0)return {x:282,y:104,w:20,h:32,to,spawn:[42,120]};
      if(dx<0)return {x:18,y:104,w:20,h:32,to,spawn:[278,120]};
      if(dy<0)return {x:144,y:18,w:32,h:20,to,spawn:[160,198]};
      return {x:144,y:202,w:32,h:20,to,spawn:[160,42]};
    });
    const props=[{type:"save",x:42,y:188}];
    if(type==="start")props.push({type:"sign",x:160,y:56,text:"The Ruins are full of puzzles. Take your time."});
    if(type==="flowers")props.push({type:"flowers",x:160,y:120});
    if(type==="switch")props.push({type:"switch",x:160,y:104,activated:false});
    if(type==="puzzle"||type==="plate")props.push({type:"plate",x:160,y:120,activated:false});
    if(type==="side")props.push({type:"chest",x:160,y:120});
    if(type==="dummy")props.push({type:"dummy",x:160,y:112});
    if(type==="spider")props.push({type:"sign",x:160,y:72,text:"Spider bake sale. All proceeds go to her cause."});
    if(type==="mural")props.push({type:"sign",x:160,y:70,text:"A mural of a strange, familiar symbol."});
    if(type==="bridge")props.push({type:"plate",x:160,y:120,activated:false});
    if(type==="approach")props.push({type:"sign",x:160,y:70,text:"A warm light shines from the home ahead."});
    if(type==="home")props.push({type:"sign",x:160,y:70,text:"It is a comfortable home, filled with love."});
    if(type==="final")props.push({type:"sign",x:160,y:70,text:"The path beyond the Ruins lies ahead."});
    const floor=type==="flowers"?"#3b3447":type==="home"?"#4a3b4a":"#30243c";
    const wall=type==="home"?"#9a7c8a":"#76627e";
    return [id,{
      label:"THE RUINS — "+label.toUpperCase(),floor,wall,accent:"#b69a9e",
      spawn:[160,178],exits,
      solids:[[18,18,284,12],[18,210,284,12],[18,18,12,204],[290,18,12,204]],
      props,npc:id==="toriel-approach"||id==="home-entry"?{x:160,y:112,name:"TORIEL",color:"#eee5d5"}:null
    }];
  }));
  

  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
  function text(s,x,y,size=8,color="#fff",align="left"){ctx.fillStyle=color;ctx.font=size+"px monospace";ctx.textAlign=align;ctx.fillText(s,x,y);ctx.textAlign="left";}
  function hud(){
    statsEl.textContent = playerName.toUpperCase()+"   LV "+player.lv+"   HP "+player.hp+"/"+player.maxHp;
    goldEl.textContent = player.gold+" G";
    roomEl.textContent = world[roomId].label;
  }
  function say(lines, after){
    dialog = {lines:Array.isArray(lines)?lines:[lines], index:0, after:after||null};
    mode = "dialog";
  }
  function nextDialog(){
    if(!dialog) return;
    dialog.index++;
    if(dialog.index >= dialog.lines.length){
      const done=dialog.after; dialog=null; mode="world";
      if(done) done();
    }
  }
  function notice(message){
    toast=message; toastUntil=performance.now()+1500;
  }
  function saveGame(){
    const data={roomId,playerName,player:{...player,items:[...player.items]}};
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));hasSave=true;notice("GAME SAVED.");}
    catch(e){notice("SAVE FAILED — STORAGE UNAVAILABLE.");}
  }
  function loadGame(){
    try{
      const data=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
      if(data && data.player && world[data.roomId]){hasSave=true;playerName=data.playerName||"FRISK";
        roomId=data.roomId; Object.assign(player,data.player);
        player.x=clamp(player.x,28,286);player.y=clamp(player.y,42,205);
      }
    }catch(e){console.warn("Save data could not be loaded.",e);}
    hud();
  }
  function collides(x,y){
    const r=world[roomId];
    const inDoorway = r.exits.some(e => x >= e.x-2 && x <= e.x+e.w+2 && y >= e.y-3 && y <= e.y+e.h+3);
    for(const s of r.solids){
      if(inDoorway && (s[2] <= 14 || s[3] <= 14)) continue;
      if(x+5>s[0] && x-5<s[0]+s[2] && y+5>s[1] && y-5<s[1]+s[3]) return true;
    }
    return false;
  }
  function move(dx,dy){
    if(dx) player.facing=dx<0?"left":"right";
    if(dy) player.facing=dy<0?"up":"down";
    const nx=player.x+dx, ny=player.y+dy;
    if(!collides(nx,player.y)) player.x=nx;
    if(!collides(player.x,ny)) player.y=ny;
    player.x=clamp(player.x,25,295);player.y=clamp(player.y,35,214);
  }
  function pixelHeart(x,y,size=1,color="#ff3030"){
    ctx.fillStyle=color;
    const p=[[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[1,2],[2,2],[3,2],[4,2],[5,2],[2,3],[3,3],[4,3],[3,4]];
    p.forEach(([a,b])=>ctx.fillRect(x+a*size,y+b*size,size,size));
  }
  function drawCharacter(x,y,kind,color){
    if(kind==="player"){
      rect(x-5,y-9,10,5,"#6d342b");rect(x-5,y-5,10,8,"#d9b58a");
      rect(x-5,y+2,10,6,"#7f2734");rect(x-4,y+7,3,2,"#d6d0c5");rect(x+1,y+7,3,2,"#d6d0c5");
      rect(x-3,y-2,2,2,"#20202a");rect(x+2,y-2,2,2,"#20202a");
    }else{
      rect(x-7,y-7,14,13,color);rect(x-5,y-3,3,2,"#263126");rect(x+2,y-3,3,2,"#263126");
      rect(x-4,y+6,3,2,"#1d2024");rect(x+1,y+6,3,2,"#1d2024");
    }
  }
  function drawWorld(){
    const r=world[roomId];
    rect(0,0,W,H,"#15101d");rect(18,18,284,204,r.floor);
    // Subtle stone floor pattern
    for(let y=28;y<210;y+=16) for(let x=28+(y%32?0:8);x<292;x+=32){
      rect(x,y,1,1,"#ffffff18");rect(x+15,y+8,1,1,"#00000025");
    }
    r.solids.forEach(s=>{rect(...s,r.wall);rect(s[0]+2,s[1]+2,Math.max(1,s[2]-4),2,"#ffffff18");});
    r.exits.forEach(e=>{rect(e.x,e.y,e.w,e.h,"#d8c6a5");rect(e.x+4,e.y+4,e.w-8,e.h-4,"#493a4e");});
    r.props.forEach(p=>{
      if(p.type==="flowers"){
        for(let i=0;i<12;i++){const fx=p.x-30+(i*13)%60,fy=p.y-12+(i*17)%24;rect(fx,fy,2,5,"#e6d77b");rect(fx,fy-2,2,2,"#fff2b2");}
      }else if(p.type==="switch"){
        rect(p.x-9,p.y-6,18,12,p.activated?"#b64a56":"#6b566e");rect(p.x-4,p.y-3,8,6,p.activated?"#f5cf68":"#b5a5bd");if(dist(player,p)<24)text("Z  FLIP",p.x-15,p.y-13,7);
      }else if(p.type==="plate"){
        rect(p.x-13,p.y-5,26,10,p.activated?"#d8c6a5":"#8c7c91");rect(p.x-9,p.y-2,18,4,p.activated?"#f4d77a":"#594a60");if(dist(player,p)<24)text("Z  PRESS",p.x-18,p.y-13,7);
      }else if(p.type==="dummy"){
        rect(p.x-10,p.y-9,20,18,"#a87543");rect(p.x-7,p.y-6,14,12,"#c9945a");rect(p.x-2,p.y-6,4,12,"#80532e");rect(p.x-14,p.y-3,4,8,"#80532e");rect(p.x+10,p.y-3,4,8,"#80532e");if(dist(player,p)<25)text("Z  TRAIN",p.x-19,p.y-16,7);
      }else if(p.type==="save"){
        text("✦",p.x-5,p.y+5,15,"#fff0a0");
        if(dist(player,p)<22) text("Z  SAVE",p.x-15,p.y-12,7,"#fff4c2");
      }else if(p.type==="chest"){
        rect(p.x-9,p.y-6,18,12,"#8d542d");rect(p.x-9,p.y-6,18,4,"#c28b4b");rect(p.x-1,p.y-3,3,4,"#f3d47b");
        if(dist(player,p)<22)text("Z  OPEN",p.x-18,p.y-12,7);
      }else if(p.type==="sign"){
        rect(p.x-10,p.y-5,20,10,"#806044");rect(p.x-2,p.y+5,4,7,"#60452e");
        if(dist(player,p)<24)text("Z  READ",p.x-17,p.y-12,7);
      }
    });
    const n=r.npc;
    if(n){drawCharacter(n.x,n.y,"npc",n.color);if(dist(player,n)<25)text("Z  TALK",n.x-16,n.y-15,7);}
    drawCharacter(player.x,player.y,"player");
    text(r.label,25,34,8,"#eee4ce");
  }
  function startBattle(enemyName="Training Dummy"){
    battle={enemy:enemyName,enemyHp:12,maxEnemyHp:12,turn:"menu",heart:{x:160,y:175},timer:0,spawnTimer:0,bullets:[],enemyText:enemyName==="Training Dummy"?"The training dummy waits patiently.":"A quiet encounter begins.",spare:false};
    mode="battle";menuPage="root";menuIndex=0;
  }
  function finishBattle(victory){
    const enemyName=battle?battle.enemy:"";
    mode="world";battle=null;encounterCooldown=2;
    if(victory){
      if(enemyName==="Training Dummy"){say(["* The training dummy lesson is complete.","* Try ACT or MERCY to end a real encounter peacefully."]);}
      else {mossEncounterDone=true;player.gold+=4;hud();say(["* You earned 4 G.","* The path ahead feels a little less lonely."]);}
    }
  }
  function chooseMenu(){
    if(!battle)return;
    if(menuPage==="root"){
      if(menuIndex===0){battle.turn="aim";battle.aim=0;}
      if(menuIndex===1){menuPage="act";menuIndex=0;}
      if(menuIndex===2){menuPage="item";menuIndex=0;}
      if(menuIndex===3){battle.spare=true;battle.enemyText="The wisp's glow softens.";battle.turn="enemy";battle.timer=0;}
    }else if(menuPage==="act"){
      battle.enemyText=menuIndex===0?"You wave gently. The wisp seems less afraid.":"You compliment its tiny glow. It flickers happily.";
      battle.spare=true;battle.turn="enemy";battle.timer=0;menuPage="root";menuIndex=0;
    }else if(menuPage==="item"){
      if(player.items.length){
        player.items.shift();player.hp=Math.min(player.maxHp,player.hp+8);hud();
        battle.enemyText="You ate a Familiar Candy. HP restored.";battle.turn="enemy";battle.timer=0;
      }else battle.enemyText="Your pockets are empty.";
      menuPage="root";menuIndex=0;
    }
  }
  function battleInput(key){
    if(!battle)return;
    if(battle.turn==="menu"){
      const count=menuPage==="root"?4:menuPage==="act"?2:Math.max(1,player.items.length);
      if(key==="ArrowLeft"||key==="a")menuIndex=(menuIndex+count-1)%count;
      if(key==="ArrowRight"||key==="d")menuIndex=(menuIndex+1)%count;
      if(key==="z"||key==="Enter"){
        if(menuPage==="root"&&menuIndex===0){battle.turn="aim";battle.aim=0;}
        else chooseMenu();
      }
      if((key==="x"||key==="Escape")&&menuPage!=="root"){menuPage="root";menuIndex=0;}
    }else if(battle.turn==="aim"){
      if(key==="ArrowLeft"||key==="a")battle.aim=Math.max(0,battle.aim-1);
      if(key==="ArrowRight"||key==="d")battle.aim=Math.min(100,battle.aim+1);
      if(key==="z"||key==="Enter"){
        const power=Math.max(1,Math.round(12-Math.abs(50-battle.aim)/7));
        battle.enemyHp-=power;battle.enemyText=power>9?"A perfectly timed strike!":"You strike the wisp.";
        if(battle.enemyHp<=0){finishBattle(true);return;}
        battle.turn="enemy";battle.timer=0;
      }
      if(key==="x"||key==="Escape")battle.turn="menu";
    }else if(battle.turn==="enemy"){
      if(key==="z"||key==="Enter"){battle.timer=2.6;}
    }else if(battle.turn==="dodge"){
      if(key==="ArrowLeft"||key==="a")battle.heart.x-=7;
      if(key==="ArrowRight"||key==="d")battle.heart.x+=7;
      if(key==="ArrowUp"||key==="w")battle.heart.y-=7;
      if(key==="ArrowDown"||key==="s")battle.heart.y+=7;
    }
  }
  function drawBattle(dt){
    rect(0,0,W,H,"#000");
    // Enemy portrait, made from original pixel shapes
    rect(130,38,60,48,"#101018");
    ctx.fillStyle="#b7d5c4";ctx.beginPath();ctx.arc(160,63,19,0,Math.PI*2);ctx.fill();
    rect(146,55,5,4,"#283a3b");rect(169,55,5,4,"#283a3b");rect(151,70,18,2,"#647b76");
    text(battle.enemy.toUpperCase(),160,24,10,"#fff","center");
    rect(110,91,100,5,"#502b35");rect(110,91,100*battle.enemyHp/battle.maxEnemyHp,5,"#d54b58");
    text(battle.enemyText,160,111,8,"#ddd","center");
    if(battle.turn==="aim"){
      rect(45,139,230,18,"#282828");rect(48,145,224,4,"#aaa");
      rect(158+battle.aim*1.08,139,3,18,"#fff");text("Z: STOP THE METER",160,128,8,"#fff","center");
      battle.aim=(battle.aim+dt*48)%100;
    }else if(battle.turn==="dodge"){
      rect(72,132,176,88,"#fff");rect(76,136,168,80,"#000");
      battle.spawnTimer-=dt;
      if(battle.spawnTimer<=0){
        battle.spawnTimer=.62;
        const side=(Math.floor(battle.timer*4)%2===0)?0:1;
        battle.bullets.push({x:side?238:82,y:150+((Math.floor(battle.timer*19)%5)*11),vx:side?-75:75});
      }
      battle.bullets.forEach(b=>{b.x+=b.vx*dt;rect(b.x-2,b.y-2,5,5,"#fff");});
      battle.bullets=battle.bullets.filter(b=>{
        if(Math.abs(b.x-battle.heart.x)<7&&Math.abs(b.y-battle.heart.y)<7){
          player.hp=Math.max(0,player.hp-2);hud();return false;
        }
        return b.x>78&&b.x<242;
      });
      if(player.hp<=0){
        player.hp=player.maxHp;hud();battle=null;mode="world";roomId="entrance";player.x=160;player.y=178;
        say(["* You wake up beside the save point."]);return;
      }
      pixelHeart(Math.round(battle.heart.x)-3,Math.round(battle.heart.y)-3,1);
      battle.timer-=dt;
      if(battle.timer<=0){battle.turn="menu";battle.enemyText="The wisp drifts back, waiting.";menuPage="root";menuIndex=0;}
    }else{
      rect(48,137,224,82,"#fff");rect(52,141,216,74,"#000");
      if(battle.turn==="enemy"){
        battle.timer+=dt;
        if(battle.timer>1.5){
          if(battle.spare){finishBattle(true);return;}
          battle.turn="dodge";battle.timer=3.2;battle.spawnTimer=0;battle.bullets=[];battle.heart={x:160,y:175};
        }
      }else{
        const opts=menuPage==="root"?["FIGHT","ACT","ITEM","MERCY"]:menuPage==="act"?["WAVE","COMPLIMENT"]:player.items;
        opts.forEach((o,i)=>{
          const x=menuPage==="root"?72+(i%2)*112:82+(i%2)*125;
          const y=menuPage==="root"?165+Math.floor(i/2)*27:178;
          text((i===menuIndex?"> ":"  ")+o,x,y,10,i===menuIndex?"#ffcf54":"#fff");
        });
      }
    }
    text((playerName||"FRISK").toUpperCase(),49,232,8);text("LV "+player.lv,112,232,8);text("HP",170,232,8);
    rect(193,224,70,8,"#522c38");rect(193,224,70*player.hp/player.maxHp,8,"#e7c34e");text(player.hp+"/"+player.maxHp,270,232,8);
    if(battle.turn==="dodge"){
      const d=Math.hypot(player.x-battle.heart.x,player.y-battle.heart.y);
      if(d<9){player.hp=Math.max(0,player.hp-1);battle.heart.x=160;hud();if(player.hp===0){player.hp=player.maxHp;say(["* You woke up at the last save point."],()=>{roomId="entrance";player.x=160;player.y=178;hud();});finishBattle(false);}}
    }
  }
  function interact(){
    const r=world[roomId];
    const npc=r.npc;
    if(npc&&dist(player,npc)<25){
      if(npc.name==="TORIEL"){
        say(["* Toriel watches over you with a gentle smile.", '* "There are many puzzles in the Ruins."', '* "If you need help, do not hesitate to ask."']);
      }else if(npc.name==="MOSS"){
        if(!mossEncounterDone){
          say(["* The little moss creature tilts its head.","* A faint glow gathers around it.","* It seems to want to test your courage."],startBattle);
        }else{
          say(["* The little moss creature gives a friendly wiggle.","* It seems happy to see you again."]);
        }
      }else{
        say(["* Dusty points toward the passage ahead.","* Take your time. There is no rush."]);
      }
      return;
    }
    for(const p of r.props){
      if(dist(player,p)<24){
        if(p.type==="save"){saveGame();return;}
        if(p.type==="switch"||p.type==="plate"){p.activated=!p.activated;say([p.type==="switch"?"* You flip the switch.":"* You step onto the pressure plate.",p.activated?"* A mechanism clicks somewhere nearby.":"* The mechanism resets."]);return;}
        if(p.type==="dummy"){say(["* The training dummy looks at you.", "* It is here to teach you how to handle encounters."],()=>startBattle("Training Dummy"));return;}
        if(p.type==="sign"){say(["* "+p.text,"* The letters are too worn to read the rest."]);return;}
        if(p.type==="chest"){
          if(!p.open){p.open=true;player.items.push("Familiar Candy");say(["* You found a Familiar Candy!","* It was added to your ITEM menu."]);}else say(["* The chest is empty."]);
          return;
        }
      }
    }
    for(const e of r.exits){
      if(player.x>e.x-8&&player.x<e.x+e.w+8&&player.y>e.y-8&&player.y<e.y+e.h+8){
        roomId=e.to;player.x=e.spawn[0];player.y=e.spawn[1];hud();return;
      }
    }
    say(["* The old stones are quiet.","* Nothing happens."]);
  }
  function update(dt){
    if(mode==="flowey"){updateFloweyAttack(dt);return;}
    if(mode==="world"){
      let dx=0,dy=0;
      if(keys.has("ArrowLeft")||keys.has("a"))dx--;
      if(keys.has("ArrowRight")||keys.has("d"))dx++;
      if(keys.has("ArrowUp")||keys.has("w"))dy--;
      if(keys.has("ArrowDown")||keys.has("s"))dy++;
      if(dx||dy){const len=Math.hypot(dx,dy);move(dx/len*75*dt,dy/len*75*dt);}
    }
  }
  function drawNameEntry(){
    rect(0,0,W,H,"#000");
    text("Name the fallen human.",160,54,13,"#fff","center");
    // The original game's simple, stark name-entry presentation.
    rect(40,91,240,52,"#fff");rect(44,95,232,44,"#000");
    text(nameBuffer.toUpperCase()+"_",56,123,14,"#fff");
    text("ENTER: CONFIRM",160,184,9,"#aaa","center");
    text("BACKSPACE: DELETE",160,201,8,"#777","center");
    text("Z / X: CANCEL",160,232,7,"#555","center");
  }
  function drawTitle(){
    rect(0,0,W,H,"#000");
    text("A HUMAN FALLS",160,36,8,"#999","center");
    text("UNDERTALE",160,86,27,"#fff","center");
    text("WEB EDITION",160,103,8,"#bbb","center");
    rect(74,118,172,1,"#555");
    const opts=hasSave?["START","CONTINUE","OPTIONS"]:["START","OPTIONS"];
    opts.forEach((v,i)=>text((i===titleIndex?"> ":"  ")+v,160,150+i*22,11,i===titleIndex?"#ffcf54":"#fff","center"));
    text("Z / ENTER: SELECT",160,233,7,"#777","center");
  }
  function beginNewGame(){
    roomId="entrance";player.x=160;player.y=178;player.hp=20;player.gold=0;player.lv=1;
    player.items=["Familiar Candy"];mossEncounterDone=false;
    openingStage=0;mode="opening";dialog=null;hud();
  }
  function drawHuman(x,y,scale=1){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    rect(-4,-12,8,7,"#e5b98c");rect(-5,-5,10,10,"#4b6da1");
    rect(-5,5,4,7,"#29243a");rect(1,5,4,7,"#29243a");
    rect(-4,-14,8,3,"#59402e");ctx.restore();
  }
  function drawFlowey(x,y){
    // Flowey: a bright, friendly-looking flower with the familiar yellow
    // face, pale petals, green stem and two leaves. Built from crisp pixel
    // clusters so the silhouette reads clearly at the game's native scale.
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    // Green stem and leaves sit behind the flower head.
    rect(-2,10,4,23,"#39833d");
    rect(-3,18,3,5,"#39833d");rect(-9,14,8,4,"#39833d");
    rect(2,22,3,5,"#39833d");rect(4,18,8,4,"#39833d");
    rect(-2,30,4,3,"#286b36");
    // Eight soft, pale-yellow petals with warm inner shading.
    const petals=[
      [-4,-27,8,10],[-15,-24,9,8],[-22,-12,10,8],[-17,2,9,8],
      [-4,9,8,10],[7,2,9,8],[12,-12,10,8],[6,-24,9,8]
    ];
    petals.forEach(([px,py,pw,ph])=>{
      rect(px,py,pw,ph,"#fff4b5");
      rect(px+2,py+2,Math.max(2,pw-4),Math.max(2,ph-4),"#f8e99a");
    });
    // Stepped round face, avoiding a blurry anti-aliased circle.
    rect(-7,-13,14,26,"#f5df45");
    rect(-11,-9,22,18,"#f5df45");
    rect(-9,-12,18,24,"#f5df45");
    rect(-7,-10,14,20,"#ffed59");
    // Large, dark eyes and a cheerful curved pixel smile.
    rect(-7,-4,4,5,"#241d18");rect(4,-4,4,5,"#241d18");
    rect(-5,5,3,2,"#35251c");rect(-2,7,4,2,"#35251c");rect(2,5,3,2,"#35251c");
    rect(-9,-7,2,2,"#fff6bd");rect(2,-7,2,2,"#fff6bd");
    ctx.restore();
  }
  function drawToriel(x,y){
    // Original, crisp pixel-art interpretation of Toriel: soft goat features
    // and her familiar purple robe. Drawn from simple pixel clusters, not a
    // stretched geometric placeholder.
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    // Robe silhouette and sleeves
    rect(-13,-7,26,18,"#6b3b83");
    rect(-17,-5,6,13,"#6b3b83");rect(11,-5,6,13,"#6b3b83");
    rect(-12,8,24,5,"#56306e");
    rect(-9,11,6,3,"#eee8dc");rect(3,11,6,3,"#eee8dc");
    // Robe collar
    rect(-8,-9,16,5,"#f2eee4");
    rect(-5,-7,10,3,"#d7cbbd");
    // Hood / head
    rect(-10,-25,20,17,"#eee8dc");
    rect(-8,-28,16,5,"#eee8dc");
    rect(-7,-31,5,4,"#eee8dc");rect(2,-31,5,4,"#eee8dc");
    // Long floppy ears, extending out and down
    rect(-15,-25,6,5,"#eee8dc");rect(-18,-22,5,11,"#eee8dc");
    rect(-16,-12,5,4,"#eee8dc");rect(9,-25,6,5,"#eee8dc");
    rect(13,-22,5,11,"#eee8dc");rect(11,-12,5,4,"#eee8dc");
    rect(-16,-20,2,8,"#c9b9b2");rect(14,-20,2,8,"#c9b9b2");
    // Gentle face: eyes, muzzle and small smile
    rect(-6,-21,3,4,"#493b42");rect(3,-21,3,4,"#493b42");
    rect(-2,-17,4,3,"#d99b9c");rect(-1,-14,2,1,"#7a5556");
    rect(-4,-12,8,1,"#b98f8e");
    // Delta Rune-like golden emblem on the chest
    rect(-1,-5,2,2,"#f0d27b");rect(-5,-2,2,2,"#f0d27b");
    rect(3,-2,2,2,"#f0d27b");rect(-2,1,4,1,"#f0d27b");
    ctx.restore();
  }
  function openingText(lines){
    rect(12,157,296,72,"#fff");rect(16,161,288,64,"#000");
    lines.forEach((line,i)=>text(line,27,181+i*15,9,"#fff"));
    text("Z / ENTER  ▼",291,216,7,"#aaa","right");
  }
  function drawOpening(){
    rect(0,0,W,H,"#000");
    if(openingStage===0){
      text("LONG AGO, TWO RACES RULED OVER EARTH:",160,72,9,"#fff","center");
      text("HUMANS AND MONSTERS.",160,92,11,"#fff","center");
      text("One day, war broke out between them.",160,126,8,"#aaa","center");
      text("The humans were victorious.",160,140,8,"#aaa","center");
    }else if(openingStage===1){
      text("THE HUMANS SEALED THE MONSTERS",160,65,9,"#fff","center");
      text("UNDERGROUND WITH A MAGIC BARRIER.",160,81,9,"#fff","center");
      rect(55,112,210,2,"#766b88");rect(64,116,192,50,"#33283f");
      text("MOUNT EBBOTT",160,192,9,"#aaa","center");
    }else if(openingStage===2){
      rect(0,0,W,H,"#090910");
      text("201X",160,30,9,"#aaa","center");
      rect(0,175,320,65,"#17131b");
      for(let i=0;i<9;i++){rect(20+i*34,155-(i%3)*12,24,30+(i%3)*12,"#302a39");}
      drawHuman(160,142,1.5);
      text("A child climbed the mountain.",160,216,9,"#fff","center");
    }else if(openingStage===3){
      rect(0,0,W,H,"#11101b");
      rect(48,20,224,200,"#30283b");
      rect(56,28,208,184,"#4b3b51");
      rect(95,80,130,112,"#c5a65c");
      for(let i=0;i<34;i++){const x=105+(i*37%110),y=90+(i*23%90);rect(x,y,2,5,"#f2e4a0");}
      drawHuman(160,150,1.4);
      openingText(["* You fall a long way down.","* Soft flowers break your fall."]);
    }else if(openingStage===4){
      rect(0,0,W,H,"#171323");
      rect(0,178,320,62,"#382d47");
      for(let i=0;i<30;i++)rect((i*47)%320,180+(i*13)%55,2,2,"#796b84");
      drawHuman(160,164,1.3);drawFlowey(160,111);
      openingText(["* A flower approaches you.", '* "Howdy! I\'m FLOWEY."']);
    }else if(openingStage===5){
      rect(0,0,W,H,"#171323");rect(0,178,320,62,"#382d47");
      drawHuman(160,164,1.3);drawFlowey(160,111);
      text("FLOWEY",160,30,10,"#fff","center");
      openingText(['* "Your SOUL is the very source', '* of your being!"']);
    }else if(openingStage===6){
      rect(0,0,W,H,"#171323");rect(0,178,320,62,"#382d47");
      drawHuman(160,164,1.3);drawFlowey(160,111);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;pixelHeart(160+Math.cos(a)*35-3,111+Math.sin(a)*25-3,1,"#fff");}
      openingText(["* Flowey surrounds you with","* strange, smiling pellets..."]);
    }else if(openingStage===7){
      rect(0,0,W,H,"#171323");rect(0,178,320,62,"#382d47");
      drawHuman(160,164,1.3);drawFlowey(160,111);drawToriel(92,150);
      rect(110,70,100,3,"#fff");rect(110,73,100,2,"#bdb5d1");
      openingText(["* A stranger drives the flower away.", '* "Come along, my child."']);
    }else{
      rect(0,0,W,H,"#20182b");
      rect(24,25,272,190,"#4b3b51");
      rect(32,33,256,174,"#30283b");
      text("THE RUINS",160,58,13,"#fff","center");
      drawHuman(160,157,1.3);drawToriel(210,151);
      openingText(["* You follow Toriel into the Ruins.","* She offers to guide you."]);
    }
  }
  function startFloweyAttack(){
    mode="flowey";
    floweyAttack={heart:{x:160,y:164},time:0,bullets:[],spawn:0,hit:false};
  }
  function updateFloweyAttack(dt){
    if(!floweyAttack)return;
    const a=floweyAttack;
    let dx=0,dy=0;
    if(keys.has("ArrowLeft")||keys.has("a"))dx--;
    if(keys.has("ArrowRight")||keys.has("d"))dx++;
    if(keys.has("ArrowUp")||keys.has("w"))dy--;
    if(keys.has("ArrowDown")||keys.has("s"))dy++;
    const len=Math.hypot(dx,dy)||1;
    a.heart.x=clamp(a.heart.x+dx/len*95*dt,112,208);
    a.heart.y=clamp(a.heart.y+dy/len*95*dt,139,190);
    a.time+=dt;a.spawn-=dt;
    if(a.spawn<=0&&a.time<2.25){
      a.spawn=.22;
      const angle=Math.atan2(a.heart.y-164,a.heart.x-160);
      for(let n=-1;n<=1;n++){
        const ang=angle+n*.34;
        a.bullets.push({x:160+Math.cos(ang)*57,y:164+Math.sin(ang)*43,vx:Math.cos(ang)*82,vy:Math.sin(ang)*82});
      }
    }
    a.bullets=a.bullets.filter(b=>{
      b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(Math.hypot(b.x-a.heart.x,b.y-a.heart.y)<7&&!a.hit){a.hit=true;}
      return b.x>103&&b.x<217&&b.y>128&&b.y<201;
    });
    // Flowey's pellets close in, but Toriel intervenes before they can hurt the child.
    if(a.time>2.8){floweyAttack=null;openingStage=7;mode="opening";}
  }
  function drawFloweyAttack(){
    rect(0,0,W,H,"#171323");
    rect(0,0,W,112,"#21182c");
    drawFlowey(160,72);
    text("FLOWEY",160,16,9,"#fff","center");
    text('"DIE!"',160,111,10,"#ffdf58","center");
    rect(103,128,114,76,"#fff");rect(107,132,106,68,"#000");
    floweyAttack?.bullets.forEach(b=>pixelHeart(Math.round(b.x)-3,Math.round(b.y)-3,1,"#fff"));
    if(floweyAttack)pixelHeart(Math.round(floweyAttack.heart.x)-3,Math.round(floweyAttack.heart.y)-3,1);
    text("MOVE: ARROW KEYS",160,221,7,"#aaa","center");
  }
  function advanceOpening(){
    if(openingStage===6){startFloweyAttack();return;}
    openingStage++;
    if(openingStage>8){
      mode="world";roomId="entrance";player.x=160;player.y=178;
      world.entrance.npc={x:160,y:110,name:"TORIEL",color:"#eee5d5"};
      hud();
      say(["* Toriel: Welcome to the RUINS, my child.","* I will guide you through this place."]);
    }
  }
  function startFromTitle(){
    const opts=hasSave?["START","CONTINUE","OPTIONS"]:["START","OPTIONS"];
    if(opts[titleIndex]==="CONTINUE"){loadGame();mode="world";dialog=null;hud();}
    else if(opts[titleIndex]==="OPTIONS"){notice("OPTIONS COMING SOON.");}
    else {nameBuffer="";mode="name";}
  }
  function drawFullMap(){
    rect(0,0,W,H,"#08070b");text("THE RUINS — MAP",160,18,11,"#fff","center");
    const sx=18,sy=42,stepX=18,stepY=31;
    ruinsLinks.forEach(([a,b])=>{const na=ruinsById[a],nb=ruinsById[b];ctx.strokeStyle="#765b83";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(sx+na[2]*stepX,sy+na[3]*stepY);ctx.lineTo(sx+nb[2]*stepX,sy+nb[3]*stepY);ctx.stroke();});
    ruinsNodes.forEach(n=>{const x=sx+n[2]*stepX,y=sy+n[3]*stepY;rect(x-5,y-4,10,8,n[0]===roomId?"#ffdf5c":"#b57ac2");rect(x-3,y-2,6,4,"#35243e");});
    text("YELLOW = YOU",160,218,8,"#ffdf5c","center");text("M / X: RETURN",160,232,7,"#aaa","center");
  }
  function draw(){
    if(mode==="map"){drawFullMap();return;}
    if(mode==="title"){drawTitle();return;}
    if(mode==="name"){drawNameEntry();return;}
    if(mode==="opening"){drawOpening();return;}
    if(mode==="flowey"){drawFloweyAttack();return;}
    if(mode==="battle"){drawBattle(Math.min(.05,(performance.now()-lastTime)/1000||0));return;}
    drawWorld();
    if(dialog){
      rect(0,0,W,H,"#0008");rect(13,143,294,84,"#fff");rect(17,147,286,76,"#000");
      text(dialog.lines[dialog.index],29,174,10,"#fff");
      text("Z  /  ENTER  ▼",290,211,7,"#bcbcbc","right");
    }
    if(toast&&performance.now()<toastUntil){
      rect(91,8,138,18,"#eee");rect(94,11,132,12,"#111");text(toast,160,20,7,"#fff","center");
    }
  }
  function frame(t){
    const dt=Math.min(.05,(t-lastTime)/1000||0);lastTime=t;
    update(dt);draw();
    const boot=document.getElementById("boot-status");if(boot)boot.remove();
    requestAnimationFrame(frame);
  }
  window.addEventListener("keydown",e=>{
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();
    keys.add(k);
    if(e.repeat)return;
    if(mode==="title"){const n=hasSave?3:2;if(k==="ArrowDown"||k==="s")titleIndex=(titleIndex+1)%n;if(k==="ArrowUp"||k==="w")titleIndex=(titleIndex+n-1)%n;if(k==="z"||k==="Enter")startFromTitle();return;}
    if(mode==="opening"){if(k==="z"||k==="Enter")advanceOpening();return;}
    if(mode==="flowey"){return;}
    if(mode==="map"){if(k==="m"||k==="x"||k==="Escape")mode="world";return;}
    if(mode==="name"){
      if(k==="Escape"||k==="x"){mode="title";return;}
      if(k==="Backspace"){nameBuffer=nameBuffer.slice(0,-1);return;}
      if(k==="Enter"||k==="z"){
        if(nameBuffer.trim().length){playerName=nameBuffer.trim().slice(0,6).toUpperCase();beginNewGame();}
        return;
      }
      if(/^[a-z]$/i.test(k)&&nameBuffer.length<6)nameBuffer+=k.toUpperCase();
      return;
    }
    if(mode==="dialog"&&(k==="z"||k==="Enter")){nextDialog();return;}
    if(mode==="battle"){battleInput(k);return;}
    if(mode==="world"&&(k==="z"||k==="Enter"))interact();
    if(mode==="world"&&k==="m")mode="map";
    if(mode==="world"&&k==="Escape")notice("THE WORLD IS WAITING.");
  });
  window.addEventListener("keyup",e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
  window.addEventListener("blur",()=>keys.clear());
  loadGame();mode="title";hud();requestAnimationFrame(frame);
})();