import './GuideScreen.css';

function GuideScreen() {
    return (
        <div className="guide-screen">
            <div className="guide-container">
                {/* Header */}
                <header className="guide-header">
                    <h1><span className="header-icon">📖</span> <span className="header-text">Dragon Guide</span></h1>
                    <p className="guide-subtitle">
                        Master the secrets of elemental combat and raise the ultimate champion
                    </p>
                </header>

                {/* Stats Section */}
                <section className="guide-section">
                    <h2>⚔️ Dragon Attributes</h2>
                    <p className="section-intro">
                        Every dragon possesses 9 core attributes that determine their combat capabilities.
                        Stats range from 30-80 at birth and evolve based on level and age.
                    </p>

                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">💪</span>
                                <span className="stat-name">Strength</span>
                            </div>
                            <span className="stat-abbr">STR</span>
                            <p>Physical attack power. Higher Strength means more damage with physical moves.</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">🏃</span>
                                <span className="stat-name">Agility</span>
                            </div>
                            <span className="stat-abbr">AGI</span>
                            <p>Special attack power and dodge bonus. Essential for magic-based dragons.</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">⚡</span>
                                <span className="stat-name">Speed</span>
                            </div>
                            <span className="stat-abbr">SPD</span>
                            <p>Movement and reaction speed. Affects dodge chance and certain battle mechanics.</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">🎯</span>
                                <span className="stat-name">Reflex</span>
                            </div>
                            <span className="stat-abbr">REF</span>
                            <p>Evasion and critical hit chance. Nimble dragons are hard to hit.</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">🛡️</span>
                                <span className="stat-name">Endurance</span>
                            </div>
                            <span className="stat-abbr">END</span>
                            <p>Physical and special defense. Reduces incoming damage.</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">❤️</span>
                                <span className="stat-name">Vitality</span>
                            </div>
                            <span className="stat-abbr">VIT</span>
                            <p>Maximum HP pool. More Vitality means surviving longer in combat.</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">🧠</span>
                                <span className="stat-name">Intelligence</span>
                            </div>
                            <span className="stat-abbr">INT</span>
                            <p>Dodge bonus that grows forever with age. Ancient dragons are cunning.</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">🔍</span>
                                <span className="stat-name">Precision</span>
                            </div>
                            <span className="stat-abbr">PRC</span>
                            <p>Accuracy bonus. Higher Precision means fewer missed attacks.</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-header">
                                <span className="stat-icon">✨</span>
                                <span className="stat-name">Regeneration</span>
                            </div>
                            <span className="stat-abbr">RGN</span>
                            <p>HP recovered each turn. Sustain through prolonged battles.</p>
                        </div>
                    </div>
                </section>

                {/* Growth Section */}
                <section className="guide-section">
                    <h2>📈 Growth & Evolution</h2>

                    <div className="growth-info">
                        <div className="growth-card">
                            <h3>🌟 Talent</h3>
                            <p>
                                Talent represents your dragon's innate potential, determined at birth.
                                Dragons with higher talent have better base stats and grow stronger over time.
                            </p>
                            <ul>
                                <li><strong>Low Talent:</strong> Modest potential, slower development</li>
                                <li><strong>Average Talent:</strong> Balanced growth across the board</li>
                                <li><strong>High Talent:</strong> Exceptional potential, faster stat gains</li>
                                <li><strong>Legendary Talent:</strong> Extremely rare, outstanding in all aspects</li>
                            </ul>
                        </div>

                        <div className="growth-card">
                            <h3>📊 Level Progression</h3>
                            <p>
                                Dragons gain experience from battles and gradually level up over time.
                                Higher levels grant stronger stats, though the rate of improvement varies.
                            </p>
                            <ul>
                                <li><strong>Early Levels:</strong> Rapid growth as the dragon develops</li>
                                <li><strong>Mid Levels:</strong> Dragons reach their physical peak</li>
                                <li><strong>High Levels:</strong> Growth slows as the body matures</li>
                            </ul>
                        </div>

                        <div className="growth-card">
                            <h3>⏰ Age & Maturity</h3>
                            <p>
                                Dragons age over time, passing through different life stages that affect their abilities.
                            </p>
                            <ul>
                                <li><strong>Youth:</strong> Growing phase - stats gradually improve as the dragon matures</li>
                                <li><strong>Prime:</strong> Peak performance - optimal stat multipliers</li>
                                <li><strong>Elder:</strong> Wisdom phase - physical stats may decline slightly, but INT continues to grow</li>
                                <li><strong>Ancient:</strong> Legendary beings with unmatched cunning</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Personality & Temperament */}
                <section className="guide-section">
                    <h2>🎭 Personality & Temperament</h2>

                    <div className="traits-grid">
                        <div className="trait-section">
                            <h3>Personality</h3>
                            <p>Permanently modifies base stats (+10% / -10%):</p>
                            <div className="trait-list">
                                <div className="trait-item"><span>BRAVE</span> Strength↑ Speed↓</div>
                                <div className="trait-item"><span>CALM</span> Intelligence↑ Strength↓</div>
                                <div className="trait-item"><span>BOLD</span> Endurance↑ Reflex↓</div>
                                <div className="trait-item"><span>TIMID</span> Speed↑ Strength↓</div>
                                <div className="trait-item"><span>MODEST</span> Agility↑ Strength↓</div>
                                <div className="trait-item"><span>ADAMANT</span> Strength↑ Agility↓</div>
                                <div className="trait-item"><span>IMPISH</span> Endurance↑ Agility↓</div>
                                <div className="trait-item"><span>JOLLY</span> Speed↑ Agility↓</div>
                                <div className="trait-item"><span>NAIVE</span> Speed↑ Endurance↓</div>
                                <div className="trait-item"><span>CAREFUL</span> Endurance↑ Intelligence↓</div>
                                <div className="trait-item"><span>NEUTRAL</span> No modification</div>
                            </div>
                        </div>

                        <div className="trait-section">
                            <h3>Temperament</h3>
                            <p>Affects battle accuracy and critical chance:</p>
                            <div className="trait-list">
                                <div className="trait-item good"><span>CALM</span> +8% Accuracy, -1% Crit, 1% miss floor</div>
                                <div className="trait-item good"><span>FOCUSED</span> +5% Accuracy, -0.5% Crit, 2% miss floor</div>
                                <div className="trait-item neutral"><span>NEUTRAL</span> No modifier, 2% miss floor</div>
                                <div className="trait-item risky"><span>NERVOUS</span> -6% Accuracy, +3% Crit, 4% miss floor</div>
                                <div className="trait-item risky"><span>RECKLESS</span> -8% Accuracy, +3% Crit, 5% miss floor</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Elements Section */}
                <section className="guide-section">
                    <h2>🔥 Elements</h2>
                    <p className="section-intro">
                        Each dragon belongs to one of 8 elemental types, determining their moves and type matchups.
                    </p>

                    <div className="elements-grid">
                        <div className="element-card fire">
                            <span className="element-emoji">🔥</span>
                            <span className="element-name">Fire</span>
                            <span className="element-desc">Strong vs Grass, Ice • Weak vs Water, Earth</span>
                        </div>
                        <div className="element-card water">
                            <span className="element-emoji">💧</span>
                            <span className="element-name">Water</span>
                            <span className="element-desc">Strong vs Fire, Earth • Weak vs Grass, Electric</span>
                        </div>
                        <div className="element-card grass">
                            <span className="element-emoji">🌿</span>
                            <span className="element-name">Grass</span>
                            <span className="element-desc">Strong vs Water, Earth • Weak vs Fire, Ice</span>
                        </div>
                        <div className="element-card electric">
                            <span className="element-emoji">⚡</span>
                            <span className="element-name">Electric</span>
                            <span className="element-desc">Strong vs Water • Weak vs Earth</span>
                        </div>
                        <div className="element-card ice">
                            <span className="element-emoji">❄️</span>
                            <span className="element-name">Ice</span>
                            <span className="element-desc">Strong vs Grass, Earth • Weak vs Fire</span>
                        </div>
                        <div className="element-card earth">
                            <span className="element-emoji">🪨</span>
                            <span className="element-name">Earth</span>
                            <span className="element-desc">Strong vs Fire, Electric • Weak vs Water, Grass, Ice</span>
                        </div>
                        <div className="element-card dark">
                            <span className="element-emoji">🌑</span>
                            <span className="element-name">Dark</span>
                            <span className="element-desc">Strong vs Light • Weak vs Light</span>
                        </div>
                        <div className="element-card light">
                            <span className="element-emoji">✨</span>
                            <span className="element-name">Light</span>
                            <span className="element-desc">Strong vs Dark • Weak vs Dark</span>
                        </div>
                    </div>
                </section>

                {/* Moves Section */}
                <section className="guide-section">
                    <h2>💥 Moves</h2>
                    <p className="section-intro">
                        Each dragon knows 2 to 4 innate moves based on their element. Moves have power, accuracy, and may inflict status effects.
                    </p>

                    <div className="moves-info">
                        <div className="move-category">
                            <h3>⚔️ Physical Moves</h3>
                            <p>Damage scales with STR. Direct, reliable attacks.</p>
                        </div>
                        <div className="move-category">
                            <h3>✨ Special Moves</h3>
                            <p>Damage scales with AGI. Often have bonus effects.</p>
                        </div>
                        <div className="move-category">
                            <h3>🔮 Status Moves</h3>
                            <p>Inflict conditions: Burn, Freeze, Poison, Paralyze, Stun, etc.</p>
                        </div>
                    </div>

                    <div className="status-effects">
                        <h3>Status Effects</h3>
                        <div className="effects-grid">
                            <div className="effect">🔥 <strong>Burn</strong> -10% HP/turn</div>
                            <div className="effect">❄️ <strong>Freeze</strong> Skip turn, 30% linger</div>
                            <div className="effect">☠️ <strong>Poison</strong> -8% HP/turn</div>
                            <div className="effect">⚡ <strong>Paralyze</strong> 25% skip, -30% SPD</div>
                            <div className="effect">💫 <strong>Stun</strong> Skip next turn</div>
                            <div className="effect">👁️ <strong>Blind</strong> -30% accuracy</div>
                            <div className="effect">😱 <strong>Fear</strong> May skip turn</div>
                            <div className="effect">🐌 <strong>Slow</strong> -40% SPD</div>
                            <div className="effect">💀 <strong>Drain</strong> Heals attacker</div>
                        </div>
                    </div>
                </section>

                {/* Aptitudes Section */}
                <section className="guide-section">
                    <h2>🎖️ Aptitudes</h2>
                    <p className="section-intro">
                        Each dragon has hidden aptitudes (90-110%) against each element type.
                        Aptitudes modify damage dealt to dragons of that type.
                    </p>
                    <p>
                        A dragon with 110% Fire aptitude deals 10% more damage to Fire dragons,
                        while 90% means 10% less damage. These are determined at birth from the seed.
                    </p>
                </section>

                {/* Staking Section */}
                <section className="guide-section">
                    <h2>💰 Dragon Staking</h2>
                    <p className="section-intro">
                        Put your dragons to work! Stake them to generate Dragon Essence (DGNE) tokens passively.
                    </p>

                    <div className="tips-list">
                        <div className="tip">
                            <span className="tip-number">💎</span>
                            <p><strong>How it works:</strong> When you stake a dragon, it's transferred to the staking contract and starts generating DGNE over time.</p>
                        </div>
                        <div className="tip">
                            <span className="tip-number">📈</span>
                            <p><strong>Talent matters:</strong> Higher talent dragons earn more DGNE. Rate = Base Rate × (1 + Talent/100)</p>
                        </div>
                        <div className="tip">
                            <span className="tip-number">🎁</span>
                            <p><strong>Claim anytime:</strong> You can claim your accumulated rewards without unstaking your dragon.</p>
                        </div>
                        <div className="tip">
                            <span className="tip-number">🔓</span>
                            <p><strong>No lock period:</strong> Unstake your dragon anytime to use it in battles. Pending rewards are automatically claimed.</p>
                        </div>
                        <div className="tip">
                            <span className="tip-number">⚡</span>
                            <p><strong>Use DGNE for:</strong> Minting new dragons, healing injured dragons, and entering battles.</p>
                        </div>
                    </div>
                </section>

                {/* Battle Tips */}
                <section className="guide-section">
                    <h2>💡 Battle Tips</h2>
                    <div className="tips-list">
                        <div className="tip">
                            <span className="tip-number">1</span>
                            <p>The weaker dragon attacks first! Overall power determines turn order - underdogs get a fighting chance.</p>
                        </div>
                        <div className="tip">
                            <span className="tip-number">2</span>
                            <p>Balance your team with different elements to cover type disadvantages.</p>
                        </div>
                        <div className="tip">
                            <span className="tip-number">3</span>
                            <p>High talent dragons are rare but worth the wait - they scale much better.</p>
                        </div>
                        <div className="tip">
                            <span className="tip-number">4</span>
                            <p>Keep dragons active! They gain XP from battles, and dormant dragons age slowly.</p>
                        </div>
                        <div className="tip">
                            <span className="tip-number">5</span>
                            <p>INT is king for elder dragons - it never decays and gives dodge bonus!</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default GuideScreen;
