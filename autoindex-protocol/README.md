# Index Fund Protocol

A decentralized protocol for creating and managing automatically rebalanced crypto index funds with custom weightings on the Stacks blockchain.

## Overview

The Index Fund Protocol allows users to create, manage, and invest in tokenized index funds that automatically rebalance based on predefined asset weightings. Fund managers can create custom index funds with specific asset allocations, while investors can deposit STX to receive proportional shares of the fund.

## Features

- **Custom Index Fund Creation**: Create index funds with custom names, symbols, and management fees
- **Multi-Asset Support**: Add multiple cryptocurrencies to index funds with target weight allocations
- **Automatic Rebalancing**: Funds automatically rebalance when deviation thresholds are met
- **Proportional Share System**: Users receive shares proportional to their investment
- **Fee Management**: Configurable management fees and protocol fees
- **Emergency Controls**: Fund pausing and reactivation capabilities
- **Performance Tracking**: Built-in performance metrics and NAV calculations

## Contract Architecture

### Core Components

- **Fund Management**: Create and manage index funds with custom parameters
- **Asset Registry**: Register and manage tradeable assets
- **User Positions**: Track individual investor holdings and shares
- **Rebalancing Engine**: Automatic portfolio rebalancing based on target weights
- **Price Integration**: Asset price updates (oracle-ready)

### Key Data Structures

- `funds`: Core fund information including name, symbol, total supply, and status
- `fund-assets`: Asset allocations and weights within each fund
- `user-positions`: Individual investor positions and share ownership
- `asset-registry`: Registry of supported tokens and their metadata
- `fund-performance`: Historical performance tracking

## Getting Started

### Prerequisites

- Stacks blockchain environment
- Clarity CLI or development environment
- STX tokens for transactions

### Deployment

1. Deploy the contract to Stacks blockchain:
```bash
clarinet deploy
```

2. Initialize the protocol by registering assets:
```clarity
(contract-call? .index-fund-protocol register-asset 
  u1 
  'SP000000000000000000002Q6VF78.token-contract 
  "BTC" 
  u8)
```

### Usage Examples

#### Creating an Index Fund

```clarity
;; Create a new index fund with 2% annual management fee
(contract-call? .index-fund-protocol create-fund 
  "Crypto Index Fund" 
  "CIF" 
  u200)
```

#### Adding Assets to Fund

```clarity
;; Add BTC with 50% target weight
(contract-call? .index-fund-protocol add-fund-asset 
  u1    ;; fund-id
  u1    ;; asset-id (BTC)
  u5000 ;; 50% weight (5000 basis points)
)

;; Add ETH with 30% target weight
(contract-call? .index-fund-protocol add-fund-asset 
  u1    ;; fund-id
  u2    ;; asset-id (ETH)
  u3000 ;; 30% weight
)
```

#### Investing in a Fund

```clarity
;; Deposit 1000 STX into fund ID 1
(contract-call? .index-fund-protocol deposit-stx u1 u1000000)
```

#### Withdrawing from a Fund

```clarity
;; Withdraw 500 shares from fund ID 1
(contract-call? .index-fund-protocol withdraw u1 u500)
```

## API Reference

### Read-Only Functions

#### `get-fund (fund-id uint)`
Returns fund information including name, symbol, manager, and status.

#### `get-user-position (fund-id uint) (user principal)`
Returns user's position in a specific fund including shares owned and deposit history.

#### `calculate-fund-nav (fund-id uint)`
Calculates the current Net Asset Value (NAV) of a fund.

#### `get-user-value (fund-id uint) (user principal)`
Returns the current value of a user's position in STX.

#### `check-rebalance-needed (fund-id uint)`
Checks if a fund requires rebalancing based on time and weight thresholds.

### Public Functions

#### Fund Management
- `create-fund`: Create a new index fund
- `pause-fund`: Emergency pause fund operations
- `reactivate-fund`: Reactivate a paused fund

#### Asset Management
- `register-asset`: Register new tradeable assets
- `add-fund-asset`: Add assets to funds with target weights
- `update-asset-price`: Update asset prices (oracle integration)

#### User Operations
- `deposit-stx`: Invest STX to receive fund shares
- `withdraw`: Withdraw proportional value by burning shares

#### Rebalancing
- `rebalance-fund`: Trigger fund rebalancing to target weights

#### Protocol Administration
- `update-protocol-fee`: Adjust protocol fee rates
- `update-rebalance-threshold`: Modify rebalancing thresholds

## Configuration

### Protocol Parameters

- **Protocol Fee Rate**: Currently set to 1% (100 basis points)
- **Rebalance Threshold**: 5% deviation threshold (500 basis points)
- **Maximum Management Fee**: 10% annual (1000 basis points)
- **Rebalance Frequency**: Minimum 24 hours between rebalances

### Error Codes

- `u100`: Owner-only operation
- `u101`: Resource not found
- `u102`: Invalid amount
- `u103`: Insufficient balance
- `u104`: Invalid weight allocation
- `u105`: Fund not active
- `u106`: Rebalancing not needed
- `u107`: Unauthorized operation
- `u108`: Invalid token

## Security Considerations

- Only contract owner can create funds and register assets
- Fund managers can only manage their own funds
- Emergency pause functionality for critical situations
- Input validation on all parameters
- Balance checks before withdrawals

## Limitations & Future Enhancements

### Current Limitations
- Simplified price oracle integration (manual price updates)
- Basic rebalancing logic (implementation placeholder)
- STX-only deposits (no direct token deposits)

### Planned Enhancements
- Integration with decentralized price oracles
- Automated DEX trading for rebalancing
- Multi-token deposit support
- Advanced fee structures
- Governance token implementation

## Development

### Testing

Run the test suite:
```bash
clarinet test
```

### Local Development

Start local development environment:
```bash
clarinet console
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Disclaimer

This smart contract is provided as-is for educational and development purposes. Conduct thorough testing and auditing before using in production. Cryptocurrency investments carry inherent risks.

## Contact

For questions, issues, or contributions, please open an issue on the project repository.