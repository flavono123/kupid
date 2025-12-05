import { ContextGallery } from './components/ContextGallery';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from 'next-themes';

function App() {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ContextGallery />
            <Toaster position="top-right" />
        </ThemeProvider>
    );
}

export default App
