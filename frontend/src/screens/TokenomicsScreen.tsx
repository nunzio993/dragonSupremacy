import './TokenomicsScreen.css';

function TokenomicsScreen() {
    return (
        <div className="tokenomics-screen">
            <div className="tokenomics-container">
                {/* Header */}
                <header className="tokenomics-header">
                    <h1><span className="header-icon">📊</span> <span className="header-text">Tokenomics / Game Economy</span></h1>
                    <p className="tokenomics-subtitle">
                        Structure and mechanics of the DGNE in-game credit
                    </p>
                </header>

                {/* Section 1: What is DGNE */}
                <section className="tokenomics-section">
                    <h2>1. What is DGNE</h2>
                    <p className="section-intro">
                        DGNE (Dragon Essence) is an in-game digital credit used exclusively within Dragon Supremacy.
                        It serves as the internal resource to access game features.
                    </p>

                    <div className="usage-grid">
                        <div className="usage-card">
                            <span className="usage-icon">🎮</span>
                            <h3>Gameplay Access</h3>
                            <p>Required to participate in matches and access game features</p>
                        </div>
                        <div className="usage-card">
                            <span className="usage-icon">🥚</span>
                            <h3>Dragon Minting</h3>
                            <p>Used to generate new dragon NFTs</p>
                        </div>
                        <div className="usage-card">
                            <span className="usage-icon">⚔️</span>
                            <h3>Battles</h3>
                            <p>Entry fee for PvP battles</p>
                        </div>
                        <div className="usage-card">
                            <span className="usage-icon">♻️</span>
                            <h3>Internal Economy</h3>
                            <p>Powers the entire game economic cycle</p>
                        </div>
                    </div>
                </section>

                {/* Section 2: DGNE Usage */}
                <section className="tokenomics-section">
                    <h2>2. DGNE Usage in Game</h2>
                    <p className="section-intro">
                        DGNE is used across various game mechanics:
                    </p>

                    <div className="feature-list">
                        <div className="feature-item">
                            <span className="feature-bullet">●</span>
                            <strong>Dragon mint:</strong> Fixed cost to generate a new dragon NFT
                        </div>
                        <div className="feature-item">
                            <span className="feature-bullet">●</span>
                            <strong>Battle fee:</strong> Cost to participate in PvP battles
                        </div>
                        <div className="feature-item">
                            <span className="feature-bullet">●</span>
                            <strong>Victory rewards:</strong> DGNE redistributed to battle winners
                        </div>
                        <div className="feature-item">
                            <span className="feature-bullet">●</span>
                            <strong>Dragon staking:</strong> Passive DGNE generation by staking dragons
                        </div>
                    </div>
                </section>

                {/* Section 3: Dragon Minting */}
                <section className="tokenomics-section">
                    <h2>3. Dragon Minting</h2>

                    <div className="highlight-box">
                        <div className="highlight-number">5,000</div>
                        <div className="highlight-label">DGNE per Mint</div>
                    </div>

                    <div className="info-cards">
                        <div className="info-card">
                            <span className="info-icon">🚫</span>
                            <p>No free base dragons: every dragon is born from a real DGNE cost</p>
                        </div>
                        <div className="info-card">
                            <span className="info-icon">📉</span>
                            <p>Minting is the primary mechanism to control NFT supply</p>
                        </div>
                        <div className="info-card">
                            <span className="info-icon">🔒</span>
                            <p>Total DGNE supply is fixed: 100,000,000 DGNE</p>
                        </div>
                    </div>
                </section>

                {/* Section 4: Initial Airdrop */}
                <section className="tokenomics-section">
                    <h2>4. Initial Airdrop (Locked)</h2>

                    <div className="highlight-box secondary">
                        <div className="highlight-number">5,100</div>
                        <div className="highlight-label">DGNE per User</div>
                    </div>

                    <div className="token-status">
                        <div className="status-badge locked">🔒 Locked</div>
                        <div className="status-badge locked">📵 Non-transferable</div>
                        <div className="status-badge active">🎮 Spendable only in-game</div>
                    </div>

                    <h3 className="subsection-title">Flow at Mint</h3>
                    <div className="flow-diagram">
                        <div className="flow-step">
                            <div className="flow-amount">3,500 DGNE</div>
                            <div className="flow-arrow">→</div>
                            <div className="flow-destination">
                                <strong>Airdrop Pool</strong>
                                <span>To fund new player access</span>
                            </div>
                        </div>
                        <div className="flow-step">
                            <div className="flow-amount">1,500 DGNE</div>
                            <div className="flow-arrow">→</div>
                            <div className="flow-destination">
                                <strong>Win Boost Pool</strong>
                                <span>To increase winnings</span>
                            </div>
                        </div>
                        <div className="flow-step">
                            <div className="flow-amount">100 DGNE</div>
                            <div className="flow-arrow">→</div>
                            <div className="flow-destination">
                                <strong>Player</strong>
                                <span>For initial battles</span>
                            </div>
                        </div>
                    </div>

                    <p className="note-text">
                        The airdrop is recyclable and enables progressive onboarding of new players.
                    </p>
                </section>

                {/* Section 5: Winnings and Win Boost */}
                <section className="tokenomics-section">
                    <h2>5. Winnings and Win Boost</h2>

                    <div className="mechanics-grid">
                        <div className="mechanic-card">
                            <span className="mechanic-icon">⚔️</span>
                            <h3>Redistribution</h3>
                            <p>Battles redistribute DGNE among players based on results</p>
                        </div>
                        <div className="mechanic-card">
                            <span className="mechanic-icon">🚀</span>
                            <h3>Win Boost Pool</h3>
                            <p>Temporarily increases winnings when available</p>
                        </div>
                        <div className="mechanic-card">
                            <span className="mechanic-icon">📊</span>
                            <h3>Pool Depletion</h3>
                            <p>When the pool is depleted, winnings return to standard</p>
                        </div>
                        <div className="mechanic-card">
                            <span className="mechanic-icon">♾️</span>
                            <h3>Continuity</h3>
                            <p>The game continues without interruption in any scenario</p>
                        </div>
                    </div>
                </section>

                {/* Section 6: Dragon Staking */}
                <section className="tokenomics-section">
                    <h2>6. Dragon Staking</h2>

                    <div className="staking-stats">
                        <div className="staking-stat">
                            <div className="stat-value">20,000,000</div>
                            <div className="stat-label">DGNE Total Allocation</div>
                        </div>
                        <div className="staking-stat">
                            <div className="stat-value">2,000,000</div>
                            <div className="stat-label">DGNE / Year (Max)</div>
                        </div>
                    </div>

                    <p className="section-intro">
                        Distribution is proportional among all dragons currently staked.
                    </p>

                    <div className="warning-box neutral">
                        <span className="warning-icon">⚠️</span>
                        <div className="warning-content">
                            <strong>Staked dragons:</strong>
                            <ul>
                                <li>Cannot battle</li>
                                <li>Cannot be transferred</li>
                            </ul>
                        </div>
                    </div>

                    <h3 className="subsection-title">Factors affecting generation:</h3>
                    <div className="factor-list">
                        <div className="factor-item">
                            <span className="factor-icon">📊</span>
                            <span>Total number of staked dragons</span>
                        </div>
                        <div className="factor-item">
                            <span className="factor-icon">🌟</span>
                            <span>Individual dragon talent (talent multiplier)</span>
                        </div>
                    </div>

                    <div className="formula-box">
                        <strong>Formula:</strong> Rate = Base Rate × (1 + Talent / 100)
                    </div>
                </section>

                {/* Section 7: Frontend Transparency */}
                <section className="tokenomics-section">
                    <h2>7. User-Side Transparency</h2>
                    <p className="section-intro">
                        The frontend displays the following information in real-time:
                    </p>

                    <div className="transparency-grid">
                        <div className="transparency-item">
                            <span className="transparency-icon">🐉</span>
                            <span>Total staked dragons</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">📈</span>
                            <span>DGNE emitted per day</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">💎</span>
                            <span>DGNE/day per dragon</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">⭐</span>
                            <span>Talent multiplier</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">📅</span>
                            <span>Estimated daily earnings</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">📆</span>
                            <span>Estimated monthly earnings</span>
                        </div>
                    </div>
                </section>

                {/* Section 8: Treasury and Reserve */}
                <section className="tokenomics-section">
                    <h2>8. Treasury and Technical Reserve</h2>

                    <div className="treasury-grid">
                        <div className="treasury-card">
                            <div className="treasury-amount">30,000,000</div>
                            <div className="treasury-label">Operational Treasury</div>
                            <p>Operational project management</p>
                        </div>
                        <div className="treasury-card reserve">
                            <div className="treasury-amount">5,000,000</div>
                            <div className="treasury-label">Technical Reserve</div>
                            <p>Separate from operational treasury</p>
                        </div>
                    </div>

                    <h3 className="subsection-title">Technical Reserve Usage (exclusive):</h3>
                    <div className="reserve-uses">
                        <div className="reserve-item">
                            <span>🐛</span>
                            <span>Critical bugs</span>
                        </div>
                        <div className="reserve-item">
                            <span>🔓</span>
                            <span>Exploits</span>
                        </div>
                        <div className="reserve-item">
                            <span>🚨</span>
                            <span>System emergencies</span>
                        </div>
                        <div className="reserve-item">
                            <span>🔄</span>
                            <span>Future migrations</span>
                        </div>
                    </div>

                    <div className="warning-box danger">
                        <span className="warning-icon">⛔</span>
                        <p>The technical reserve is NEVER used for gameplay or rewards.</p>
                    </div>
                </section>

                {/* Section 9: Total Allocation */}
                <section className="tokenomics-section">
                    <h2>9. Total Allocation</h2>
                    <p className="section-intro">
                        Fixed total supply: <strong>100,000,000 DGNE</strong>
                    </p>

                    <div className="allocation-table">
                        <div className="allocation-row">
                            <span className="allocation-amount">20,000,000</span>
                            <span className="allocation-label">Recyclable Airdrop</span>
                            <span className="allocation-percent">20%</span>
                        </div>
                        <div className="allocation-row">
                            <span className="allocation-amount">15,000,000</span>
                            <span className="allocation-label">Team (vesting)</span>
                            <span className="allocation-percent">15%</span>
                        </div>
                        <div className="allocation-row">
                            <span className="allocation-amount">30,000,000</span>
                            <span className="allocation-label">Operational Treasury</span>
                            <span className="allocation-percent">30%</span>
                        </div>
                        <div className="allocation-row">
                            <span className="allocation-amount">10,000,000</span>
                            <span className="allocation-label">Partner / Ecosystem</span>
                            <span className="allocation-percent">10%</span>
                        </div>
                        <div className="allocation-row">
                            <span className="allocation-amount">20,000,000</span>
                            <span className="allocation-label">Controlled Staking</span>
                            <span className="allocation-percent">20%</span>
                        </div>
                        <div className="allocation-row">
                            <span className="allocation-amount">5,000,000</span>
                            <span className="allocation-label">Technical Reserve</span>
                            <span className="allocation-percent">5%</span>
                        </div>
                    </div>
                </section>

                {/* Section 10: Disclaimer */}
                <section className="tokenomics-section disclaimer-section">
                    <h2>10. Disclaimer</h2>
                    <div className="disclaimer-box">
                        <p>
                            <strong>DGNE is a digital credit used exclusively within the game.</strong>
                        </p>
                        <p>
                            It does not represent an investment, does not confer financial rights, and does not guarantee any economic return.
                        </p>
                    </div>
                </section>

                {/* Bottom Notice - What DGNE is NOT */}
                <footer className="tokenomics-footer">
                    <p className="footer-notice">
                        <strong>What DGNE is NOT:</strong> DGNE is not a governance token. It does not confer financial rights of any kind. It does not represent a corporate or participatory share.
                    </p>
                </footer>
            </div>
        </div>
    );
}

export default TokenomicsScreen;
