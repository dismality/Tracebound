const ROWS = 8;
const COLS = 14;
const ALGORITHMS = {
  astar: {
    name: "A* Search", optimal: "Yes, with an admissible heuristic", weighted: true,
    brief: "Balances distance travelled with an estimate of what remains.",
    best: "A destination is known and the heuristic matches the movement rules.",
    watch: "A weak heuristic behaves like Dijkstra; a bad one can lose optimality.",
    verdict: "A* usually explores less of the map than Dijkstra because it directs attention toward the goal while still accounting for accumulated cost."
  },
  dijkstra: {
    name: "Dijkstra", optimal: "Yes", weighted: true,
    brief: "Expands the lowest-cost route discovered so far—without guessing direction.",
    best: "Terrain has different costs and you need a guaranteed cheapest route.",
    watch: "It explores broadly because it has no estimate of where the goal lies.",
    verdict: "Dijkstra is the reliable baseline for weighted maps. It is often slower than A* because it searches in every promising direction, not specifically toward the goal."
  },
  bfs: {
    name: "Breadth-First Search", optimal: "Yes, on unweighted maps", weighted: false,
    brief: "Explores the board layer by layer using a first-in, first-out queue.",
    best: "Every move costs the same and the shortest number of steps matters.",
    watch: "It ignores terrain cost and can consume substantial memory on open maps.",
    verdict: "BFS guarantees the fewest steps on an unweighted grid. On weighted terrain, the shortest route in steps may be more expensive."
  },
  dfs: {
    name: "Depth-First Search", optimal: "No", weighted: false,
    brief: "Commits to one branch before backtracking, using a last-in, first-out stack.",
    best: "Memory is tight or any reachable solution is enough.",
    watch: "It can follow a very long detour and does not guarantee the shortest path.",
    verdict: "DFS may find a route quickly when its first branch happens to be good. That speed is luck, not an optimality guarantee."
  },
  greedy: {
    name: "Greedy Best-First", optimal: "No", weighted: false,
    brief: "Chases whichever cell appears closest to the goal and ignores cost so far.",
    best: "A quick plausible route matters more than the cheapest guaranteed route.",
    watch: "Obstacles can lure it into convincing but expensive dead ends.",
    verdict: "Greedy search can feel exceptionally fast on open maps. It is easily misled because it values apparent closeness over the journey already taken."
  },
  bidirectional: {
    name: "Bidirectional BFS", optimal: "Yes, on unweighted maps", weighted: false,
    brief: "Runs two breadth-first searches—one from each end—until they meet.",
    best: "The map is large, unweighted, and both endpoints are known.",
    watch: "Narrow corridors reduce its advantage, and weighted maps need a different method.",
    verdict: "Bidirectional BFS can explore dramatically fewer nodes because each search covers roughly half the distance. Its advantage shrinks in constrained corridors."
  }
};

const OBJECTIVES = {
  travelTime: {label:"Travel time", terrainCost:6, unit:"min", meaning:"Total estimated minutes across the chosen route."},
  distance: {label:"Distance", terrainCost:2, unit:"blocks", meaning:"Physical movement required to reach the destination."},
  cost: {label:"Operating cost", terrainCost:7, unit:"credits", meaning:"Combined toll, fuel, staffing, or service expense."},
  safety: {label:"Risk exposure", terrainCost:10, unit:"risk", meaning:"Accumulated exposure to hazardous locations."},
  energy: {label:"Energy required", terrainCost:5, unit:"units", meaning:"Battery or physical energy consumed by the route."}
};

const WORLD_MODES = {
  abstract: {title:"Break the grid.", brief:"Explore how search choices change a route through an abstract grid.", start:"Start", goal:"Goal", wall:"Wall", weight:"Terrain", expanded:"Nodes expanded", frontier:"Max frontier", length:"Path length", compute:"Compute time", disruption:"A new barrier appeared.", disruptionType:"wall", defaultObjective:"distance"},
  emergency: {title:"Reach the incident.", brief:"Route an emergency crew around closures and traffic while every minute matters.", start:"Responder", goal:"Incident", wall:"Closed road", weight:"Traffic", expanded:"Locations checked", frontier:"Peak route options", length:"Road segments", compute:"Decision time", disruption:"A road suddenly closed.", disruptionType:"wall", defaultObjective:"travelTime"},
  warehouse: {title:"Move the payload.", brief:"Guide a warehouse robot between shelves while avoiding congestion and wasted battery.", start:"Robot", goal:"Packing station", wall:"Shelf", weight:"Congested aisle", expanded:"Aisles scanned", frontier:"Queued route options", length:"Aisle moves", compute:"Planning time", disruption:"An aisle became occupied.", disruptionType:"wall", defaultObjective:"energy"},
  evacuation: {title:"Find a safe exit.", brief:"Move through a building while blocked passages and hazardous areas evolve.", start:"People", goal:"Safe exit", wall:"Blocked corridor", weight:"Smoke", expanded:"Rooms checked", frontier:"Candidate exits held", length:"Corridor steps", compute:"Decision time", disruption:"Smoke spread into nearby rooms.", disruptionType:"weight", defaultObjective:"safety"},
  delivery: {title:"Complete the delivery.", brief:"Balance traffic, distance, and operating expense across a changing road network.", start:"Courier", goal:"Customer", wall:"Road closure", weight:"Traffic / toll", expanded:"Roads evaluated", frontier:"Routes held", length:"Route segments", compute:"Planning time", disruption:"Traffic increased on the planned route.", disruptionType:"weight", defaultObjective:"cost"},
  network: {title:"Restore the route.", brief:"Send data through a network while latency rises and connections fail.", start:"Source server", goal:"Destination", wall:"Failed link", weight:"High latency", expanded:"Routers checked", frontier:"Queued routes", length:"Network hops", compute:"Routing time", disruption:"A network connection failed.", disruptionType:"wall", defaultObjective:"travelTime"},
  game: {title:"Outthink the map.", brief:"Guide an agent through obstacles and costly terrain while the target can move.", start:"Agent", goal:"Target", wall:"Obstacle", weight:"Hazard", expanded:"Tiles inspected", frontier:"Moves considered", length:"Movement steps", compute:"Thinking time", disruption:"The target changed position.", disruptionType:"goal", defaultObjective:"distance"}
};

const SCENARIOS = {
  custom: {preferred:null, objective:"Compare several measures; no strategy is selected in advance."},
  dfsBranch: {preferred:"dfs", objective:"Find any valid route quickly by following the fortunate first branch."},
  bfsLabyrinth: {preferred:"bfs", objective:"Guarantee the shortest number of steps on a uniform-cost maze with a simple queue."},
  greedySprint: {preferred:"greedy", objective:"Reach a visible nearby goal with as few expansions as possible; optimality is not required."},
  dijkstraWeights: {preferred:"dijkstra", objective:"Guarantee the cheapest route across uneven terrain without relying on a directional heuristic."},
  astarCompass: {preferred:"astar", objective:"Find an optimal route while using a reliable heuristic to reduce unnecessary exploration."},
  twoFronts: {preferred:"bidirectional", objective:"Use two search fronts to reduce the depth needed across a large unweighted board."},
  falseHorizon: {preferred:"bfs", objective:"Guarantee the shortest escape when a goal-facing barrier makes directional guesses unreliable."},
  mudRiver: {preferred:"dijkstra", objective:"Find the lowest-cost crossing when the visually direct route contains expensive terrain."},
  twinGates: {preferred:"bidirectional", objective:"Search a long symmetric route efficiently from both endpoints."},
  spiralVault: {preferred:"bfs", objective:"Find the shortest sequence of steps through nested unweighted chambers."},
  switchback: {preferred:"astar", objective:"Preserve optimality while using direction to navigate a long sequence of alternating openings."}
};

const state = {
  grid: [], start: {r: 2, c: 1}, goal: {r: 6, c: 12}, tool: "wall",
  drawing: false, events: [], result: null, step: 0, timer: null, running: false,
  mode: "explore", prediction: null, hovered: null, activeScenario: "astarCompass",
  worldMode: "abstract", objective: "distance", disruptionCount: 0
};

const el = id => document.getElementById(id);
const canvas = el("board");
const ctx = canvas.getContext("2d");

function makeGrid(rows,cols) { return Array.from({length: rows}, () => Array.from({length: cols}, () => ({type:"empty"}))); }
function newGrid() { return makeGrid(ROWS,COLS); }
function key(p) { return `${p.r},${p.c}`; }
function parseKey(k) { const [r,c] = k.split(",").map(Number); return {r,c}; }
function heuristic(a,b) { return Math.abs(a.r-b.r)+Math.abs(a.c-b.c); }
function inBounds(r,c) { return r>=0 && r<ROWS && c>=0 && c<COLS; }
function objective(){return OBJECTIVES[state.objective]||OBJECTIVES.distance;}
function world(){return WORLD_MODES[state.worldMode]||WORLD_MODES.abstract;}
function cellCost(p) { return state.grid[p.r][p.c].type === "weight" ? objective().terrainCost : 1; }
function traversable(p) { return inBounds(p.r,p.c) && state.grid[p.r][p.c].type !== "wall"; }
function neighbors(p) { return [{r:p.r-1,c:p.c},{r:p.r,c:p.c+1},{r:p.r+1,c:p.c},{r:p.r,c:p.c-1}].filter(traversable); }
function seededRandom(seed) { let x = Math.sin(Number(seed)||1)*10000; return () => { x = Math.sin(x)*10000; return x-Math.floor(x); }; }
function normalizedSeed(){const input=el("seedInput");const value=Math.min(100,Math.max(1,Math.round(Number(input.value)||1)));input.value=String(value);return value;}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
  ctx.setTransform(ratio,0,0,ratio,0,0); draw();
}

function palette() {
  const light = document.body.classList.contains("light");
  return light ? {bg:"#dfe6ed", line:"#c4cfda", wall:"#24354b", empty:"#dfe6ed", visited:"#a9cbe0", frontier:"#39b9de", path:"#79ad1f", weight:"#8c6ee8", start:"#6da916", goal:"#e65236", text:"#101722"}
    : {bg:"#080e18", line:"#172337", wall:"#40506a", empty:"#080e18", visited:"#17344b", frontier:"#37d4ff", path:"#b7f23c", weight:"#8e72ed", start:"#b7f23c", goal:"#ff6b4a", text:"#f4f7fb"};
}

function draw() {
  const p = palette(); const w = canvas.clientWidth; const h = canvas.clientHeight;
  const cw = w/COLS, ch = h/ROWS; ctx.clearRect(0,0,w,h); ctx.fillStyle=p.bg; ctx.fillRect(0,0,w,h);
  const shown = new Map();
  for (let i=0;i<Math.min(state.step,state.events.length);i++) shown.set(key(state.events[i]), state.events[i].kind);
  if (state.result && state.step >= state.events.length) state.result.path.forEach(pos=>shown.set(key(pos),"path"));
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const x=c*cw, y=r*ch, cell=state.grid[r][c], show=shown.get(`${r},${c}`);
    ctx.fillStyle = cell.type==="wall"?p.wall:cell.type==="weight"?p.weight:p.empty;
    if (show==="visited") ctx.fillStyle=p.visited;
    if (show==="frontier") ctx.fillStyle=p.frontier;
    if (show==="path") ctx.fillStyle=p.path;
    ctx.fillRect(x+.7,y+.7,cw-1.4,ch-1.4);
    if (cell.type==="weight" && !show) {
      ctx.fillStyle="rgba(255,255,255,.55)"; ctx.font=`${Math.max(7,Math.min(cw,ch)*.38)}px DM Mono`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(String(objective().terrainCost),x+cw/2,y+ch/2);
    }
  }
  ctx.strokeStyle=p.line; ctx.lineWidth=.7; ctx.beginPath();
  for(let c=0;c<=COLS;c++){ctx.moveTo(c*cw,0);ctx.lineTo(c*cw,h);} for(let r=0;r<=ROWS;r++){ctx.moveTo(0,r*ch);ctx.lineTo(w,r*ch);} ctx.stroke();
  drawMarker(state.start,p.start,"S",cw,ch); drawMarker(state.goal,p.goal,"G",cw,ch);
  if(state.hovered){ctx.strokeStyle=p.text;ctx.lineWidth=1.5;ctx.strokeRect(state.hovered.c*cw+1.5,state.hovered.r*ch+1.5,cw-3,ch-3);}
}

function drawMarker(pos,color,label,cw,ch){ const x=pos.c*cw+cw/2,y=pos.r*ch+ch/2,rad=Math.max(5,Math.min(cw,ch)*.33); ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();ctx.fillStyle="#08100c";ctx.font=`800 ${Math.max(8,rad*.9)}px Manrope`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(label,x,y+.3); }

function positionFromEvent(e){ const rect=canvas.getBoundingClientRect(); return {r:Math.min(ROWS-1,Math.max(0,Math.floor((e.clientY-rect.top)/(rect.height/ROWS)))),c:Math.min(COLS-1,Math.max(0,Math.floor((e.clientX-rect.left)/(rect.width/COLS))))}; }
function paint(pos){ if(key(pos)===key(state.start)||key(pos)===key(state.goal)) return; resetRun(false);state.activeScenario="custom";el("challengeSelect").value="custom";el("raceQuestion").textContent="Which strategy best fits the board you created?"; if(state.tool==="wall") state.grid[pos.r][pos.c].type="wall"; if(state.tool==="weight") state.grid[pos.r][pos.c].type="weight"; if(state.tool==="erase") state.grid[pos.r][pos.c].type="empty"; if(state.tool==="start") state.start={...pos}; if(state.tool==="goal") state.goal={...pos}; updateGoalLabel(); draw(); }

function reconstruct(parent,end){ const path=[]; let cur=key(end); while(cur){path.push(parseKey(cur));cur=parent.get(cur);} return path.reverse(); }

function runAlgorithmLocal(type){
  const startTime=performance.now(), start={...state.start}, goal={...state.goal};
  if(type==="bidirectional") return runBidirectional(startTime);
  const frontier=[{...start,g:0,h:heuristic(start,goal),parent:null}];
  const parent=new Map([[key(start),null]]), best=new Map([[key(start),0]]), visited=new Set(), discovered=new Set([key(start)]), events=[];
  let maxFrontier=1, end=null;
  while(frontier.length){
    let idx=0;
    if(type==="dfs") idx=frontier.length-1;
    if(type==="dijkstra") idx=frontier.reduce((b,n,i)=>n.g<frontier[b].g?i:b,0);
    if(type==="astar") idx=frontier.reduce((b,n,i)=>(n.g+n.h)<(frontier[b].g+frontier[b].h)?i:b,0);
    if(type==="greedy") idx=frontier.reduce((b,n,i)=>n.h<frontier[b].h?i:b,0);
    const node=frontier.splice(idx,1)[0], nk=key(node);
    if(visited.has(nk)) continue; visited.add(nk);
    events.push({...node,kind:"visited",reason:`Expanded because it was next in the ${type==="dfs"?"stack":type==="bfs"?"queue":"priority order"}.`});
    if(nk===key(goal)){ end=node; break; }
    for(const next of neighbors(node)){
      const nextKey=key(next), stepCost=(type==="dijkstra"||type==="astar")?cellCost(next):1, ng=node.g+stepCost;
      if(visited.has(nextKey)) continue;
      const shouldAdd=!discovered.has(nextKey) || ng<(best.get(nextKey)??Infinity);
      if(shouldAdd){
        discovered.add(nextKey);best.set(nextKey,ng);parent.set(nextKey,nk);
        const item={...next,g:ng,h:heuristic(next,goal),parent:nk};frontier.push(item);
        events.push({...item,kind:"frontier",reason:cellCost(next)>1&&stepCost>1?`Added with terrain cost ${stepCost}.`:`Discovered from row ${node.r+1}, column ${node.c+1}.`});
      }
    }
    maxFrontier=Math.max(maxFrontier,frontier.length);
  }
  const runtime=performance.now()-startTime, path=end?reconstruct(parent,end):[];
  return {events,path,found:!!end,expanded:visited.size,maxFrontier,pathLength:path.length?path.length-1:null,pathCost:path.length?path.slice(1).reduce((s,p)=>s+cellCost(p),0):null,runtime};
}

async function requestAlgorithm(type){
  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        algorithm: type,
        grid: state.grid.map(row => row.map(cell => cell.type)),
        start: state.start,
        goal: state.goal,
        terrainCost: objective().terrainCost
      })
    });
    if (!response.ok) throw new Error("Search service unavailable");
    return await response.json();
  } catch (error) {
    // The deployed static showcase remains playable; local Flask development
    // uses the Python implementation above as the authoritative engine.
    return runAlgorithmLocal(type);
  }
}

function runBidirectional(startTime){
  const a=[state.start],b=[state.goal],pa=new Map([[key(state.start),null]]),pb=new Map([[key(state.goal),null]]),va=new Set([key(state.start)]),vb=new Set([key(state.goal)]),events=[];let meet=null,maxFrontier=2;
  const expand=(queue,own,other,parent,fromStart)=>{ const current=queue.shift();events.push({...current,g:fromStart?distanceInMap(parent,current):0,h:heuristic(current,state.goal),kind:"visited",reason:`Expanded from the ${fromStart?"start":"goal"} side.`}); if(other.has(key(current))) return current; for(const n of neighbors(current)){const k=key(n);if(!own.has(k)){own.add(k);parent.set(k,key(current));queue.push(n);events.push({...n,g:0,h:heuristic(n,state.goal),kind:"frontier",reason:`Added to the ${fromStart?"forward":"reverse"} frontier.`});if(other.has(k)) return n;}} return null; };
  while(a.length&&b.length&&!meet){meet=expand(a,va,vb,pa,true);if(!meet)meet=expand(b,vb,va,pb,false);maxFrontier=Math.max(maxFrontier,a.length+b.length);}
  let path=[]; if(meet){const left=reconstruct(pa,meet);const right=[];let cur=pb.get(key(meet));while(cur){right.push(parseKey(cur));cur=pb.get(cur);}path=left.concat(right);}
  return {events,path,found:!!meet,expanded:new Set(events.filter(e=>e.kind==="visited").map(key)).size,maxFrontier,pathLength:path.length?path.length-1:null,pathCost:path.length?path.slice(1).reduce((sum,pos)=>sum+cellCost(pos),0):null,runtime:performance.now()-startTime};
}
function distanceInMap(map,pos){let d=0,cur=key(pos);while(map.get(cur)){d++;cur=map.get(cur);}return d;}

async function prepareRun(){
  stopTimer(); const type=el("algorithmSelect").value; el("statusText").textContent="CALCULATING TRACE"; state.result=await requestAlgorithm(type); state.events=state.result.events; state.step=0; updateMetrics(false); el("stepTotal").textContent=String(state.events.length).padStart(3,"0"); el("statusText").textContent="TRACE PRIMED"; draw();
}
async function toggleRun(){
  if(!state.events.length || state.step>=state.events.length){await prepareRun();}
  if(state.running){stopTimer();return;} state.running=true; el("playBtn").classList.add("running");el("playBtn").innerHTML="<span>Ⅱ</span> Pause"; el("statusText").textContent="SEARCH IN PROGRESS"; advanceLoop();
}
function advanceLoop(){ if(!state.running)return; if(state.step>=state.events.length){finishRun();return;} advanceStep(); const delays=[240,120,55,24,8];state.timer=setTimeout(advanceLoop,delays[Number(el("speedRange").value)-1]); }
async function advanceStep(){ if(!state.events.length)await prepareRun(); if(state.step<state.events.length){state.step++;const ev=state.events[state.step-1]; updateInspector(ev); el("stepCurrent").textContent=String(state.step).padStart(3,"0");updateMetrics(false);draw();} if(state.step>=state.events.length)finishRun(); }
function stopTimer(){clearTimeout(state.timer);state.timer=null;state.running=false;el("playBtn").classList.remove("running");el("playBtn").innerHTML="<span>▶</span> Visualize";}
function finishRun(){ stopTimer();state.step=state.events.length;draw();updateMetrics(true); const meta=ALGORITHMS[el("algorithmSelect").value];el("statusText").textContent=state.result.found?"PATH CONFIRMED":"NO ROUTE FOUND";el("eventChip").textContent=state.result.found?"GOAL":"EXHAUSTED";el("inspectorTitle").textContent=state.result.found?"Route found":"Search exhausted";el("reasonText").textContent=state.result.found?adaptiveExplanation(el("algorithmSelect").value,state.result):`Every reachable location was examined, but the ${world().goal.toLowerCase()} cannot be reached.`; }
function resetRun(redraw=true){stopTimer();state.events=[];state.result=null;state.step=0;el("stepCurrent").textContent="000";el("stepTotal").textContent="000";el("statusText").textContent="READY TO TRACE";updateMetrics(false);if(redraw)draw();}

function updateInspector(ev){ el("eventChip").textContent=ev.kind.toUpperCase();el("inspectorTitle").textContent=ev.kind==="visited"?"Expanding node":"Frontier updated";el("nodeCoord").textContent=`R${ev.r+1}·C${ev.c+1}`;el("reasonText").textContent=ev.reason;el("gCost").textContent=Math.round(ev.g??0);el("hCost").textContent=Math.round(ev.h??0);el("fCost").textContent=Math.round((ev.g??0)+(ev.h??0)); }
function formatCost(value){return value==null?"—":`${value} ${objective().unit}`;}
function updateMetrics(done){ const seen=state.events.slice(0,state.step);el("expandedMetric").textContent=seen.filter(e=>e.kind==="visited").length;el("frontierMetric").textContent=done?state.result.maxFrontier:Math.max(0,new Set(seen.filter(e=>e.kind==="frontier").map(key)).size-new Set(seen.filter(e=>e.kind==="visited").map(key)).size);el("lengthMetric").textContent=done?(state.result.pathLength??"—"):"—";el("costMetric").textContent=done?formatCost(state.result.pathCost):"—";el("timeMetric").textContent=done?`${state.result.runtime.toFixed(2)} ms`:"—"; }
function adaptiveExplanation(type,result){ const destination=world().goal.toLowerCase();if(type==="astar")return `A* reached the ${destination} after checking ${result.expanded} locations. Its heuristic stayed goal-directed while g(n) protected route quality.`;if(type==="dijkstra")return `Dijkstra guaranteed the lowest-${objective().label.toLowerCase()} route by expanding locations in accumulated-cost order.`;if(type==="bfs")return `BFS found the fewest-step route after ${result.expanded} expansions. Weighted conditions were intentionally ignored.`;if(type==="dfs")return `DFS found a route of ${result.pathLength} steps, but it cannot promise that another route is shorter or cheaper.`;if(type==="greedy")return `Greedy search reached the ${destination} using only its distance estimate. The result is quick, not guaranteed cheapest.`;return `The two searches met after ${result.expanded} unique locations were checked, reducing the depth each side covered.`; }

function renderMetricImplications(results=null){
  const profile=world(), target=objective();
  let notes=[
    [profile.expanded, "Planning work", "How many locations the system inspected before deciding."],
    [profile.frontier, "Peak memory", "How many possible routes had to be kept available at once."],
    [profile.length, "Physical movement", `How many ${profile.length.toLowerCase()} the final route requires.`],
    [target.label, "Real-world outcome", target.meaning]
  ];
  if(results){
    const found=results.filter(r=>r.found);
    const fewest=found.reduce((a,b)=>b.expanded<a.expanded?b:a);
    const smallest=found.reduce((a,b)=>b.maxFrontier<a.maxFrontier?b:a);
    const shortest=found.reduce((a,b)=>b.pathLength<a.pathLength?b:a);
    const cheapest=found.reduce((a,b)=>b.pathCost<a.pathCost?b:a);
    notes=[
      [profile.expanded, ALGORITHMS[fewest.type].name, `${fewest.expanded} locations checked means less search work.`],
      [profile.frontier, ALGORITHMS[smallest.type].name, `${smallest.maxFrontier} waiting options means the lowest peak memory.`],
      [profile.length, ALGORITHMS[shortest.type].name, `${shortest.pathLength} steps is the shortest physical route found.`],
      [target.label, ALGORITHMS[cheapest.type].name, `${formatCost(cheapest.pathCost)} is the best ${target.label.toLowerCase()} result.`]
    ];
  }
  el("metricImplications").innerHTML=notes.map(([label,title,copy])=>`<div class="metric-meaning"><strong>${label} · ${title}</strong><span>${copy}</span></div>`).join("");
}

function updateWorldCopy(){
  const profile=world(), target=objective();
  document.querySelector(".mission-card h1").textContent=profile.title;
  el("worldBrief").textContent=profile.brief;
  el("wallToolLabel").textContent=profile.wall;el("weightToolLabel").textContent=profile.weight;el("startToolLabel").textContent=profile.start;el("goalToolLabel").textContent=profile.goal;
  el("expandedMetricLabel").textContent=profile.expanded;el("frontierMetricLabel").textContent=profile.frontier;el("lengthMetricLabel").textContent=profile.length;el("costMetricLabel").textContent=target.label;el("timeMetricLabel").textContent=profile.compute;
  el("disruptionLabel").textContent="Change conditions";
  updateToolHint();renderMetricImplications();draw();
}

function updateWorldMode(){state.worldMode=el("worldSelect").value;state.objective=world().defaultObjective;el("objectiveSelect").value=state.objective;el("eventBanner").textContent="Conditions are stable.";el("eventBanner").classList.remove("active");resetRun(false);updateWorldCopy();}
function updateObjective(){state.objective=el("objectiveSelect").value;resetRun(false);updateWorldCopy();}
function updateToolHint(){const profile=world();el("boardHint").textContent=state.tool==="wall"?`Draw: ${profile.wall}`:state.tool==="weight"?`${profile.weight} costs ${objective().terrainCost} ${objective().unit}`:`Place: ${state.tool==="start"?profile.start:state.tool==="goal"?profile.goal:"Erase"}`;}

function triggerDisruption(){
  const previousPath=state.result?.path?.slice(1,-1)||[], profile=world(), snapshot=state.grid.map(row=>row.map(cell=>({...cell}))), previousGoal={...state.goal};
  resetRun(false);state.disruptionCount++;state.activeScenario="custom";el("challengeSelect").value="custom";el("raceQuestion").textContent="Which strategy best responds to the changed conditions?";
  if(profile.disruptionType==="goal"){
    const choices=[];for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++){const p={r,c};if(traversable(p)&&key(p)!==key(state.start)&&heuristic(p,state.start)>16)choices.push(p);}
    if(choices.length)state.goal={...choices[(state.disruptionCount*17)%choices.length]};
  }else{
    let candidates=previousPath.filter(p=>key(p)!==key(state.start)&&key(p)!==key(state.goal));
    if(!candidates.length){for(let r=2;r<ROWS-2;r++)for(let c=2;c<COLS-2;c++){const p={r,c};if(traversable(p)&&key(p)!==key(state.start)&&key(p)!==key(state.goal))candidates.push(p);}}
    const chosen=candidates[(state.disruptionCount*23)%Math.max(1,candidates.length)];
    if(chosen&&profile.disruptionType==="wall")state.grid[chosen.r][chosen.c].type="wall";
    if(chosen&&profile.disruptionType==="weight")for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const p={r:chosen.r+dr,c:chosen.c+dc};if(traversable(p)&&key(p)!==key(state.start)&&key(p)!==key(state.goal))state.grid[p.r][p.c].type="weight";}
    if(!runAlgorithmLocal("bfs").found){state.grid=snapshot;if(chosen)state.grid[chosen.r][chosen.c].type="weight";}
  }
  updateGoalLabel();el("eventBanner").textContent=`${profile.disruption} Run the search again to see how the route changes.`;el("eventBanner").classList.add("active");draw();
}

function updateAlgorithmCopy(){ const meta=ALGORITHMS[el("algorithmSelect").value];resetRun();el("selectedStrategyName").textContent=meta.name;el("algorithmBrief").innerHTML=`<strong>${meta.weighted?"WEIGHT-AWARE":"UNWEIGHTED"} · ${meta.optimal}</strong><p>${meta.brief}</p>`;el("verdictTitle").textContent=`Why choose ${meta.name}?`;el("verdictText").textContent=meta.verdict;el("bestWhen").textContent=meta.best;el("watchOut").textContent=meta.watch;el("statusText").textContent=`STRATEGY · ${meta.name.toUpperCase()}`; }
function updateGoalLabel(){el("goalCoord").textContent=`R${state.goal.r+1}·C${state.goal.c+1}`;}

function generateMaze(){
  resetRun(false);state.grid=newGrid();state.activeScenario="custom";el("challengeSelect").value="custom";const rand=seededRandom(normalizedSeed());
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){if(key({r,c})===key(state.start)||key({r,c})===key(state.goal))continue;const roll=rand();if(roll<.23)state.grid[r][c].type="wall";else if(roll<.31)state.grid[r][c].type="weight";}
  carveGuaranteedPath();draw();
}
function carveGuaranteedPath(){let r=state.start.r,c=state.start.c;while(c!==state.goal.c){state.grid[r][c].type="empty";c+=c<state.goal.c?1:-1;}while(r!==state.goal.r){state.grid[r][c].type="empty";r+=r<state.goal.r?1:-1;}state.grid[r][c].type="empty";}
function clearBoard(){state.grid=newGrid();state.activeScenario="custom";el("challengeSelect").value="custom";el("raceQuestion").textContent="Which strategy best fits the board you created?";resetRun();}
function loadChallenge(name){
  state.grid=newGrid();state.start={r:1,c:1};state.goal={r:6,c:12};state.activeScenario=name;
  const fill=(type,positions)=>positions.forEach(([r,c])=>{if(inBounds(r,c))state.grid[r][c].type=type;});
  const horizontal=(row,from,to,gaps=[])=>{for(let c=from;c<=to;c++)if(!gaps.includes(c))fill("wall",[[row,c]]);};
  const vertical=(col,from,to,gaps=[])=>{for(let r=from;r<=to;r++)if(!gaps.includes(r))fill("wall",[[r,col]]);};
  const weightedBox=(top,left,bottom,right)=>{for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++)fill("weight",[[r,c]]);};

  if(name==="dfsBranch"){
    state.start={r:6,c:1};state.goal={r:1,c:1};
    vertical(3,1,7,[1]);vertical(6,0,6,[6]);vertical(9,1,7,[2]);
    horizontal(4,3,9,[6]);
  }
  if(name==="bfsLabyrinth"){
    state.start={r:3,c:1};state.goal={r:3,c:12};
    vertical(3,0,6,[1]);vertical(6,1,7,[6]);vertical(9,0,6,[2]);vertical(11,1,7,[5]);
  }
  if(name==="greedySprint"){
    state.start={r:3,c:1};state.goal={r:3,c:12};
    horizontal(1,5,9);horizontal(5,4,8);fill("wall",[[2,9],[4,4]]);
  }
  if(name==="dijkstraWeights"){
    state.start={r:3,c:1};state.goal={r:3,c:12};
    weightedBox(2,4,4,9);horizontal(0,4,9,[6]);horizontal(6,4,9,[8]);
  }
  if(name==="astarCompass"){
    state.start={r:1,c:1};state.goal={r:6,c:12};
    vertical(3,0,5,[5]);vertical(6,2,7,[1]);vertical(9,0,5,[5]);
    horizontal(3,9,12,[11]);
  }
  if(name==="twoFronts"){
    state.start={r:4,c:1};state.goal={r:4,c:12};
    vertical(5,1,6,[3,5]);vertical(9,1,6,[3,5]);horizontal(1,5,9,[7]);horizontal(6,5,9,[7]);
  }
  if(name==="falseHorizon"){
    state.start={r:4,c:1};state.goal={r:4,c:12};
    vertical(10,1,6,[1]);horizontal(6,4,10,[4]);vertical(6,2,5,[5]);
  }
  if(name==="mudRiver"){
    state.start={r:3,c:1};state.goal={r:3,c:12};
    weightedBox(0,5,7,8);fill("empty",[[1,5],[1,6],[1,7],[1,8],[6,5],[6,6],[6,7],[6,8]]);
    vertical(4,2,5,[3]);vertical(9,2,5,[4]);
  }
  if(name==="twinGates"){
    state.start={r:3,c:1};state.goal={r:3,c:12};
    vertical(4,0,7,[2,5]);vertical(9,0,7,[2,5]);horizontal(4,4,9,[6]);
  }
  if(name==="spiralVault"){
    state.start={r:0,c:0};state.goal={r:2,c:5};
    horizontal(1,1,12);horizontal(6,1,12,[2]);horizontal(3,2,10,[10]);
    vertical(12,1,5);vertical(2,3,6,[5]);vertical(10,3,5,[5]);
  }
  if(name==="switchback"){
    state.start={r:1,c:1};state.goal={r:6,c:12};
    horizontal(2,1,12,[12]);horizontal(4,1,12,[1]);horizontal(6,1,11);
  }

  state.grid[state.start.r][state.start.c].type="empty";state.grid[state.goal.r][state.goal.c].type="empty";
  const scenario=SCENARIOS[name]||SCENARIOS.custom;
  if(scenario.preferred){el("algorithmSelect").value=scenario.preferred;updateAlgorithmCopy();}
  el("raceQuestion").textContent=scenario.preferred?`Which strategy best satisfies this mission: ${scenario.objective}`:"Which strategy best fits the board you created?";
  updateGoalLabel();resetRun();
}

function setMode(mode){state.mode=mode;const race=mode==="race";el("racePanel").hidden=!race;el("exploreMode").classList.toggle("active",!race);el("raceMode").classList.toggle("active",race);el("exploreMode").setAttribute("aria-selected",String(!race));el("raceMode").setAttribute("aria-selected",String(race));if(race)buildPredictions();}
function buildPredictions(){const choices=["dfs","bfs","greedy","dijkstra","astar","bidirectional"];el("predictionRow").innerHTML=choices.map(k=>`<button class="prediction-btn${state.prediction===k?" selected":""}" data-predict="${k}">${ALGORITHMS[k].name}</button>`).join("");document.querySelectorAll("[data-predict]").forEach(b=>b.onclick=()=>{state.prediction=b.dataset.predict;buildPredictions();});}
function guaranteesOptimal(type){if(type==="dijkstra"||type==="astar")return true;if(type==="bfs"||type==="bidirectional")return !hasWeights();return false;}
async function runRace(){
  stopTimer();el("runRaceBtn").disabled=true;el("runRaceBtn").textContent="Running…";const picks=["dfs","bfs","greedy","dijkstra","astar","bidirectional"],raw=await Promise.all(picks.map(requestAlgorithm)),results=raw.map((result,index)=>({type:picks[index],...result})),expansionLeader=results.filter(r=>r.found).reduce((a,b)=>b.expanded<a.expanded?b:a),bestCost=Math.min(...results.filter(r=>r.found).map(r=>r.pathCost)),scenario=SCENARIOS[state.activeScenario]||SCENARIOS.custom,profile=world(),target=objective();el("raceResults").innerHTML=results.map(r=>`<article class="race-result ${r.type===expansionLeader.type?"winner":""}"><h3>${ALGORITHMS[r.type].name}${r.type===expansionLeader.type?" · LEAST SEARCH WORK":""}</h3><dl><dt>${profile.expanded}</dt><dd>${r.expanded}${r.type===expansionLeader.type?" · fewest":""}</dd><dt>${profile.frontier}</dt><dd>${r.maxFrontier}</dd><dt>${profile.length}</dt><dd>${r.pathLength??"—"}</dd><dt>${target.label}</dt><dd>${formatCost(r.pathCost)}${r.pathCost===bestCost?" · best":""}</dd><dt>${profile.compute}</dt><dd>${r.runtime.toFixed(2)} ms</dd><dt>Optimal guarantee?</dt><dd>${guaranteesOptimal(r.type)?"Yes":"No"}</dd></dl></article>`).join("")+`<p class="race-verdict">${state.prediction?(state.prediction===expansionLeader.type?"Prediction confirmed. ":"Prediction challenged. "):""}${ALGORITHMS[expansionLeader.type].name} required the least search work; the best ${target.label.toLowerCase()} was ${formatCost(bestCost)}. ${scenario.objective} Less search work, lower memory, shorter movement, and a better real-world outcome are different advantages.</p>`;renderMetricImplications(results);el("runRaceBtn").disabled=false;el("runRaceBtn").textContent="Run comparison";
}
function hasWeights(){return state.grid.some(row=>row.some(cell=>cell.type==="weight"));}

canvas.addEventListener("pointerdown",e=>{state.drawing=true;canvas.setPointerCapture(e.pointerId);paint(positionFromEvent(e));});
canvas.addEventListener("pointermove",e=>{const p=positionFromEvent(e);state.hovered=p;el("coordinateBadge").textContent=`CELL R${p.r+1} · C${p.c+1}`;if(state.drawing&&(state.tool==="wall"||state.tool==="weight"||state.tool==="erase"))paint(p);draw();});
canvas.addEventListener("pointerup",()=>state.drawing=false);canvas.addEventListener("pointerleave",()=>{state.drawing=false;state.hovered=null;draw();});
document.querySelectorAll(".tool-btn").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tool-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");state.tool=btn.dataset.tool;updateToolHint();}));
el("algorithmSelect").addEventListener("change",updateAlgorithmCopy);el("playBtn").addEventListener("click",toggleRun);el("stepBtn").addEventListener("click",()=>{stopTimer();advanceStep();});el("stepBackBtn").addEventListener("click",()=>resetRun());el("mazeBtn").addEventListener("click",generateMaze);el("clearBtn").addEventListener("click",clearBoard);el("challengeSelect").addEventListener("change",e=>loadChallenge(e.target.value));el("exploreMode").addEventListener("click",()=>setMode("explore"));el("raceMode").addEventListener("click",()=>setMode("race"));el("runRaceBtn").addEventListener("click",runRace);
el("worldSelect").addEventListener("change",updateWorldMode);el("objectiveSelect").addEventListener("change",updateObjective);el("disruptionBtn").addEventListener("click",triggerDisruption);
el("seedInput").addEventListener("input",normalizedSeed);
el("themeBtn").addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("tracebound-theme",document.body.classList.contains("light")?"light":"dark");draw();});
el("howBtn").addEventListener("click",()=>el("howDialog").showModal());el("closeDialog").addEventListener("click",()=>el("howDialog").close());
window.addEventListener("resize",resizeCanvas);

state.grid=newGrid();if(localStorage.getItem("tracebound-theme")==="light")document.body.classList.add("light");loadChallenge("astarCompass");el("challengeSelect").value="astarCompass";updateAlgorithmCopy();buildPredictions();updateWorldCopy();requestAnimationFrame(resizeCanvas);
