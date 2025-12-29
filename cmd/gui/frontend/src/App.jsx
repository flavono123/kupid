import { useState, useEffect } from 'react';
import { ContextGallery } from './components/ContextGallery';
import { MainView } from './components/MainView';
import { ColorPalette } from './components/debug/ColorPalette';
import { AboutModal } from './components/AboutModal';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from 'next-themes';

function App() {
    const [showColors, setShowColors] = useState(false);
    const [showMainView, setShowMainView] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [selectedContexts, setSelectedContexts] = useState([]);
    const [connectedContexts, setConnectedContexts] = useState([]);

    useEffect(() => {
        // ============================================================================
        // 🚧 DEV-ONLY DEBUGGING FEATURES
        // ============================================================================
        // - Color Palette Viewer (Cmd+P / Ctrl+P)
        // - Theme Toggle (Cmd+T / Ctrl+T)
        // These features are ONLY available in development mode and will NOT be
        // included in production builds.
        // ============================================================================

        // Initialize with default state if none exists
        if (!window.history.state) {
            window.history.replaceState({ view: 'gallery' }, '', '');
        }

        // Global keyboard shortcut: Cmd+P / Ctrl+P to toggle color palette (DEV only)
        const handleGlobalKeydown = (e) => {
            if (import.meta.env.DEV && (e.metaKey || e.ctrlKey) && e.key === 'p') {
                e.preventDefault();
                if (showColors) {
                    // Close color palette (go back)
                    window.history.back();
                } else {
                    // Open color palette
                    setShowColors(true);
                    window.history.pushState({ view: 'colors' }, '', '');
                }
            }

            // Theme toggle: Cmd+T / Ctrl+T (DEV only)
            if (import.meta.env.DEV && (e.metaKey || e.ctrlKey) && e.key === 't') {
                e.preventDefault();
                const currentTheme = localStorage.getItem('theme') || 'system';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                localStorage.setItem('theme', newTheme);
                document.documentElement.classList.remove('light', 'dark');
                document.documentElement.classList.add(newTheme);
            }

            // Navigation shortcuts: Cmd+[ (back) and Cmd+] (forward)
            if ((e.metaKey || e.ctrlKey) && e.key === '[') {
                e.preventDefault();
                window.history.back();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === ']') {
                e.preventDefault();
                window.history.forward();
            }
        };

        window.addEventListener('keydown', handleGlobalKeydown);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeydown);
        };
    }, [showColors]);

    // Handle browser back/forward navigation
    useEffect(() => {
        const handlePopState = (event) => {
            const state = event.state || { view: 'gallery' };

            if (state.view === 'colors') {
                // Show color palette
                setShowColors(true);
                setShowMainView(false);
            } else if (state.view === 'main') {
                // Show main view
                setShowColors(false);
                setShowMainView(true);
                // Restore context data if available
                if (state.selectedContexts) {
                    setSelectedContexts(state.selectedContexts);
                }
                if (state.connectedContexts) {
                    setConnectedContexts(state.connectedContexts);
                }
            } else {
                // Back to context gallery
                setShowColors(false);
                setShowMainView(false);
                setSelectedContexts([]);
                setConnectedContexts([]);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleContextsConnected = (selected, connected) => {
        setSelectedContexts(selected);
        setConnectedContexts(connected);
        setShowMainView(true);
        // Push history state with context data for navigation
        window.history.pushState({
            view: 'main',
            selectedContexts: selected,
            connectedContexts: connected
        }, '', '');
    };

    const handleBack = () => {
        // For history navigation (cmd+[ etc)
        window.history.back();
    };

    const handleBackToContextsGallery = () => {
        // Direct navigation to contexts gallery (not using history)
        setShowColors(false);
        setShowMainView(false);
        setSelectedContexts([]);
        setConnectedContexts([]);
        // Replace current state with gallery state
        window.history.replaceState({ view: 'gallery' }, '', '');
    };

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {showColors ? (
                <ColorPalette onBack={handleBack} />
            ) : showMainView ? (
                <MainView
                    selectedContexts={selectedContexts}
                    connectedContexts={connectedContexts}
                    onBackToContexts={handleBackToContextsGallery}
                />
            ) : (
                <ContextGallery
                    onContextsConnected={handleContextsConnected}
                    onLogoClick={() => setShowAbout(true)}
                />
            )}
            <AboutModal open={showAbout} onOpenChange={setShowAbout} />
            <Toaster position="top-right" />
        </ThemeProvider>
    );
}

export default App
