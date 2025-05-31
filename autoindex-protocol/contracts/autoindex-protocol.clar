;; Index Fund Protocol
;; Automatically rebalanced crypto index funds with custom weightings

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-OWNER-ONLY (err u100))
(define-constant ERR-NOT-FOUND (err u101))
(define-constant ERR-INVALID-AMOUNT (err u102))
(define-constant ERR-INSUFFICIENT-BALANCE (err u103))
(define-constant ERR-INVALID-WEIGHT (err u104))
(define-constant ERR-FUND-NOT-ACTIVE (err u105))
(define-constant ERR-REBALANCE-NOT-NEEDED (err u106))
(define-constant ERR-UNAUTHORIZED (err u107))
(define-constant ERR-INVALID-TOKEN (err u108))

;; Data Variables
(define-data-var next-fund-id uint u1)
(define-data-var protocol-fee-rate uint u100) ;; 1% = 100 basis points
(define-data-var rebalance-threshold uint u500) ;; 5% threshold for rebalancing

;; Data Maps
(define-map funds 
  uint 
  {
    name: (string-ascii 64),
    symbol: (string-ascii 16),
    manager: principal,
    total-supply: uint,
    total-value: uint,
    active: bool,
    created-at: uint,
    last-rebalance: uint,
    management-fee: uint ;; annual fee in basis points
  }
)

(define-map fund-assets
  { fund-id: uint, asset-id: uint }
  {
    token-contract: principal,
    target-weight: uint, ;; basis points (10000 = 100%)
    current-weight: uint,
    balance: uint,
    last-price: uint
  }
)

(define-map user-positions
  { fund-id: uint, user: principal }
  {
    shares: uint,
    last-deposit: uint,
    total-deposited: uint
  }
)

(define-map asset-registry
  uint
  {
    token-contract: principal,
    symbol: (string-ascii 16),
    decimals: uint,
    active: bool,
    price-oracle: (optional principal)
  }
)

(define-map fund-performance
  { fund-id: uint, period: uint }
  {
    start-value: uint,
    end-value: uint,
    return-rate: int, ;; basis points, can be negative
    period-type: (string-ascii 16) ;; "daily", "weekly", "monthly"
  }
)

;; Read-only functions
(define-read-only (get-fund (fund-id uint))
  (map-get? funds fund-id)
)

(define-read-only (get-fund-asset (fund-id uint) (asset-id uint))
  (map-get? fund-assets { fund-id: fund-id, asset-id: asset-id })
)

(define-read-only (get-user-position (fund-id uint) (user principal))
  (map-get? user-positions { fund-id: fund-id, user: user })
)

(define-read-only (get-asset-info (asset-id uint))
  (map-get? asset-registry asset-id)
)

(define-read-only (calculate-fund-nav (fund-id uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) (err u0)))
  )
    (if (get active fund-info)
      (ok (calculate-total-fund-value fund-id))
      (err u0)
    )
  )
)

(define-read-only (get-user-value (fund-id uint) (user principal))
  (let (
    (position (unwrap! (get-user-position fund-id user) (err u0)))
    (fund-nav (unwrap! (calculate-fund-nav fund-id) (err u0)))
    (fund-info (unwrap! (get-fund fund-id) (err u0)))
    (total-supply (get total-supply fund-info))
  )
    (if (> total-supply u0)
      (ok (/ (* (get shares position) fund-nav) total-supply))
      (ok u0)
    )
  )
)

(define-read-only (check-rebalance-needed (fund-id uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) (err u0)))
  )
    (if (get active fund-info)
      (ok (is-rebalance-required fund-id))
      (err u0)
    )
  )
)

;; Private functions
(define-private (calculate-total-fund-value (fund-id uint))
  ;; Simplified calculation - in production, would integrate with price oracles
  (let (
    (fund-info (unwrap! (get-fund fund-id) u0))
  )
    (get total-value fund-info)
  )
)

(define-private (is-rebalance-required (fund-id uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) false))
  )
    (>= (- stacks-block-height (get last-rebalance fund-info))
        u144) ;; ~24 hours in blocks (assuming 10min blocks)
  )
)

(define-private (calculate-weight-deviation (current-weight uint) (target-weight uint))
  (if (>= current-weight target-weight)
    (- current-weight target-weight)
    (- target-weight current-weight)
  )
)

(define-private (update-fund-value (fund-id uint) (new-value uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) false))
  )
    (map-set funds fund-id
      (merge fund-info { total-value: new-value })
    )
  )
)

;; Public functions

;; Create a new index fund
(define-public (create-fund 
  (name (string-ascii 64))
  (symbol (string-ascii 16))
  (management-fee uint)
)
  (let (
    (fund-id (var-get next-fund-id))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (<= management-fee u1000) ERR-INVALID-AMOUNT) ;; Max 10% annual fee
    
    (map-set funds fund-id {
      name: name,
      symbol: symbol,
      manager: tx-sender,
      total-supply: u0,
      total-value: u0,
      active: true,
      created-at: stacks-block-height,
      last-rebalance: stacks-block-height,
      management-fee: management-fee
    })
    
    (var-set next-fund-id (+ fund-id u1))
    (ok fund-id)
  )
)

;; Register a new asset for trading
(define-public (register-asset
  (asset-id uint)
  (token-contract principal)
  (symbol (string-ascii 16))
  (decimals uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    
    (map-set asset-registry asset-id {
      token-contract: token-contract,
      symbol: symbol,
      decimals: decimals,
      active: true,
      price-oracle: none
    })
    
    (ok true)
  )
)

;; Add asset to fund with target weight
(define-public (add-fund-asset
  (fund-id uint)
  (asset-id uint)
  (target-weight uint)
)
  (let (
    (fund-info (unwrap! (get-fund fund-id) ERR-NOT-FOUND))
    (asset-info (unwrap! (get-asset-info asset-id) ERR-INVALID-TOKEN))
  )
    (asserts! (is-eq tx-sender (get manager fund-info)) ERR-UNAUTHORIZED)
    (asserts! (<= target-weight u10000) ERR-INVALID-WEIGHT) ;; Max 100%
    (asserts! (get active asset-info) ERR-INVALID-TOKEN)
    
    (map-set fund-assets { fund-id: fund-id, asset-id: asset-id } {
      token-contract: (get token-contract asset-info),
      target-weight: target-weight,
      current-weight: u0,
      balance: u0,
      last-price: u1000000 ;; Default price in microunits
    })
    
    (ok true)
  )
)

;; Deposit STX to get fund shares
(define-public (deposit-stx (fund-id uint) (amount uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) ERR-NOT-FOUND))
    (current-nav (unwrap! (calculate-fund-nav fund-id) ERR-FUND-NOT-ACTIVE))
    (current-position (default-to 
      { shares: u0, last-deposit: u0, total-deposited: u0 }
      (get-user-position fund-id tx-sender)
    ))
    (shares-to-mint (if (is-eq current-nav u0) 
                      amount 
                      (/ (* amount (get total-supply fund-info)) current-nav)))
  )
    (asserts! (get active fund-info) ERR-FUND-NOT-ACTIVE)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; Transfer STX from user
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    
    ;; Update user position
    (map-set user-positions { fund-id: fund-id, user: tx-sender }
      {
        shares: (+ (get shares current-position) shares-to-mint),
        last-deposit: stacks-block-height,
        total-deposited: (+ (get total-deposited current-position) amount)
      }
    )
    
    ;; Update fund info
    (map-set funds fund-id
      (merge fund-info {
        total-supply: (+ (get total-supply fund-info) shares-to-mint),
        total-value: (+ (get total-value fund-info) amount)
      })
    )
    
    (ok shares-to-mint)
  )
)

;; Withdraw from fund (burn shares, get proportional assets)
(define-public (withdraw (fund-id uint) (shares uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) ERR-NOT-FOUND))
    (user-position (unwrap! (get-user-position fund-id tx-sender) ERR-NOT-FOUND))
    (current-nav (unwrap! (calculate-fund-nav fund-id) ERR-FUND-NOT-ACTIVE))
    (withdrawal-value (/ (* shares current-nav) (get total-supply fund-info)))
  )
    (asserts! (get active fund-info) ERR-FUND-NOT-ACTIVE)
    (asserts! (>= (get shares user-position) shares) ERR-INSUFFICIENT-BALANCE)
    (asserts! (> shares u0) ERR-INVALID-AMOUNT)
    
    ;; Update user position
    (map-set user-positions { fund-id: fund-id, user: tx-sender }
      (merge user-position {
        shares: (- (get shares user-position) shares)
      })
    )
    
    ;; Update fund info
    (map-set funds fund-id
      (merge fund-info {
        total-supply: (- (get total-supply fund-info) shares),
        total-value: (- (get total-value fund-info) withdrawal-value)
      })
    )
    
    ;; Transfer proportional STX back to user
    (try! (as-contract (stx-transfer? withdrawal-value tx-sender tx-sender)))
    
    (ok withdrawal-value)
  )
)

;; Rebalance fund to target weights
(define-public (rebalance-fund (fund-id uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) ERR-NOT-FOUND))
  )
    (asserts! (get active fund-info) ERR-FUND-NOT-ACTIVE)
    (asserts! (or (is-eq tx-sender (get manager fund-info))
                  (is-eq tx-sender CONTRACT-OWNER)) ERR-UNAUTHORIZED)
    (asserts! (is-rebalance-required fund-id) ERR-REBALANCE-NOT-NEEDED)
    
    ;; Update last rebalance timestamp
    (map-set funds fund-id
      (merge fund-info { last-rebalance: stacks-block-height })
    )
    
    ;; In a full implementation, this would:
    ;; 1. Calculate current asset values
    ;; 2. Determine required trades to reach target weights
    ;; 3. Execute trades through DEX integrations
    ;; 4. Update asset balances and weights
    
    (ok true)
  )
)

;; Update asset price (would typically be called by oracle)
(define-public (update-asset-price (fund-id uint) (asset-id uint) (new-price uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) ERR-NOT-FOUND))
    (asset-info (unwrap! (get-fund-asset fund-id asset-id) ERR-NOT-FOUND))
  )
    (asserts! (or (is-eq tx-sender (get manager fund-info))
                  (is-eq tx-sender CONTRACT-OWNER)) ERR-UNAUTHORIZED)
    
    (map-set fund-assets { fund-id: fund-id, asset-id: asset-id }
      (merge asset-info { last-price: new-price })
    )
    
    ;; Recalculate fund value
    (update-fund-value fund-id (calculate-total-fund-value fund-id))
    (ok true)
  )
)

;; Emergency pause fund
(define-public (pause-fund (fund-id uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) ERR-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    
    (map-set funds fund-id
      (merge fund-info { active: false })
    )
    
    (ok true)
  )
)

;; Reactivate fund
(define-public (reactivate-fund (fund-id uint))
  (let (
    (fund-info (unwrap! (get-fund fund-id) ERR-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    
    (map-set funds fund-id
      (merge fund-info { active: true })
    )
    
    (ok true)
  )
)

;; Update protocol settings
(define-public (update-protocol-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (<= new-fee u1000) ERR-INVALID-AMOUNT) ;; Max 10%
    
    (var-set protocol-fee-rate new-fee)
    (ok true)
  )
)

(define-public (update-rebalance-threshold (new-threshold uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (asserts! (<= new-threshold u2000) ERR-INVALID-AMOUNT) ;; Max 20%
    
    (var-set rebalance-threshold new-threshold)
    (ok true)
  )
)