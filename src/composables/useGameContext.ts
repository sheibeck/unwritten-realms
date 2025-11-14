export function useGameContext() {
    function getLoadingMessage(): string {
        const messages: string[] = [
            'Arcane currents shift as your will takes form',
            'The aether hums as your intent ripples through the weave',
            'The winds of fate pause, awaiting your decree',
            'The realm holds its breath for your command'
        ];
        return `⏳ ${messages[Math.floor(Math.random() * messages.length)]}...`;
    }

    function getErrorMessage(): string {
        const messages: string[] = [
            'The Ripple falters. Your words were lost to the shadow. Cast them once more into the stream',
            'A rift in the weave sundered your message. Resend it to breach the veil',
            'The lattice glitched—your message vanished into the void. Try again, wanderer'
        ];
        return `❌ ${messages[Math.floor(Math.random() * messages.length)]}`;
    }

    return { getLoadingMessage, getErrorMessage };
}
