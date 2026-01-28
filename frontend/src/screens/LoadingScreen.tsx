import './LoadingScreen.css';

interface LoadingScreenProps {
    message?: string;
}

function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <div className="loading-logo">⚔️</div>
                <h1 className="loading-title">NFT Autobattler</h1>
                <div className="loading-spinner"></div>
                <p className="loading-message">{message}</p>
            </div>
        </div>
    );
}

export default LoadingScreen;
