import { ref, nextTick } from 'vue';


import { marked } from 'marked';

export interface Message {
    text: string;
    markdown?: boolean;
}

export function useMessages(chatContainer?: () => HTMLElement | null, chatInput?: () => HTMLInputElement | null) {
    const messages = ref<{ raw: string; html: string; markdown: boolean }[]>([]);

    async function pushMessage(msg: string | Message) {
        let text: string;
        let markdown = true;
        if (typeof msg === 'string') {
            text = msg;
        } else {
            text = msg.text;
            if (typeof msg.markdown === 'boolean') markdown = msg.markdown;
        }
        const html = markdown ? await Promise.resolve(marked.parse(text)) : text;
        messages.value.push({ raw: text, html: typeof html === 'string' ? html : String(html), markdown });
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
