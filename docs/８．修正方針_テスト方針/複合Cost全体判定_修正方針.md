# 複合Cost全体判定 修正方針

## 背景・範囲

F-5完了前調査で、Stock 1に対するPAY_STOCK 1×2が各itemの独立判定を通り、payment途中で例外と部分支払いになることを確認した。現行mainの3Type（PAY_STOCK / MOVE_DECK_TOP_TO_CLOCK amount=1 / REST_SELF）について、記載順に最後まで払えるかをnon-mutatingで判定する。ACT / AUTO共通Resolverを修正する。

## 方式比較と採用案

- ResolverにType別集計を置く方式：枚数合計には足りるが、RESTや順序依存をType分岐へ集中させるため採用しない。
- Handlerが資源の仮想残数・positionを順次更新する方式：現在のHandler責務と記載順に合い、必要な3値だけで判定できるため採用する。
- simulation用Player / Cardを作る方式：現行Typeに不要なモデル模倣が増えるため採用しない。
- GameState全体clone・実mutation後rollback・transaction engineは対象外。

Resolverは全itemのschemaを先に検証し、現在のStock枚数・Deck枚数・source positionからローカルな仮想資源状態を作る。Handlerは自分の支払条件を判定し、成立した場合だけ仮想資源を消費する。通常のgetDisabledReasonとactual payの責務は維持する。全体NGなら実Card / collectionに触れず既存のType別理由を返す。

## 境界

getCostsDisabledReasonを共通経路として、表示・select・Prepared commit・ACT VALIDATE・payCosts直前の防御へ適用する。Prepared selection検証は維持し、その後に現在Stateから全体判定する。将来の選択Costは同じHandler内で選択対象と仮想消費を整合させる必要があるが、今回は追加しない。

全体検証後だけ記載順に同期paymentし、Cost item間にQuery / Rule Checkを挟まない。全Cost完了後のCheck Point、costIndex保存、Rule割り込み・parent resumeを維持する。任意callbackの例外や不正なcollectionをrollbackする保証は追加しない。

## 検証・資料

修正前に共有Stock不足の失敗テストを実行する。Stock量の4ケース、Deck 1/2、REST重複、異種資源と各不足、Query純粋性、Prepared再評価、payment境界、Pending保持/不使用、ACT拒否/成功を追加する。既存全体回帰とChromiumの開始・MAIN・集中・代表AUTOを確認する。

READMEはF-5未完了・Follow-upと中期方針に限定して更新する。Cost共通正本と必要なACT/AUTO参照を同期する。履歴の結果・一覧を更新する。Domain内部観点を無理に画面チェックIDへ増やさず、実施結果は必要なら現行ひな形の全量コピーで作り、ユーザー実機を推測でOKにしない。

Event発行、Ability Type / Effect整合、Phase AUTO / resume、turn boundary、ACT Condition、新Cost、CONTINUOUS以降は変更しない。F-7以降の番号は確定しない。
