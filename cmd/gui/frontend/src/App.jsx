import { useState, useEffect } from 'react';
import { ContextGallery } from './components/ContextGallery';
import { MainView } from './components/MainView';
import { ColorPalette } from './components/debug/ColorPalette';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from 'next-themes';

function App() {
    const [showColors, setShowColors] = useState(false);
    const [showMainView, setShowMainView] = useState(false);
    const [selectedContexts, setSelectedContexts] = useState([]);
    const [connectedContexts, setConnectedContexts] = useState([]);

    useEffect(() => {
        // ============================================================================
        // 🚧 DEV-ONLY DEBUGGING FEATURES
        // ============================================================================
        // - Color Palette Viewer (Cmd+P / Ctrl+P or #colors hash)
        // - Theme Toggle (Cmd+T / Ctrl+T)
        // These features are ONLY available in development mode and will NOT be
        // included in production builds.
        // ============================================================================

        // Check URL hash on mount and hash change (DEV only)
        const checkHash = () => {
            setShowColors(import.meta.env.DEV && window.location.hash === '#colors');
        };

        checkHash();
        window.addEventListener('hashchange', checkHash);

        // Global keyboard shortcut: Cmd+P / Ctrl+P to toggle color palette (DEV only)
        const handleGlobalKeydown = (e) => {
            if (import.meta.env.DEV && (e.metaKey || e.ctrlKey) && e.key === 'p') {
                e.preventDefault();
                window.location.hash = window.location.hash === '#colors' ? '' : '#colors';
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
            window.removeEventListener('hashchange', checkHash);
            window.removeEventListener('keydown', handleGlobalKeydown);
        };
    }, []);

    // Handle browser back/forward navigation
    useEffect(() => {
        const handlePopState = (event) => {
            // Back to context gallery
            setShowMainView(false);
            setSelectedContexts([]);
            setConnectedContexts([]);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleContextsConnected = (selected, connected) => {
        setSelectedContexts(selected);
        setConnectedContexts(connected);
        setShowMainView(true);
        // Push history state for navigation
        window.history.pushState({ view: 'main' }, '', '');
    };

    const handleBackToGallery = () => {
        window.location.hash = '';
    };

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {showColors ? (
                <ColorPalette onBack={handleBackToGallery} />
            ) : showMainView ? (
                <MainView
                    selectedContexts={selectedContexts}
                    connectedContexts={connectedContexts}
                />
            ) : (
                <ContextGallery onContextsConnected={handleContextsConnected} />
            )}
            <Toaster position="top-right" />
        </ThemeProvider>
    );
}

export default App
