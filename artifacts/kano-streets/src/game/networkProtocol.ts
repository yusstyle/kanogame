/**
 * Kano Streets — Billion-Player Scalability Foundation & Network Protocol
 *
 * Provides authoritative transaction interfaces, player identity contracts,
 * property deed ledgers, and idempotent transaction verification.
 *
 * Designed to ensure single-player offline stability while preparing
 * the clean, testable contract layer for global cloud-save synchronization
 * and future regional authoritative game clusters.
 */

import type { PropertyId } from "./types";
import type { SaveData } from "./economySystem";

export type RegionalCluster =
  | "africa-west"     // Lagos edge datacenter (primary for Nigeria & West Africa)
  | "europe-central"  // Frankfurt cluster
  | "americas-east"   // N. Virginia cluster
  | "asia-east";      // Singapore cluster

export interface PlayerIdentity {
  playerId: string;
  username: string;
  displayName: string;
  region: RegionalCluster;
  registeredAt: number;
  lastActiveAt: number;
}

export interface PropertyLedgerRecord {
  propertyId: PropertyId;
  deedId: string;
  ownerPlayerId: string;
  titleType: "freehold" | "leasehold";
  registeredValue: number;
  issuedAt: number;
  idempotencyKey: string;
  signature: string;
}

export type TransactionType =
  | "property_purchase"
  | "property_lease"
  | "mission_payout"
  | "business_revenue"
  | "upkeep_deduction";

export interface TransactionRequest {
  idempotencyKey: string;
  playerId: string;
  type: TransactionType;
  propertyId?: PropertyId;
  amount: number;
  timestamp: number;
}

export interface TransactionResponse {
  success: boolean;
  idempotencyKey: string;
  transactionId: string;
  balanceAfter: number;
  receiptCode: string;
  errorMessage?: string;
  isDuplicate: boolean;
  processedAt: number;
}

export interface CloudSaveSyncPayload {
  playerId: string;
  sequenceNumber: number;
  timestamp: number;
  saveData: SaveData;
  checksum: string;
}

/**
 * Computes a deterministic string hash for payload checksum verification.
 */
export function computePayloadChecksum(payload: unknown): string {
  const json = JSON.stringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Authoritative Ledger Engine
 *
 * Implements local authoritative state machine rules:
 * 1. Strict Idempotency: Repeating a transaction with the same key returns the
 *    prior receipt without duplicate charge or state modification.
 * 2. Title Uniqueness: A single freehold property cannot be double-sold.
 * 3. Atomic Balance Verification: Cash balance cannot fall below zero.
 * 4. Audit Trail: Every transaction records a verifiable receipt code.
 */
export class AuthoritativeLedger {
  private propertyTitles = new Map<PropertyId, PropertyLedgerRecord>();
  private processedTransactions = new Map<string, TransactionResponse>();
  private playerBalances = new Map<string, number>();

  constructor() {
    this.initDefaultLedger();
  }

  private initDefaultLedger() {
    this.propertyTitles.clear();
    this.processedTransactions.clear();
    this.playerBalances.clear();
  }

  public registerPlayer(identity: PlayerIdentity, initialBalance = 0): void {
    if (!this.playerBalances.has(identity.playerId)) {
      this.playerBalances.set(identity.playerId, Math.max(0, initialBalance));
    }
  }

  public getPlayerBalance(playerId: string): number {
    return this.playerBalances.get(playerId) ?? 0;
  }

  public setPlayerBalance(playerId: string, balance: number): void {
    this.playerBalances.set(playerId, Math.max(0, balance));
  }

  public getPropertyTitle(propertyId: PropertyId): PropertyLedgerRecord | undefined {
    return this.propertyTitles.get(propertyId);
  }

  public isPropertyOwned(propertyId: PropertyId): boolean {
    return this.propertyTitles.has(propertyId);
  }

  /**
   * Authoritatively processes a financial or property transaction with idempotency guarantees.
   */
  public processTransaction(request: TransactionRequest): TransactionResponse {
    // 1. Idempotency Check: return existing receipt if already processed
    const existing = this.processedTransactions.get(request.idempotencyKey);
    if (existing) {
      return {
        ...existing,
        isDuplicate: true,
      };
    }

    const currentBalance = this.getPlayerBalance(request.playerId);

    // 2. Validate property purchase
    if (request.type === "property_purchase") {
      if (!request.propertyId) {
        return this.createFailureReceipt(request, currentBalance, "Invalid request: missing propertyId");
      }

      // Check if property is already owned by someone else
      const existingTitle = this.propertyTitles.get(request.propertyId);
      if (existingTitle && existingTitle.ownerPlayerId !== request.playerId) {
        return this.createFailureReceipt(
          request,
          currentBalance,
          `Property ${request.propertyId} is already owned by player ${existingTitle.ownerPlayerId}`,
        );
      }

      // Check balance
      if (currentBalance < request.amount) {
        return this.createFailureReceipt(
          request,
          currentBalance,
          `Insufficient funds: requires ₦${request.amount.toLocaleString()}, balance is ₦${currentBalance.toLocaleString()}`,
        );
      }

      // Execute transaction
      const newBalance = currentBalance - request.amount;
      this.setPlayerBalance(request.playerId, newBalance);

      const deedId = `KAN-DEED-${request.propertyId.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const titleRecord: PropertyLedgerRecord = {
        propertyId: request.propertyId,
        deedId,
        ownerPlayerId: request.playerId,
        titleType: "freehold",
        registeredValue: request.amount,
        issuedAt: Date.now(),
        idempotencyKey: request.idempotencyKey,
        signature: computePayloadChecksum({ deedId, owner: request.playerId, amount: request.amount }),
      };
      this.propertyTitles.set(request.propertyId, titleRecord);

      const response: TransactionResponse = {
        success: true,
        idempotencyKey: request.idempotencyKey,
        transactionId: `TX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        balanceAfter: newBalance,
        receiptCode: `RC-OK-${deedId}`,
        isDuplicate: false,
        processedAt: Date.now(),
      };
      this.processedTransactions.set(request.idempotencyKey, response);
      return response;
    }

    // 3. Validate property lease
    if (request.type === "property_lease") {
      if (currentBalance < request.amount) {
        return this.createFailureReceipt(request, currentBalance, "Insufficient funds for monthly lease");
      }
      const newBalance = currentBalance - request.amount;
      this.setPlayerBalance(request.playerId, newBalance);

      const response: TransactionResponse = {
        success: true,
        idempotencyKey: request.idempotencyKey,
        transactionId: `TX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        balanceAfter: newBalance,
        receiptCode: `RC-LEASE-${Date.now()}`,
        isDuplicate: false,
        processedAt: Date.now(),
      };
      this.processedTransactions.set(request.idempotencyKey, response);
      return response;
    }

    // 4. Mission payout / business revenue
    if (request.type === "mission_payout" || request.type === "business_revenue") {
      const newBalance = currentBalance + request.amount;
      this.setPlayerBalance(request.playerId, newBalance);

      const response: TransactionResponse = {
        success: true,
        idempotencyKey: request.idempotencyKey,
        transactionId: `TX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        balanceAfter: newBalance,
        receiptCode: `RC-PAY-${request.type.toUpperCase()}-${Date.now()}`,
        isDuplicate: false,
        processedAt: Date.now(),
      };
      this.processedTransactions.set(request.idempotencyKey, response);
      return response;
    }

    // Default fallback
    return this.createFailureReceipt(request, currentBalance, "Unsupported transaction type");
  }

  private createFailureReceipt(
    request: TransactionRequest,
    balance: number,
    error: string,
  ): TransactionResponse {
    const response: TransactionResponse = {
      success: false,
      idempotencyKey: request.idempotencyKey,
      transactionId: `TX-FAIL-${Date.now()}`,
      balanceAfter: balance,
      receiptCode: "RC-FAILED",
      errorMessage: error,
      isDuplicate: false,
      processedAt: Date.now(),
    };
    this.processedTransactions.set(request.idempotencyKey, response);
    return response;
  }

  /**
   * Verifies an incoming cloud save sync payload against checksum tamper detection.
   */
  public verifyCloudSavePayload(payload: CloudSaveSyncPayload): { valid: boolean; reason?: string } {
    if (!payload.playerId || !payload.saveData) {
      return { valid: false, reason: "Malformed sync payload: missing playerId or saveData" };
    }

    const calculatedChecksum = computePayloadChecksum(payload.saveData);
    if (calculatedChecksum !== payload.checksum) {
      return {
        valid: false,
        reason: `Checksum mismatch: expected ${calculatedChecksum}, received ${payload.checksum}`,
      };
    }

    return { valid: true };
  }
}
