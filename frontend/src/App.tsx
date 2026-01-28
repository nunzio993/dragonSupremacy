import { Routes, Route, Navigate } from 'react-router-dom';
import { useWallet } from './contexts/WalletContext';
import { TurnBattleProvider } from './contexts/TurnBattleContext';
import { EconomyProvider } from './contexts/EconomyContext';
import Navbar from './components/Navbar';
import HomeScreen from './screens/HomeScreen';
import RosterScreen from './screens/RosterScreen';
import PreMatchScreen from './screens/PreMatchScreen';
import MatchScreen from './screens/MatchScreen';
import HistoryScreen from './screens/HistoryScreen';
import TurnBattleScreen from './screens/TurnBattleScreen';
import ShopScreen from './screens/ShopScreen';
import FusionScreen from './screens/FusionScreen';
import LoadingScreen from './screens/LoadingScreen';
import { LobbyScreen } from './screens/Lobby/Lobby';
import { RoomScreen } from './screens/Room/Room';
import MintScreen from './screens/MintScreen';
import MyCreaturesScreen from './screens/MyCreaturesScreen';
import GuideScreen from './screens/GuideScreen';
import StakingScreen from './screens/StakingScreen';
import AdminScreen from './screens/AdminScreen';
import ConnectWalletScreen from './screens/ConnectWalletScreen';

function App() {
    const { isConnected, isConnecting, isCorrectChain } = useWallet();

    // Show loading while connecting
    if (isConnecting) {
        return <LoadingScreen message="Connecting wallet..." />;
    }

    // Show connect wallet screen if not connected or wrong chain
    if (!isConnected || !isCorrectChain) {
        return <ConnectWalletScreen />;
    }

    return (
        <EconomyProvider>
            <TurnBattleProvider>
                <div className="app">
                    <Navbar />
                    <Routes>
                        <Route path="/" element={<HomeScreen />} />
                        <Route path="/roster" element={<RosterScreen />} />
                        <Route path="/pre-match" element={<PreMatchScreen />} />
                        <Route path="/match" element={<MatchScreen />} />
                        <Route path="/turn-battle" element={<TurnBattleScreen />} />
                        <Route path="/shop" element={<ShopScreen />} />
                        <Route path="/fusion" element={<FusionScreen />} />
                        <Route path="/history" element={<HistoryScreen />} />
                        <Route path="/mint" element={<MintScreen />} />
                        <Route path="/creatures" element={<MyCreaturesScreen />} />
                        <Route path="/guide" element={<GuideScreen />} />
                        <Route path="/staking" element={<StakingScreen />} />
                        <Route path="/admin" element={<AdminScreen />} />
                        {/* Multiplayer PvP Routes */}
                        <Route path="/lobby" element={<LobbyScreen />} />
                        <Route path="/room/:roomId" element={<RoomScreen />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </TurnBattleProvider>
        </EconomyProvider>
    );
}

export default App;

