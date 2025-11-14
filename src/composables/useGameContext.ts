export function useGameContext() {
    function getLoadingMessage(): string {
        const messages: string[] = [
            'Arcane currents shift as your will takes form',
            'The aether hums as your intent ripples through the weave',
            'The winds of fate pulse as your decree unfolds',
            'The realm holds as your command is woven into being',
            'Mystic energies gather, shaping the world to your vision',
            'The cosmic dance pauses, awaiting the manifestation of your will'
        ];
        return `⏳ ${messages[Math.floor(Math.random() * messages.length)]}...`;
    }

    function getErrorMessage(): string {
        const messages: string[] = [
            'The Ripple falters. Your words were lost to the shadow. Cast them once more into the stream',
            'A rift in the weave sundered your message. Resend it to breach the veil',
            'The lattice glitched—your message vanished into the void. Try again, wanderer',
            'The cosmic threads tangled, and your message was obscured. Speak again to realign the stars',
            'The ether shimmered and your words dissolved. Project them anew into the aether',
            'A temporal distortion swallowed your message whole. Recast it into the flow of time'
        ];
        return `❌ ${messages[Math.floor(Math.random() * messages.length)]}`;
    }

    return { getLoadingMessage, getErrorMessage };
}
