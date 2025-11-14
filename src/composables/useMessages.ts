import { ref, nextTick } from 'vue';

export function useMessages(chatContainer?: () => HTMLElement | null, chatInput?: () => HTMLInputElement | null) {
    const messages = ref<{ raw: string; html: string }[]>([]);

    async function pushMessage(htmlOrMarkdown: string) {
        // Assume already markdown processed upstream (component can pipe through marked before calling if desired)
        messages.value.push({ raw: htmlOrMarkdown, html: htmlOrMarkdown });
        await nextTick();
        scrollToBottom();
    }

    function scrollToBottom() {
        nextTick(() => {
            const el = chatContainer?.();
            if (el) {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            }
            const input = chatInput?.();
            if (input) input.focus();
        });
    }

    return { messages, pushMessage, scrollToBottom };
}
