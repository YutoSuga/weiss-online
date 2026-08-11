import {
  PROCESS_STATUS_VALUES,
  PROCESS_TYPE_VALUES,
} from "../constants/process.js";
import { GameState } from "../models/gameState.js";

/**
 * @typedef {object} Process
 * @property {string} type プロセス種別
 * @property {string} playerId 対象または現在のプレイヤー
 * @property {string} step 次に実行する処理
 * @property {string} status 実行状態
 * @property {Record<string, unknown>} context プロセス固有データ
 */

/**
 * GameState上のprocessStackだけを管理する。
 * 割り込みの検出、優先順位、ゲームルールの実行は担当しない。
 */
export class ProcessManager {
  /**
   * @param {GameState} gameState
   */
  constructor(gameState) {
    if (!(gameState instanceof GameState)) {
      throw new TypeError("gameState must be a GameState instance.");
    }

    if (
      !gameState.ruleState ||
      !Array.isArray(gameState.ruleState.processStack)
    ) {
      throw new TypeError("gameState.ruleState.processStack must be an array.");
    }

    this.gameState = gameState;
  }

  /**
   * Processをスタック最上段へ追加する。
   * 呼び出し元のProcessとcontextは浅くコピーして保持する。
   *
   * @param {Process} process
   * @returns {Process} スタックへ追加したProcess
   */
  pushProcess(process) {
    this.#assertProcess(process);

    const storedProcess = {
      type: process.type,
      playerId: process.playerId,
      step: process.step,
      status: process.status,
      context: { ...process.context },
    };

    this.gameState.ruleState.processStack.push(storedProcess);
    return storedProcess;
  }

  /**
   * 現在のProcessをスタックから取り除いて返す。
   *
   * @returns {Process|null}
   */
  popProcess() {
    return this.gameState.ruleState.processStack.pop() ?? null;
  }

  /**
   * スタック最上段の現在Processを返す。
   *
   * @returns {Process|null}
   */
  getCurrentProcess() {
    const { processStack } = this.gameState.ruleState;
    return processStack[processStack.length - 1] ?? null;
  }

  /**
   * 現在Processの「次に実行する処理」を更新する。
   *
   * @param {string} step
   * @returns {Process|null}
   */
  updateStep(step) {
    if (typeof step !== "string" || step.trim().length === 0) {
      throw new TypeError("step must be a non-empty string.");
    }

    const process = this.getCurrentProcess();
    if (!process) {
      return null;
    }

    process.step = step;
    return process;
  }

  /**
   * 現在Processの実行状態を更新する。
   *
   * @param {string} status
   * @returns {Process|null}
   */
  updateStatus(status) {
    if (!PROCESS_STATUS_VALUES.includes(status)) {
      throw new RangeError(
        `status must be one of: ${PROCESS_STATUS_VALUES.join(", ")}.`,
      );
    }

    const process = this.getCurrentProcess();
    if (!process) {
      return null;
    }

    process.status = status;
    return process;
  }

  /**
   * @param {unknown} process
   * @returns {asserts process is Process}
   */
  #assertProcess(process) {
    if (!process || typeof process !== "object" || Array.isArray(process)) {
      throw new TypeError("process must be an object.");
    }

    if (!PROCESS_TYPE_VALUES.includes(process.type)) {
      throw new RangeError(
        `process.type must be one of: ${PROCESS_TYPE_VALUES.join(", ")}.`,
      );
    }

    if (
      process.playerId !== this.gameState.turnOrder.first &&
      process.playerId !== this.gameState.turnOrder.second
    ) {
      throw new RangeError("process.playerId must identify a game player.");
    }

    if (typeof process.step !== "string" || process.step.trim().length === 0) {
      throw new TypeError("process.step must be a non-empty string.");
    }

    if (!PROCESS_STATUS_VALUES.includes(process.status)) {
      throw new RangeError(
        `process.status must be one of: ${PROCESS_STATUS_VALUES.join(", ")}.`,
      );
    }

    if (
      !process.context ||
      typeof process.context !== "object" ||
      Array.isArray(process.context)
    ) {
      throw new TypeError("process.context must be an object.");
    }
  }
}
