import { useNavigate } from 'react-router-dom';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import './HomeScreen.css';

function HomeScreen() {
    const navigate = useNavigate();
    const { isConnected, address } = useAccount();
    const { connect } = useConnect();

    const handleConnect = () => {
        if (isConnected) {
            navigate('/creatures');
        } else {
            connect({ connector: injected() });
        }
    };

    return (
        <div className="home-screen">
            {/* Hero Section with animated background */}
            <div className="hero-section">
                <div className="hero-particles"></div>
                <div className="hero-glow"></div>

                <div className="hero-content">
                    <div className="dragon-emblem">🐉</div>
                    <h1 className="game-title">
                        <span className="title-line">Dragon</span>
                        <span className="title-line accent">Supremacy</span>
                    </h1>
                    <p className="game-tagline">
                        The eternal battle for elemental dominance begins
                    </p>
                </div>
            </div>

            {/* Lore Section */}
            <section className="lore-section">
                <div className="lore-container">
                    <div className="lore-header">
                        <span className="lore-icon">📜</span>
                        <h2>The Legend</h2>
                    </div>

                    <div className="lore-content">
                        <p className="lore-paragraph">
                            In the age before time, eight primordial dragons emerged from the cosmic void,
                            each wielding mastery over a fundamental element: <span className="element fire">Fire</span>,
                            <span className="element water">Water</span>, <span className="element grass">Grass</span>,
                            <span className="element electric">Electric</span>, <span className="element ice">Ice</span>,
                            <span className="element earth">Earth</span>, <span className="element dark">Dark</span>,
                            and <span className="element light">Light</span>.
                        </p>

                        <p className="lore-paragraph">
                            For millennia, these ancient beings battled in an endless war for supremacy,
                            their clashes shaping mountains and carving oceans. The world itself became
                            the arena of their eternal struggle.
                        </p>

                        <p className="lore-paragraph highlight">
                            Now, their descendants await a new master. Champions who can harness the
                            power of these legendary creatures and lead them to victory in the
                            ultimate battle for elemental dominance.
                        </p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon-wrapper fire">
                            <span>⚔️</span>
                        </div>
                        <h3>Strategic Combat</h3>
                        <p>Master the elemental weaknesses and strengths in turn-based battles</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper water">
                            <span>🧬</span>
                        </div>
                        <h3>Unique Creatures</h3>
                        <p>Each dragon has distinct stats, personality, and temperament</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper electric">
                            <span>🔗</span>
                        </div>
                        <h3>True Ownership</h3>
                        <p>Your creatures are NFTs on the blockchain, truly yours forever</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper dark">
                            <span>🏆</span>
                        </div>
                        <h3>Earn Glory</h3>
                        <p>Battle other trainers and climb the ranks of supremacy</p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="cta-content">
                    <h2 className="cta-title">Begin Your Journey</h2>
                    <p className="cta-subtitle">
                        {isConnected
                            ? `Welcome back, Champion. Your dragons await.`
                            : 'Connect your wallet to claim your destiny'
                        }
                    </p>

                    <button
                        className="cta-button"
                        onClick={handleConnect}
                    >
                        {isConnected ? (
                            <>
                                <span className="btn-icon">🐉</span>
                                <span>View My Dragons</span>
                            </>
                        ) : (
                            <>
                                <span className="btn-icon">🔗</span>
                                <span>Connect Wallet</span>
                            </>
                        )}
                    </button>

                    {isConnected && (
                        <p className="wallet-info">
                            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                    )}
                </div>

                {/* Decorative elements */}
                <div className="cta-dragon left">🐲</div>
                <div className="cta-dragon right">🐲</div>
            </section>

            {/* Footer */}
            <footer className="home-footer">
                <p>Dragon Supremacy on Base</p>
            </footer>
        </div>
    );
}

export default HomeScreen;
