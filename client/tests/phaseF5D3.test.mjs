import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GameEngine } from "../js/core/gameEngine.js";
import { GameState } from "../js/models/gameState.js";
import { Player } from "../js/models/player.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { ZONE } from "../js/constants/zone.js";
import { PROCESS_TYPE } from "../js/constants/process.js";

const auto2={id:"cha-w40-026sp-auto-2",type:"AUTO",text:"search",activationTrigger:{event:"CARD_MOVED",subject:"SELF",fromZone:"hand",toZone:"stage"},activeZones:[],conditions:[],costs:[{type:"PAY_STOCK",amount:1},{type:"MOVE_DECK_TOP_TO_CLOCK",amount:1}],effects:[{id:"search",type:"SEARCH_DECK",minSelect:0,maxSelect:1,filter:{cardType:"CHARACTER",maxLevel:1}},{id:"add",type:"ADD_TO_HAND",cards:{source:"EFFECT_RESULT",effectId:"search",field:"selectedCardInstanceIds"}},{id:"shuffle",type:"SHUFFLE_DECK"}]};
let serial=0;
function fixture(deckDefs=["cost","low","high","event"], {clock=0, waiting=0, stock=1}={}) {
 const registry=new CardMasterRegistry();
 const def=(id,type="CHARACTER",level=0,abilities=[])=>new CardMaster({id,name:id,cardType:type,color:"GREEN",level,cost:0,basePower:type==="CHARACTER"?1000:null,baseSoul:type==="CHARACTER"?1:null,traits:[],abilities});
 [def("ayumi","CHARACTER",0,[auto2]),def("cost"),def("low","CHARACTER",1),def("high","CHARACTER",2),def("event","EVENT",0),def("filler")].forEach(x=>registry.register(x));
 const prefix=`d3-${++serial}`; let n=0; const make=(id,zone)=>new Card({instanceId:`${prefix}-${++n}`,masterId:id,masterRegistry:registry,owner:"self",zone,index:1});
 const self=new Player({id:"self",name:"self"}), opponent=new Player({id:"opponent",name:"opponent"});
 const ayumi=make("ayumi",ZONE.HAND); self.hand.push(ayumi);
 deckDefs.forEach(id=>self.deck.cards.push(make(id,ZONE.DECK)));
 for(let i=0;i<stock;i++) self.stock.push(make("filler",ZONE.STOCK));
 for(let i=0;i<clock;i++) self.clock.push(make("filler",ZONE.CLOCK));
 for(let i=0;i<waiting;i++) self.waitingRoom.push(make("filler",ZONE.WAITING_ROOM));
 opponent.deck.cards.push(new Card({instanceId:`${prefix}-opp`,masterId:"filler",masterRegistry:registry,owner:"opponent",zone:ZONE.DECK}));
 const state=new GameState({self,opponent,turnPlayer:"self",started:true}); const engine=new GameEngine({gameState:state,renderer:{render(){}}});
 engine.placeCardOnStage(ayumi,"self",{owner:"self",zone:ZONE.STAGE,row:"front",index:1}); engine.resolveCheckPoint();
 return {engine,state,self,ayumi,pending:state.ruleState.pendingAutos.find(p=>p.source.abilityId===auto2.id)};
}
function use(x){ x.engine.selectPendingAuto(x.pending.id); }

test("AUTO②はStock→Deck top Clockを一度だけ払い、Lv1以下Characterだけを0～1枚検索する",()=>{
 const x=fixture(); const paid=x.self.stock[0], top=x.self.deck.cards[0]; use(x);
 assert.ok(x.self.waitingRoom.includes(paid)); assert.ok(x.self.clock.includes(top)); assert.equal(x.self.stock.length,0);
 const search=x.engine.getSearchDeckState(); assert.equal(search.minSelect,0); assert.equal(search.maxSelect,1);
 assert.deepEqual(search.eligibleCardInstanceIds,search.cards.filter(c=>c.masterId==="low").map(c=>c.instanceId));
 x.engine.confirmSearchDeckSelection();
 assert.equal(x.self.hand.length,0); assert.equal(x.engine.processManager.getCurrentProcess(),null);
 assert.equal(x.self.clock.filter(c=>c===top).length,1,"resume後にCostを二重実行しない");
});

test("AUTO②は選択カードを公開ログ付きでHandへ加え、Rule Check後にshuffleして完了する",()=>{
 const x=fixture(); use(x); const target=x.engine.getSearchDeckState().cards.find(c=>c.masterId==="low");
 let shuffled=0; const original=x.self.deck.shuffle.bind(x.self.deck); x.self.deck.shuffle=(...args)=>{shuffled++; return original(...args);};
 x.engine.toggleSearchDeckSelection(target.instanceId); x.engine.confirmSearchDeckSelection();
 assert.ok(x.self.hand.includes(target)); assert.equal(shuffled,1); assert.ok(x.state.log.some(e=>e.message.includes("相手に公開")));
 assert.equal(x.state.ruleState.processStack.length,0);
});

test("Deck 1 / Waiting Room 0でも複合Cost完了後までRule Checkせず、StockカードでRefreshして敗北しない",()=>{
 const x=fixture(["cost"],{waiting:0});
 let checks=0; const resolve=x.engine.resolveCheckPoint.bind(x.engine);
 x.engine.resolveCheckPoint=()=>{ checks+=1; return resolve(); };
 use(x);
 assert.equal(checks>0,true,"Cost全体完了後にCheck Pointへ入る");
 assert.equal(x.state.gameResult.finished,false);
 assert.ok(x.state.log.some(e=>e.message.includes("リフレッシュが完了")));
 assert.ok(x.state.log.some(e=>e.message.includes("リフレッシュペナルティが完了")));
 assert.equal(x.engine.processManager.getCurrentProcess().type,PROCESS_TYPE.SEARCH_DECK);
 const auto=x.state.ruleState.processStack.at(-2);
 assert.equal(auto.context.costIndex,2); assert.equal(auto.context.costPaymentInProgress,false);
});

test("Cost後にDeck 0とClock 7が同時成立すると共通順序選択へ入り、AUTOを保存位置から再開する",()=>{
 const x=fixture(["cost"],{clock:6,waiting:0}); use(x);
 assert.deepEqual(x.state.ruleState.pendingInterrupts.map(i=>i.type),[PROCESS_TYPE.REFRESH,PROCESS_TYPE.LEVEL_UP]);
 assert.equal(x.state.ruleState.processStack[0].type,PROCESS_TYPE.AUTO_ABILITY);
 x.engine.selectPendingInterrupt(0);
 assert.equal(x.engine.processManager.getCurrentProcess().type,PROCESS_TYPE.AUTO_ABILITY);
 const levelIndex=x.state.ruleState.pendingInterrupts.findIndex(i=>i.type===PROCESS_TYPE.LEVEL_UP);
 assert.ok(levelIndex>=0); x.engine.selectPendingInterrupt(levelIndex);
 assert.equal(x.engine.processManager.getCurrentProcess().type,PROCESS_TYPE.LEVEL_UP);
 x.engine.submitLevelUpSelection("self",0); assert.equal(x.engine.processManager.getCurrentProcess().type,PROCESS_TYPE.SEARCH_DECK);
 x.engine.confirmSearchDeckSelection(); assert.equal(x.state.ruleState.processStack.length,0);
});

test("検索した最後の1枚でDeck 0になるとRefresh・penalty後にAUTOへ復帰してshuffleする",()=>{
 const x=fixture(["cost","low"],{waiting:3}); use(x); const target=x.engine.getSearchDeckState().cards[0];
 x.engine.toggleSearchDeckSelection(target.instanceId); x.engine.confirmSearchDeckSelection();
 assert.ok(x.self.hand.includes(target)); assert.ok(x.state.log.some(e=>e.message.includes("リフレッシュが完了")));
 assert.ok(x.state.log.some(e=>e.message.includes("リフレッシュペナルティが完了")));
 assert.equal(x.state.ruleState.processStack.length,0); assert.ok(x.state.log.filter(e=>e.message.includes("山札をシャッフル")).length>=1);
});

test("実在データはAUTO②の複合Cost・検索・Hand追加・shuffleを宣言する",async()=>{
 const data=JSON.parse(await readFile(new URL("../data/card-masters.json",import.meta.url),"utf8")); const ability=data.find(c=>c.cardNumber==="CHA/W40-026SP").abilities[1];
 assert.deepEqual(ability.costs.map(c=>c.type),["PAY_STOCK","MOVE_DECK_TOP_TO_CLOCK"]);
 assert.deepEqual(ability.effects.map(e=>e.type),["SEARCH_DECK","ADD_TO_HAND","SHUFFLE_DECK"]);
});

test("Rule順序選択UIとスマホ山札検索footerは操作可能な構造・overflowを持つ",async()=>{
 const [html,css,main,controller]=await Promise.all([
  readFile(new URL("../index.html",import.meta.url),"utf8"),
  readFile(new URL("../css/board.css",import.meta.url),"utf8"),
  readFile(new URL("../js/main.dev.js",import.meta.url),"utf8"),
  readFile(new URL("../js/ui/ruleInterruptController.js",import.meta.url),"utf8"),
 ]);
 assert.match(html,/data-rule-interrupt-list/); assert.match(controller,/selectPendingInterrupt/); assert.match(main,/RuleInterruptController/);
 assert.match(html,/card-selection-dialog__footer/); assert.match(css,/\[data-deck-search\] \.card-selection-dialog__cards[\s\S]*overflow-y: auto/);
 assert.match(css,/\[data-deck-search\] \.modal-action-button[\s\S]*min-height: 44px/);
});
