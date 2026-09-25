# Phase F-4A Follow-up REST表示方向 修正方針

## 修正の背景

Phase F-4Aで`REST_SELF`によるCard stateのSTANDからRESTへの変更は成立したが、盤面CSSはRESTを右90°で表示している。ブラウザ確認を受け、weiss-onlineの表示規約を左90°へ統一する。

## 現在の状態と問題点

- RendererはCardのruntime `position`をownerによらず`data-position`へ反映している。
- Stageの`data-position="rest"`に`rotate(90deg)`が指定され、右方向へ回転する。
- REST方向の正式仕様と、修正記録を今後継続する共通運用が文書化されていない。

## 修正目的

RESTを元のCard表示方向から左90°に統一し、現在仕様を正式設計書に記載する。併せて、修正方針・修正結果・一覧による記録運用を正式化する。

## 修正対象

- Stage Cardのposition表示を担うCSS
- REST表示の回帰テスト
- `docs/１．設計書/対戦画面/レイアウト.md`
- `docs/８．修正方針_テスト方針/`の今回記録、一覧、共通運用文書

## 修正しない範囲

`POSITION.REST`、Card.position、`REST_SELF` Cost、canPay/pay、ACT_ABILITY Process、GameEngine、Cost/Effect Resolver、Rule Check、Stage Move/Swap、PLAY_CHARACTER、PAY_STOCK、AUTO/CONTINUOUS、effectQueue、Card type・画像縦横比による回転、詳細画像は変更しない。REVERSEの既存表示も維持する。過去記録を整理・生成・renameしない。

## 実装方針

Rendererのowner共通の`data-position`表現は維持し、Stage Cardの`data-position="rest"`だけを`rotate(-90deg)`へ変更する。STANDの`0deg`、REVERSEの`180deg`、Card詳細のtransformには触れない。self/opponentで同じselectorを使い、cardTypeや画像比率による分岐を加えない。

## 設計書更新方針

盤面の表示方向を所管する`レイアウト.md`へSTAND/REST/REVERSEとowner共通のposition semanticsを現在仕様として記載する。変更理由は本ディレクトリの履歴にのみ記録し、仕様と履歴の責務を分離する。

## テスト方針

- CSSを静的に検証し、STAND `0deg`、REST `-90deg`、REVERSE `180deg`を確認する。
- self/opponent共通selectorであり、詳細画像selectorへposition回転を適用していないことを確認する。
- F-4AテストでREST_SELF後のstateと使用不可判定を維持する。
- 全既存テスト、全JS/MJSの`node --check`、`git diff --check`を実行する。
- ブラウザが利用可能ならSTAND、REST_SELF後の左回転・使用不可、Move/Swap、詳細画像を目視確認する。

## Acceptance Criteria

1. RESTはself/opponentとも元の表示方向から左90°になる。
2. STANDとREVERSEを壊さず、Card type・画像比率による分岐を持たない。
3. Card詳細画像を回転させない。
4. REST_SELF、ACT Ability、Rule Checkその他ゲームロジックを変更しない。
5. 正式設計書、今回の方針・結果・一覧、今後の運用ルールが整合する。
6. 全既存テスト、syntax check、diff checkが成功する。
