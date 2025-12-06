import { Client, Receiver } from '@upstash/qstash';

// Initialize QStash client for publishing messages
export const qstashClient = new Client({
    token: process.env.QSTASH_TOKEN || '',
});

// Helper to verify QStash signature in Next.js App Router API routes
export const verifyQStashSignature = async (req: Request, currentKey?: string, nextKey?: string) => {
    if (!currentKey && !process.env.QSTASH_CURRENT_SIGNING_KEY) {
        console.warn('Missing QSTASH_CURRENT_SIGNING_KEY env var, skipping verification in dev');
        return process.env.NODE_ENV === 'development';
    }

    const receiver = new Receiver({
        currentSigningKey: currentKey || process.env.QSTASH_CURRENT_SIGNING_KEY || '',
        nextSigningKey: nextKey || process.env.QSTASH_NEXT_SIGNING_KEY || '',
    });

    const body = await req.text();
    const signature = req.headers.get('upstash-signature') || '';

    try {
        return await receiver.verify({
            signature,
            body,
        });
    } catch (err) {
        console.error('QStash signature verification failed:', err);
        return false;
    }
};
