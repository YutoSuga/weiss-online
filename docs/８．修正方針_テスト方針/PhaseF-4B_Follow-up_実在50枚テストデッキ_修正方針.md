# Phase F-4B Follow-up 実在50枚テストデッキ 修正方針

## 目的

「人気アイドル 西森 柚咲」の実装済み【起】集中を、本番相当の実在カード構成でブラウザ確認できるようにする。

## 対象と方針

- 既存の仮想CardMasterとF-4B Ability Engineは変更しない。
- 指定された実在カード16種類をCardMasterへ追加し、既存の「人気アイドル 西森 柚咲」と合わせた17種類をDeckDefinitionへ設定する。
- 構成はCHARACTER 40枚、EVENT 2枚、CLIMAX 8枚、計50枚とする。
- 新規16種類の`abilities`は空配列とする。
- ユーザー確定値以外のPower / Soulは推測しない。現行schemaが許容する`null`を使用する。
- CardMaster値、Trigger Icon重複、枚数内訳、既存集中、owner別instance、DEV集約を自動テストする。

## 非対象

Ability Engine、DEV UI、Deck構築ルールvalidation、および既存仮想CardMasterの削除は行わない。
