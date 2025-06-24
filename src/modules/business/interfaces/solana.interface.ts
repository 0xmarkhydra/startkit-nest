export interface SolanaTransaction {
  signature: string;
  slot: number;
  blockTime: number;
  confirmations: number;
  meta: {
    fee: number;
    postBalances: number[];
    preBalances: number[];
    status: {
      Ok: null | string;
    };
  };
}

export interface SolanaTransferParams {
  fromWallet: string;
  toWallet: string;
  amount: number;
  token: string; // Token mint address
}

export interface SolanaBalance {
  address: string;
  balance: number;
  decimals: number;
} 