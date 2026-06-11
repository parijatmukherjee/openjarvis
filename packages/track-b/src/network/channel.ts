export interface SyncMessage {
  type: "delta" | "full" | "heartbeat" | "revoke";
  fromDevice: string;
  vectorClock: Record<string, number>;
  payload: SyncPayload;
}

export type SyncPayload =
  | { type: "events"; events: unknown[] }
  | { type: "audit"; entries: unknown[] }
  | { type: "vault"; key: string; value: string; vectorClock: Record<string, number> }
  | { type: "memory"; fragments: unknown[] }
  | { type: "device"; device: unknown };

export class EncryptedChannel {
  constructor(
    private cipher: {
      encrypt: (data: Uint8Array) => Uint8Array;
      decrypt: (data: Uint8Array) => Uint8Array;
    },
  ) {}

  send(msg: SyncMessage): Uint8Array {
    const payload = new TextEncoder().encode(JSON.stringify(msg));
    return this.cipher.encrypt(payload);
  }

  receive(data: Uint8Array): SyncMessage {
    const decrypted = this.cipher.decrypt(data);
    return JSON.parse(new TextDecoder().decode(decrypted)) as SyncMessage;
  }
}
