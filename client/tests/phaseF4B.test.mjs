import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameEngine } from '../js/core/gameEngine.js';
import { GameState } from '../js/models/gameState.js';
import { Player } from '../js/models/player.js';
import { Card } from '../js/models/card.js';
import { CardMaster } from '../js/models/cardMaster.js';
import { CardMasterRegistry } from '../js/models/cardMasterRegistry.js';
import { PHASE } from '../js/constants/phase.js';
import { PROCESS_TYPE } from '../js/constants/process.js';
import { ZONE, ZONE_VISIBILITY, VISIBILITY } from '../js/constants/zone.js';
import { createCardMasterRegistry, validateCardMasterDefinitions } from '../js/data/cardMasterLoader.js';

const brainstorm = { id:'brainstorm', type:'ACT', keywords:['BRAINSTORM'], text:'集中', activationTrigger:null, conditions:[], costs:[{type:'PAY_STOCK',amount:1},{type:'REST_SELF'}], effects:[
 {id:'brainstormReveal',type:'BRAINSTORM_REVEAL',count:4},
 {id:'searchByBrainstorm',type:'EFFECT_GROUP',condition:{source:'EFFECT_RESULT',effectId:'brainstormReveal',field:'climaxCount',min:1},effects:[
  {id:'searchDeck',type:'SEARCH_DECK',minSelect:0,maxSelect:{source:'EFFECT_RESULT',effectId:'brainstormReveal',field:'climaxCount'},filter:{cardType:'CHARACTER',traits:{anyOf:['Anniversary','能力者']}}},
  {id:'addToHand',type:'ADD_TO_HAND',cards:{source:'EFFECT_RESULT',effectId:'searchDeck',field:'selectedCardInstanceIds'}},
  {id:'shuffleDeck',type:'SHUFFLE_DECK'}]}]};
const def=(id,type='CHARACTER',traits=[])=>({id,cardNumber:null,name:id,cardType:type,color:'YELLOW',imageUrl:null,level:0,cost:0,basePower:type==='CHARACTER'?1000:null,baseSoul:type==='CHARACTER'?1:null,triggerIcons:[],traits,abilities:id==='source'?[brainstorm]:[]});
let fixtureNumber=0;
function fixture(topTypes=['dummy','dummy','dummy','dummy','eligible']) {
 const registry=new CardMasterRegistry(); [def('source'),def('dummy'),def('eligible','CHARACTER',['Anniversary']),def('ability','CHARACTER',['能力者']),def('student','CHARACTER',['生徒会']),def('cx','CLIMAX')].forEach(x=>registry.register(new CardMaster(x)));
 const prefix=`f${++fixtureNumber}`; let n=0; const make=(id,zone=ZONE.DECK)=>new Card({instanceId:`${prefix}-c${++n}`,masterId:id,masterRegistry:registry,owner:'self',zone});
 const self=new Player({id:'self',name:'self'}), opponent=new Player({id:'opponent',name:'opponent'});
 const source=make('source',ZONE.STAGE); source.moveTo({zone:ZONE.STAGE,row:'back',index:1}); self.stage.push(source);
 self.stock.push(make('dummy',ZONE.STOCK)); topTypes.forEach(id=>self.deck.cards.push(make(id)));
 opponent.deck.cards.push(new Card({instanceId:'opp',masterId:'dummy',masterRegistry:registry,owner:'opponent',zone:ZONE.DECK}));
 const state=new GameState({self,opponent,phase:PHASE.MAIN,turnPlayer:'self',started:true});
 const engine=new GameEngine({gameState:state,renderer:{render(){}}}); engine.startMainPhase();
 return {engine,state,self,source,ability:source.abilities[0]};
}

test('西森柚咲masterとBRAINSTORM schemaをロードしResolutionは公開である', async()=>{
 const defs=JSON.parse(await readFile(new URL('../data/card-masters.json',import.meta.url)));
 const registry=createCardMasterRegistry(defs); const master=registry.get('kch-w78-001s');
 assert.equal(master.cardNumber,'Kch/W78-001S'); assert.deepEqual(master.abilities[0].keywords,['BRAINSTORM']); assert.equal(master.abilities.length,1);
 assert.equal(ZONE_VISIBILITY[ZONE.RESOLUTION],VISIBILITY.PUBLIC);
});

test('LoaderはEffect id重複・未知type・未対応condition/filterを拒否する',()=>{
 const base=def('bad');
 const validate=(effects)=>validateCardMasterDefinitions([{...base,abilities:[{...brainstorm,effects}]}]);
 assert.throws(()=>validate([{id:'x',type:'SHUFFLE_DECK'},{id:'x',type:'SHUFFLE_DECK'}]),/Duplicate Effect id/);
 assert.throws(()=>validate([{id:'x',type:'NOPE'}]),/Unsupported Ability Effect/);
 assert.throws(()=>validate([{id:'g',type:'EFFECT_GROUP',condition:{source:'EFFECT_RESULT',effectId:'x',field:'y',min:1,or:[]},effects:[{id:'s',type:'SHUFFLE_DECK'}]}]),/unsupported field/);
 assert.throws(()=>validate([{id:'s',type:'SEARCH_DECK',minSelect:0,maxSelect:1,filter:{cardType:'CHARACTER',traits:{allOf:['x']}}}]),/unsupported field/);
});

test('CX=0は4枚をResolution経由で控え室へ置きGroupをskipする',()=>{
 const {engine,self,source,ability}=fixture(); const revealed=self.deck.cards.slice(0,4);
 const process=engine.useActAbility(source,ability,'self');
 assert.equal(process.context.effectResults.brainstormReveal.climaxCount,0);
 assert.equal(self.resolution.length,0); assert.ok(revealed.every(card=>self.waitingRoom.includes(card)));
 assert.equal(engine.processManager.getCurrentProcess().type,PROCESS_TYPE.MAIN_PHASE);
});

test('CX=1でSEARCH_DECKを子Processにしeligibleだけ選択して同一instanceを手札へ移す',()=>{
 const {engine,self,source,ability,state}=fixture(['cx','dummy','dummy','dummy','eligible','student']);
 const process=engine.useActAbility(source,ability,'self'); const search=engine.getSearchDeckState();
 assert.equal(state.ruleState.processStack.at(-2),process); assert.equal(state.ruleState.processStack.at(-1).type,PROCESS_TYPE.SEARCH_DECK);
 assert.equal(search.maxSelect,1); assert.deepEqual(search.cards,self.deck.cards);
 const eligible=search.cards.find(c=>c.masterId==='eligible'), ineligible=search.cards.find(c=>c.masterId==='student');
 assert.ok(search.eligibleCardInstanceIds.includes(eligible.instanceId)); assert.ok(!search.eligibleCardInstanceIds.includes(ineligible.instanceId));
 assert.throws(()=>engine.toggleSearchDeckSelection(ineligible.instanceId),/not eligible/);
 engine.toggleSearchDeckSelection(eligible.instanceId); assert.throws(()=>engine.toggleSearchDeckSelection(ineligible.instanceId),/not eligible/);
 engine.confirmSearchDeckSelection();
 assert.ok(self.hand.includes(eligible)); assert.equal(eligible.zone,ZONE.HAND); assert.equal(process.context.effectResults.searchDeck.selectedCardInstanceIds[0],eligible.instanceId);
 assert.equal(engine.processManager.getCurrentProcess().type,PROCESS_TYPE.MAIN_PHASE);
});

test('CX=2は0～2枚を一括選択でき、超過を拒否してshuffle Effectを1回解決する',()=>{
 const {engine,self,source,ability}=fixture(['cx','cx','dummy','dummy','eligible','ability','eligible']);
 const process=engine.useActAbility(source,ability,'self'); const state=engine.getSearchDeckState(); assert.equal(state.maxSelect,2);
 const choices=state.cards.filter(c=>state.eligibleCardInstanceIds.includes(c.instanceId));
 engine.toggleSearchDeckSelection(choices[0].instanceId); engine.toggleSearchDeckSelection(choices[1].instanceId);
 assert.throws(()=>engine.toggleSearchDeckSelection(choices[2].instanceId),/maxSelect/);
 engine.confirmSearchDeckSelection(); assert.equal(self.hand.length,2); assert.deepEqual(process.context.effectResults.shuffleDeck,{shuffled:true});
});

test('検索は0枚でも確定できる',()=>{ const x=fixture(['cx','dummy','dummy','dummy','eligible']); x.engine.useActAbility(x.source,x.ability,'self'); x.engine.confirmSearchDeckSelection(); assert.equal(x.self.hand.length,0); });

test('Deck残り2枚では既存REFRESHとPenalty後に集中をresumeし、無関係なResolutionを残す',()=>{
 const x=fixture(['cx','dummy']);
 // Refresh後にPenalty 1枚と集中残り2枚を供給できる控え室を用意する。
 // Cardのregistryは公開propertyではないため、追加fixtureから供給Cardを移す。
 const supply=fixture(['dummy','dummy','dummy','dummy','dummy']);
 x.self.waitingRoom.push(...supply.self.deck.cards);
 supply.self.deck.cards.forEach((card,index)=>{ card.owner='self'; card.moveTo({zone:ZONE.WAITING_ROOM,index:index+1}); });
 const unrelated=supply.self.stock[0]; unrelated.moveTo({zone:ZONE.RESOLUTION,index:1}); x.self.resolution.push(unrelated);
 const originalTop=[...x.self.deck.cards];
 const process=x.engine.useActAbility(x.source,x.ability,'self');
 assert.ok(originalTop.every(card=>x.self.waitingRoom.includes(card)));
 assert.deepEqual(x.self.resolution,[unrelated]);
 assert.equal(process.context.effectResults.brainstormReveal.climaxCount,1);
 assert.equal(x.engine.getSearchDeckState().maxSelect,1);
});

test('Resolution UIとDeck Search UIは全山札・順序・共通View・詳細連携を持つ',async()=>{
 const [html,renderer,controller,mulligan]=await Promise.all(['../index.html','../js/core/renderer.js','../js/ui/deckSearchController.js','../js/ui/mulliganController.js'].map(p=>readFile(new URL(p,import.meta.url),'utf8')));
 assert.match(html,/data-resolution-owner="self" hidden/); assert.match(renderer,/cards\.length === 0/);
 assert.match(controller,/state\.cards\.map\(\(card, index\)/); assert.match(controller,/renderCardDetail/); assert.match(controller,/CardSelectionView/); assert.match(mulligan,/CardSelectionView/);
});
