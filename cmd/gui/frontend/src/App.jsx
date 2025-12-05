import { useState, useEffect } from 'react';
import { ContextGallery } from './components/ContextGallery';
import { ColorPalette } from './components/ColorPalette';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from 'next-themes';

function App() {
    const [showColors, setShowColors] = useState(false);

    useEffect(() => {
        // ============================================================================
        // 🚧 DEV-ONLY DEBUGGING FEATURE
        // ============================================================================
        // Color Palette Viewer (Cmd+P / Ctrl+P or #colors hash)
        // This feature is ONLY available in development mode and will NOT be
        // included in production builds. Used for inspecting shadcn/ui theme colors.
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
        };

        window.addEventListener('keydown', handleGlobalKeydown);

        return () => {
            window.removeEventListener('hashchange', checkHash);
            window.removeEventListener('keydown', handleGlobalKeydown);
        };
    }, []);

    const handleBackToGallery = () => {
        window.location.hash = '';
    };

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {showColors ? (
                <ColorPalette onBack={handleBackToGallery} />
            ) : (
                <ContextGallery />
            )}
            <Toaster position="top-right" />
        </ThemeProvider>
    );
}

export default App
