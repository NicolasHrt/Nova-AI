import './globals.css';

export const metadata = {
    title: 'Nova AI',
    description: 'Ton assistant intelligent',
    icons: {
        icon: '/favicon.svg',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="fr">
            <body>{children}</body>
        </html>
    );
}
