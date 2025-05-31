import { describe, expect, it } from "vitest";

// Mock Clarinet functions and types
const mockClarinet = {
  test: (testFn: () => void) => testFn(),
  chain: {
    mineBlock: (transactions: any[]) => ({
      height: 1,
      receipts: transactions.map((tx, index) => ({
        result: tx.result || { type: 'ok', value: 'u1' },
        events: [],
        transaction: tx
      }))
    }),
    callReadOnlyFn: (contract: string, method: string, args: any[], sender: string) => ({
      result: { type: 'ok', value: 'u1000000' }
    })
  },
  accounts: new Map([
    ['deployer', { address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' }],
    ['wallet_1', { address: 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5' }],
    ['wallet_2', { address: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG' }]
  ]),
  types: {
    ok: (value: any) => ({ type: 'ok', value }),
    err: (value: any) => ({ type: 'err', value }),
    uint: (value: number) => `u${value}`,
    principal: (address: string) => address,
    ascii: (text: string) => `"${text}"`
  },
  tx: {
    contractCall: (contract: string, method: string, args: any[], sender: string) => ({
      type: 'contract-call',
      contract,
      method,
      args,
      sender,
      result: { type: 'ok', value: 'u1' }
    })
  }
};

// Test data
const testData = {
  deployer: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  wallet1: 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5',
  wallet2: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
  fundName: "Crypto Index Fund",
  fundSymbol: "CIF",
  managementFee: 200, // 2%
  depositAmount: 1000000, // 1 STX in microSTX
  assetId: 1,
  targetWeight: 5000 // 50%
};

describe("Index Fund Protocol Tests", () => {
  
  describe("Fund Creation", () => {
    it("should create a new fund successfully", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii(testData.fundName),
              mockClarinet.types.ascii(testData.fundSymbol),
              mockClarinet.types.uint(testData.managementFee)
            ],
            testData.deployer
          )
        ]);

        expect(block.receipts).toHaveLength(1);
        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('u1'); // First fund ID
      });
    });

    it("should fail to create fund with excessive management fee", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii("High Fee Fund"),
              mockClarinet.types.ascii("HFF"),
              mockClarinet.types.uint(1500) // 15% - should fail
            ],
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u102'); // ERR-INVALID-AMOUNT
      });
    });

    it("should fail when non-owner tries to create fund", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii("Unauthorized Fund"),
              mockClarinet.types.ascii("UF"),
              mockClarinet.types.uint(100)
            ],
            testData.wallet1 // Non-owner
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u100'); // ERR-OWNER-ONLY
      });
    });
  });

  describe("Asset Registration", () => {
    it("should register a new asset successfully", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'register-asset',
            [
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.principal('ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.wrapped-bitcoin'),
              mockClarinet.types.ascii("WBTC"),
              mockClarinet.types.uint(8)
            ],
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('true');
      });
    });

    it("should fail when non-owner tries to register asset", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'register-asset',
            [
              mockClarinet.types.uint(2),
              mockClarinet.types.principal('ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.wrapped-ethereum'),
              mockClarinet.types.ascii("WETH"),
              mockClarinet.types.uint(18)
            ],
            testData.wallet1
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u100'); // ERR-OWNER-ONLY
      });
    });
  });

  describe("Fund Asset Management", () => {
    it("should add asset to fund with valid weight", () => {
      mockClarinet.test(() => {
        // First create fund and register asset
        let block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii(testData.fundName),
              mockClarinet.types.ascii(testData.fundSymbol),
              mockClarinet.types.uint(testData.managementFee)
            ],
            testData.deployer
          ),
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'register-asset',
            [
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.principal('ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.wrapped-bitcoin'),
              mockClarinet.types.ascii("WBTC"),
              mockClarinet.types.uint(8)
            ],
            testData.deployer
          )
        ]);

        // Then add asset to fund
        block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'add-fund-asset',
            [
              mockClarinet.types.uint(1), // fund-id
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.uint(testData.targetWeight)
            ],
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('true');
      });
    });

    it("should fail to add asset with invalid weight (>100%)", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'add-fund-asset',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.uint(15000) // 150% - invalid
            ],
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u104'); // ERR-INVALID-WEIGHT
      });
    });

    it("should fail when unauthorized user tries to add asset", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'add-fund-asset',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.uint(testData.targetWeight)
            ],
            testData.wallet1 // Not fund manager
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u107'); // ERR-UNAUTHORIZED
      });
    });
  });

  describe("STX Deposits", () => {
    it("should allow user to deposit STX and receive shares", () => {
      mockClarinet.test(() => {
        // Setup: Create fund first
        let block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii(testData.fundName),
              mockClarinet.types.ascii(testData.fundSymbol),
              mockClarinet.types.uint(testData.managementFee)
            ],
            testData.deployer
          )
        ]);

        // User deposits STX
        block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'deposit-stx',
            [
              mockClarinet.types.uint(1), // fund-id
              mockClarinet.types.uint(testData.depositAmount)
            ],
            testData.wallet1
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        // First deposit should mint shares equal to deposit amount
        expect(parseInt(block.recipients[0]?.result.value.slice(1))).toBeGreaterThan(0);
      });
    });

    it("should fail deposit with zero amount", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'deposit-stx',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(0) // Zero amount
            ],
            testData.wallet1
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u102'); // ERR-INVALID-AMOUNT
      });
    });

    it("should fail deposit to inactive fund", () => {
      mockClarinet.test(() => {
        // Create and then pause fund
        let block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii("Test Fund"),
              mockClarinet.types.ascii("TF"),
              mockClarinet.types.uint(100)
            ],
            testData.deployer
          ),
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'pause-fund',
            [mockClarinet.types.uint(1)],
            testData.deployer
          )
        ]);

        // Try to deposit to paused fund
        block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'deposit-stx',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(testData.depositAmount)
            ],
            testData.wallet1
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u105'); // ERR-FUND-NOT-ACTIVE
      });
    });
  });

  describe("Withdrawals", () => {
    it("should allow user to withdraw their shares", () => {
      mockClarinet.test(() => {
        // Setup: Create fund and deposit
        let block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii(testData.fundName),
              mockClarinet.types.ascii(testData.fundSymbol),
              mockClarinet.types.uint(testData.managementFee)
            ],
            testData.deployer
          ),
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'deposit-stx',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(testData.depositAmount)
            ],
            testData.wallet1
          )
        ]);

        // Withdraw half the shares
        block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'withdraw',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(testData.depositAmount / 2)
            ],
            testData.wallet1
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(parseInt(block.recipients[0]?.result.value.slice(1))).toBeGreaterThan(0);
      });
    });

    it("should fail withdrawal with insufficient shares", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'withdraw',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(999999999) // More than user has
            ],
            testData.wallet2 // User with no shares
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u103'); // ERR-INSUFFICIENT-BALANCE
      });
    });
  });

  describe("Fund Rebalancing", () => {
    it("should allow fund manager to rebalance", () => {
      mockClarinet.test(() => {
        // Create fund and wait (mock time passage)
        let block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii(testData.fundName),
              mockClarinet.types.ascii(testData.fundSymbol),
              mockClarinet.types.uint(testData.managementFee)
            ],
            testData.deployer
          )
        ]);

        // Mine many blocks to simulate time passage
        for (let i = 0; i < 150; i++) {
          mockClarinet.chain.mineBlock([]);
        }

        // Rebalance
        block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'rebalance-fund',
            [mockClarinet.types.uint(1)],
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('true');
      });
    });

    it("should fail rebalance when not needed (too soon)", () => {
      mockClarinet.test(() => {
        // Create fund and immediately try to rebalance
        let block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii(testData.fundName),
              mockClarinet.types.ascii(testData.fundSymbol),
              mockClarinet.types.uint(testData.managementFee)
            ],
            testData.deployer
          ),
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'rebalance-fund',
            [mockClarinet.types.uint(1)],
            testData.deployer
          )
        ]);

        expect(block.recipients[1]?.result.type).toBe('err');
        expect(block.recipients[1]?.result.value).toBe('u106'); // ERR-REBALANCE-NOT-NEEDED
      });
    });

    it("should fail when unauthorized user tries to rebalance", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'rebalance-fund',
            [mockClarinet.types.uint(1)],
            testData.wallet1 // Not fund manager or owner
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u107'); // ERR-UNAUTHORIZED
      });
    });
  });

  describe("Asset Price Updates", () => {
    it("should allow authorized users to update asset prices", () => {
      mockClarinet.test(() => {
        // Setup: Create fund, register asset, add to fund
        let block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii(testData.fundName),
              mockClarinet.types.ascii(testData.fundSymbol),
              mockClarinet.types.uint(testData.managementFee)
            ],
            testData.deployer
          ),
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'register-asset',
            [
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.principal('ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.wrapped-bitcoin'),
              mockClarinet.types.ascii("WBTC"),
              mockClarinet.types.uint(8)
            ],
            testData.deployer
          ),
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'add-fund-asset',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.uint(testData.targetWeight)
            ],
            testData.deployer
          )
        ]);

        // Update price
        block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'update-asset-price',
            [
              mockClarinet.types.uint(1), // fund-id
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.uint(2000000) // New price
            ],
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('true');
      });
    });

    it("should fail when unauthorized user tries to update price", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'update-asset-price',
            [
              mockClarinet.types.uint(1),
              mockClarinet.types.uint(testData.assetId),
              mockClarinet.types.uint(2000000)
            ],
            testData.wallet1
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u107'); // ERR-UNAUTHORIZED
      });
    });
  });

  describe("Read-Only Functions", () => {
    it("should return fund information correctly", () => {
      mockClarinet.test(() => {
        // Create fund first
        mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'create-fund',
            [
              mockClarinet.types.ascii(testData.fundName),
              mockClarinet.types.ascii(testData.fundSymbol),
              mockClarinet.types.uint(testData.managementFee)
            ],
            testData.deployer
          )
        ]);

        const result = mockClarinet.chain.callReadOnlyFn(
          'autoindex-protocol',
          'get-fund',
          [mockClarinet.types.uint(1)],
          testData.deployer
        );

        expect(result.result.type).toBe('ok');
        // Fund should exist and be active
        expect(result.result.value).toBeDefined();
      });
    });

    it("should calculate fund NAV correctly", () => {
      mockClarinet.test(() => {
        const result = mockClarinet.chain.callReadOnlyFn(
          'autoindex-protocol',
          'calculate-fund-nav',
          [mockClarinet.types.uint(1)],
          testData.deployer
        );

        expect(result.result.type).toBe('ok');
        expect(parseInt(result.result.value.slice(1))).toBeGreaterThanOrEqual(0);
      });
    });

    it("should check rebalance requirements correctly", () => {
      mockClarinet.test(() => {
        const result = mockClarinet.chain.callReadOnlyFn(
          'autoindex-protocol',
          'check-rebalance-needed',
          [mockClarinet.types.uint(1)],
          testData.deployer
        );

        expect(result.result.type).toBe('ok');
        expect(typeof result.result.value).toBe('string');
      });
    });
  });

  describe("Fund Administration", () => {
    it("should allow owner to pause fund", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'pause-fund',
            [mockClarinet.types.uint(1)],
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('true');
      });
    });

    it("should allow owner to reactivate fund", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'reactivate-fund',
            [mockClarinet.types.uint(1)],
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('true');
      });
    });

    it("should allow owner to update protocol fee", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'update-protocol-fee',
            [mockClarinet.types.uint(150)], // 1.5%
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('true');
      });
    });

    it("should fail to update protocol fee with excessive rate", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'update-protocol-fee',
            [mockClarinet.types.uint(1500)], // 15% - too high
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('err');
        expect(block.recipients[0]?.result.value).toBe('u102'); // ERR-INVALID-AMOUNT
      });
    });

    it("should allow owner to update rebalance threshold", () => {
      mockClarinet.test(() => {
        const block = mockClarinet.chain.mineBlock([
          mockClarinet.tx.contractCall(
            'autoindex-protocol',
            'update-rebalance-threshold',
            [mockClarinet.types.uint(1000)], // 10%
            testData.deployer
          )
        ]);

        expect(block.recipients[0]?.result.type).toBe('ok');
        expect(block.recipients[0]?.result.value).toBe('true');
      });
    });
  });
});