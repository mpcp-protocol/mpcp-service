/**
 * Type declaration for optional @hashgraph/sdk.
 * When the package is not installed, this allows the project to build.
 */
declare module "@hashgraph/sdk" {
  export class Client {
    static forName(network: string): Client;
    setOperator(accountId: unknown, privateKey: unknown): void;
    close(): void;
  }
  export class TopicMessageSubmitTransaction {
    setTopicId(topicId: unknown): this;
    setMessage(message: Uint8Array): this;
    execute(client: Client): Promise<{ getReceipt(client: Client): Promise<{ topicSequenceNumber?: bigint; consensusTimestamp?: { seconds?: number; toDate(): Date } }> }>;
  }
  export class PrivateKey {
    static fromString(str: string): PrivateKey;
  }
  export class AccountId {
    static fromString(str: string): AccountId;
  }
  export class TopicId {
    static fromString(str: string): TopicId;
  }
}
