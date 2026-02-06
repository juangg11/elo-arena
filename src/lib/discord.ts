interface Profile {
    nickname: string;
    elo: number;
    rank: string;
}

/**
 * Sends a notification to Discord when a user joins the matchmaking queue
 * @param profile - The user's profile information
 * @returns Promise that resolves when the message is sent (or fails silently)
 */
export async function sendDiscordNotification(profile: Profile): Promise<void> {
    const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured');
        return;
    }

    try {
        const embed = {
            title: "🎮 There is someone looking for a match!",
            description: "👉 **https://elo-arena-kappa.vercel.app** @RANKEDS",
            color: 0x5865F2,
            fields: [
                {
                    name: "ELO",
                    value: profile.elo.toString(),
                    inline: true
                },
                {
                    name: "Rango",
                    value: profile.rank,
                    inline: true
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: "ELO Arena Matchmaking"
            }
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                embeds: [embed]
            })
        });

        if (!response.ok) {
            console.error('Failed to send Discord notification:', response.statusText);
        }
    } catch (error) {
        // Fail silently to not interrupt matchmaking flow
        console.error('Error sending Discord notification:', error);
    }
}
