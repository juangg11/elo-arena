import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// INTERFACES
// ============================================

interface BotConfig {
    name: string;
    email: string;
    password: string;
    region: 'EU' | 'AM' | 'AS' | 'global';
    elo: number;
    autoChat: boolean;
    chatMessages?: string[];
    autoResult?: 'win' | 'lose' | null;
    delayBeforeResult?: number;
}

interface Profile {
    id: string;
    user_id: string;
    nickname: string;
    elo: number;
    rank: string;
    region: string;
}

interface MatchQueueEntry {
    id: string;
    user_id: string;
    profile_id: string;
    elo: number;
    region: string;
    status: 'searching' | 'matched';
    created_at: string;
    matched_with?: string | null;
    match_id?: string | null;
}

interface Match {
    id: string;
    player1_id: string;
    player2_id: string;
    elo_before_a: number;
    elo_before_b: number;
    result_a: 'win' | 'lose' | null;
    result_b: 'win' | 'lose' | null;
    winner_id: string | null;
    status: 'pending' | 'completed' | 'reported';
}

// ============================================
// BOT CLASS
// ============================================

class MatchmakingBot {
    private supabase: SupabaseClient;
    private config: BotConfig;
    private profile: Profile | null = null;
    private queueId: string | null = null;
    private currentMatchId: string | null = null;
    private isRunning: boolean = false;
    private chatChannel: any = null;
    private matchChannel: any = null;
    private queueChannel: any = null;

    constructor(config: BotConfig) {
        this.config = config;

        // Initialize Supabase client
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase credentials in .env file');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    async authenticate(): Promise<void> {
        console.log(`[${this.config.name}] Authenticating...`);

        // Try to sign in
        const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
            email: this.config.email,
            password: this.config.password,
        });

        if (signInError) {
            console.log(`[${this.config.name}] User doesn't exist, creating new account...`);

            // Sign up new user
            const { data: signUpData, error: signUpError } = await this.supabase.auth.signUp({
                email: this.config.email,
                password: this.config.password,
            });

            if (signUpError) {
                throw new Error(`Failed to create user: ${signUpError.message}`);
            }

            if (!signUpData.user) {
                throw new Error('Failed to create user');
            }

            console.log(`[${this.config.name}] User created successfully`);

            // Sign in immediately after signup
            const { error: postSignUpError } = await this.supabase.auth.signInWithPassword({
                email: this.config.email,
                password: this.config.password,
            });

            if (postSignUpError) {
                throw new Error(`Failed to sign in after signup: ${postSignUpError.message}`);
            }
        } else {
            console.log(`[${this.config.name}] Signed in successfully`);
        }

        // Get or create profile
        await this.setupProfile();
    }

    async setupProfile(): Promise<void> {
        const { data: { user } } = await this.supabase.auth.getUser();

        if (!user) {
            throw new Error('No authenticated user');
        }

        // Check if profile exists
        const { data: existingProfile, error: fetchError } = await this.supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (existingProfile) {
            this.profile = existingProfile as Profile;
            console.log(`[${this.config.name}] Profile loaded: ${this.profile.nickname} (ELO: ${this.profile.elo})`);

            // Update profile with bot config
            await this.updateProfile();
        } else {
            // Create new profile
            const { data: newProfile, error: createError } = await this.supabase
                .from('profiles')
                .insert({
                    user_id: user.id,
                    nickname: this.config.name,
                    region: this.config.region,
                    elo: this.config.elo,
                })
                .select()
                .single();

            if (createError) {
                throw new Error(`Failed to create profile: ${createError.message}`);
            }

            this.profile = newProfile as Profile;
            console.log(`[${this.config.name}] Profile created: ${this.profile.nickname}`);
        }
    }

    async updateProfile(): Promise<void> {
        if (!this.profile) return;

        const { error } = await this.supabase
            .from('profiles')
            .update({
                nickname: this.config.name,
                region: this.config.region,
                elo: this.config.elo,
            })
            .eq('id', this.profile.id);

        if (error) {
            console.error(`[${this.config.name}] Failed to update profile:`, error);
        } else {
            console.log(`[${this.config.name}] Profile updated with bot config`);
        }
    }

    // ============================================
    // MATCHMAKING
    // ============================================

    async startMatchmaking(): Promise<void> {
        if (!this.profile) {
            throw new Error('No profile available');
        }

        console.log(`[${this.config.name}] Entering matchmaking queue...`);
        console.log(`  Region: ${this.config.region}`);
        console.log(`  ELO: ${this.config.elo}`);

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Insert into matchmaking queue
        const { data: queueEntry, error: queueError } = await this.supabase
            .from('matchmaking_queue')
            .insert({
                user_id: user.id,
                profile_id: this.profile.id,
                elo: this.config.elo,
                region: this.config.region,
                status: 'searching',
            })
            .select()
            .single();

        if (queueError) {
            throw new Error(`Failed to enter queue: ${queueError.message}`);
        }

        const entry = queueEntry as unknown as MatchQueueEntry;
        this.queueId = entry.id;
        this.isRunning = true;

        console.log(`[${this.config.name}] ✓ In queue (ID: ${this.queueId})`);

        // Subscribe to queue updates
        this.subscribeToQueue();
    }

    subscribeToQueue(): void {
        if (!this.queueId) return;

        this.queueChannel = this.supabase
            .channel(`queue-${this.queueId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matchmaking_queue',
                    filter: `id=eq.${this.queueId}`,
                },
                async (payload: any) => {
                    const entry = payload.new as MatchQueueEntry;

                    if (entry.status === 'matched' && entry.match_id) {
                        console.log(`[${this.config.name}] 🎮 MATCH FOUND! Match ID: ${entry.match_id}`);
                        this.currentMatchId = entry.match_id;
                        this.stopSearching();
                        await this.handleMatch(entry.match_id);
                    }
                }
            )
            .subscribe();

        console.log(`[${this.config.name}] Subscribed to queue updates`);

        // Start actively searching for opponents
        this.startSearching();
    }

    private searchInterval: NodeJS.Timeout | null = null;
    private searchStartTime: number = 0;
    private readonly ELO_RANGE_INITIAL = 50;
    private readonly REGION_EXPAND_TIME = 180; // 3 minutes
    private readonly FULL_EXPAND_TIME = 360; // 6 minutes

    startSearching(): void {
        this.searchStartTime = Date.now();
        console.log(`[${this.config.name}] Starting active opponent search...`);

        // Search immediately
        this.findMatch();

        // Then search every 2 seconds
        this.searchInterval = setInterval(() => {
            this.findMatch();
        }, 2000);
    }

    stopSearching(): void {
        if (this.searchInterval) {
            clearInterval(this.searchInterval);
            this.searchInterval = null;
        }
    }

    async findMatch(): Promise<void> {
        if (!this.profile || !this.queueId || !this.isRunning) return;

        try {
            const searchTimeSeconds = Math.floor((Date.now() - this.searchStartTime) / 1000);
            let eloRange = this.ELO_RANGE_INITIAL;

            // Increase ELO range over time
            eloRange += Math.floor(searchTimeSeconds / 60) * 25;

            // Determine search phase
            const searchRegionOnly = searchTimeSeconds < this.REGION_EXPAND_TIME && this.config.region !== 'global';
            const searchAny = searchTimeSeconds >= this.FULL_EXPAND_TIME;

            // Build query
            let query = this.supabase
                .from('matchmaking_queue')
                .select('*')
                .eq('status', 'searching')
                .neq('id', this.queueId)
                .neq('profile_id', this.profile.id); // Exclude own profile

            // Apply ELO filter unless we're in "any" phase
            if (!searchAny) {
                query = query
                    .gte('elo', this.config.elo - eloRange)
                    .lte('elo', this.config.elo + eloRange);
            }

            // Apply region filter in first phase
            if (searchRegionOnly) {
                query = query.eq('region', this.config.region);
            }

            const { data: potentialMatches, error } = await query
                .order('created_at', { ascending: true })
                .limit(10);

            if (error) {
                console.error(`[${this.config.name}] Error searching for matches:`, error);
                return;
            }

            if (potentialMatches && potentialMatches.length > 0) {
                const matchesTyped = potentialMatches as unknown as MatchQueueEntry[];

                // Find the best match based on priority:
                // 1. Same region + closest ELO
                // 2. Closest ELO (any region)
                let bestMatch: MatchQueueEntry = matchesTyped[0];
                let bestScore = this.calculateMatchScore(matchesTyped[0]);

                for (const match of matchesTyped) {
                    const score = this.calculateMatchScore(match);
                    if (score < bestScore) {
                        bestScore = score;
                        bestMatch = match;
                    }
                }

                console.log(`[${this.config.name}] Found potential match: ${bestMatch.profile_id} (ELO: ${bestMatch.elo}, Region: ${bestMatch.region})`);
                await this.createMatch(bestMatch);
            }
        } catch (error) {
            console.error(`[${this.config.name}] Error in findMatch:`, error);
        }
    }

    calculateMatchScore(opponent: MatchQueueEntry): number {
        const eloDiff = Math.abs(this.config.elo - opponent.elo);
        const sameRegion = opponent.region === this.config.region;

        // Lower score = better match
        // Same region gives a 100 point bonus (subtracted from score)
        return eloDiff - (sameRegion ? 100 : 0);
    }

    async createMatch(opponent: MatchQueueEntry): Promise<void> {
        if (!this.profile || !this.queueId) return;

        try {
            // Create the match
            // Note: Using player1_id/player2_id and player1_elo/player2_elo to match actual DB schema
            const { data: matchData, error: matchError } = await this.supabase
                .from('matches')
                .insert({
                    player1_id: this.profile.id,
                    player2_id: opponent.profile_id,
                    player1_elo: this.config.elo,
                    player2_elo: opponent.elo,
                    status: 'pending'
                })
                .select('id')
                .single();

            if (matchError) {
                console.error(`[${this.config.name}] Error creating match:`, matchError);
                return;
            }

            const matchId = (matchData as { id: string }).id;
            console.log(`[${this.config.name}] ✓ Match created: ${matchId}`);

            // Update own queue entry
            await this.supabase
                .from('matchmaking_queue')
                .update({
                    status: 'matched',
                    matched_with: opponent.id,
                    match_id: matchId
                })
                .eq('id', this.queueId);

            // Update opponent's queue entry
            await this.supabase
                .from('matchmaking_queue')
                .update({
                    status: 'matched',
                    matched_with: this.queueId,
                    match_id: matchId
                })
                .eq('id', opponent.id);

            this.stopSearching();
            this.currentMatchId = matchId;
            await this.handleMatch(matchId);

        } catch (error) {
            console.error(`[${this.config.name}] Error in createMatch:`, error);
        }
    }

    // ============================================
    // MATCH HANDLING
    // ============================================

    async handleMatch(matchId: string): Promise<void> {
        console.log(`[${this.config.name}] Joining match ${matchId}...`);

        // Subscribe to match updates
        this.subscribeToMatch(matchId);

        // Subscribe to chat
        if (this.config.autoChat) {
            this.subscribeToChat(matchId);
            await this.sendChatMessages(matchId);
        }

        // Auto-declare result if configured
        if (this.config.autoResult) {
            const delay = this.config.delayBeforeResult || 30000;
            console.log(`[${this.config.name}] Will declare result '${this.config.autoResult}' in ${delay / 1000}s`);

            setTimeout(async () => {
                await this.declareResult(matchId, this.config.autoResult!);
            }, delay);
        }
    }

    subscribeToMatch(matchId: string): void {
        this.matchChannel = this.supabase
            .channel(`match-${matchId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matches',
                    filter: `id=eq.${matchId}`,
                },
                (payload: any) => {
                    const match = payload.new as Match;

                    if (match.status === 'completed') {
                        console.log(`[${this.config.name}] ✓ Match completed!`);
                        console.log(`  Winner: ${match.winner_id}`);
                        this.cleanup();
                    } else if (match.status === 'reported') {
                        console.log(`[${this.config.name}] ⚠ Match reported!`);
                    }
                }
            )
            .subscribe();
    }

    subscribeToChat(matchId: string): void {
        this.chatChannel = this.supabase
            .channel(`chat-${matchId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `match_id=eq.${matchId}`,
                },
                async (payload: any) => {
                    const message = payload.new;
                    if (message.sender_id !== this.profile?.id) {
                        console.log(`[${this.config.name}] 💬 Received: "${message.content}"`);

                        // Auto-respond with "hola"
                        await this.sendMessage(matchId, "hola");
                    }
                }
            )
            .subscribe();
    }

    async sendMessage(matchId: string, content: string): Promise<void> {
        if (!this.profile) return;

        const { error } = await this.supabase
            .from('messages')
            .insert({
                match_id: matchId,
                sender_id: this.profile.id,
                content: content,
            });

        if (error) {
            console.error(`[${this.config.name}] Failed to send message:`, error);
        } else {
            console.log(`[${this.config.name}] 💬 Sent: "${content}"`);
        }
    }

    async sendChatMessages(matchId: string): Promise<void> {
        if (!this.config.chatMessages || !this.profile) return;

        for (let i = 0; i < this.config.chatMessages.length; i++) {
            const message = this.config.chatMessages[i];
            const delay = i * 5000; // 5 seconds between messages

            setTimeout(async () => {
                const { error } = await this.supabase
                    .from('messages')
                    .insert({
                        match_id: matchId,
                        sender_id: this.profile!.id,
                        content: message,
                    });

                if (error) {
                    console.error(`[${this.config.name}] Failed to send message:`, error);
                } else {
                    console.log(`[${this.config.name}] 💬 Sent: "${message}"`);
                }
            }, delay);
        }
    }

    async declareResult(matchId: string, result: 'win' | 'lose'): Promise<void> {
        if (!this.profile) return;

        console.log(`[${this.config.name}] Declaring result: ${result}`);

        // Get match to determine if we're player1 or player2
        const { data: matchData } = await this.supabase
            .from('matches')
            .select('*')
            .eq('id', matchId)
            .single();

        if (!matchData) {
            console.error(`[${this.config.name}] Failed to fetch match`);
            return;
        }

        const match = matchData as Match;
        const isPlayer1 = match.player1_id === this.profile.id;
        const resultKey = isPlayer1 ? 'result_a' : 'result_b';

        const { error } = await this.supabase
            .from('matches')
            .update({ [resultKey]: result })
            .eq('id', matchId);

        if (error) {
            console.error(`[${this.config.name}] Failed to declare result:`, error);
            return;
        }

        console.log(`[${this.config.name}] ✓ Result declared: ${result}`);

        // Check if opponent has reported to finalize match
        const { data: updatedMatch } = await this.supabase
            .from('matches')
            .select('*')
            .eq('id', matchId)
            .single();

        if (!updatedMatch) return;

        const opponentResult = isPlayer1 ? updatedMatch.result_b : updatedMatch.result_a;

        if (opponentResult) {
            console.log(`[${this.config.name}] Opponent has already reported: ${opponentResult}`);
            let newStatus = 'reported';
            let winnerId = null;

            if (result === 'win' && opponentResult === 'lose') {
                newStatus = 'completed';
                winnerId = this.profile.id;
            } else if (result === 'lose' && opponentResult === 'win') {
                newStatus = 'completed';
                winnerId = isPlayer1 ? match.player2_id : match.player1_id;
            }

            const updatePayload: any = { status: newStatus };
            if (winnerId) updatePayload.winner_id = winnerId;

            const { error: finalError } = await this.supabase
                .from('matches')
                .update(updatePayload)
                .eq('id', matchId);

            if (finalError) {
                console.error(`[${this.config.name}] Failed to finalize match:`, finalError);
            } else {
                console.log(`[${this.config.name}] Match finalized: ${newStatus}`);
            }
        }
    }

    // ============================================
    // CLEANUP
    // ============================================

    async cleanup(): Promise<void> {
        console.log(`[${this.config.name}] Cleaning up...`);

        this.stopSearching();

        if (this.queueId) {
            await this.supabase
                .from('matchmaking_queue')
                .delete()
                .eq('id', this.queueId);
        }

        if (this.queueChannel) {
            await this.supabase.removeChannel(this.queueChannel);
        }

        if (this.matchChannel) {
            await this.supabase.removeChannel(this.matchChannel);
        }

        if (this.chatChannel) {
            await this.supabase.removeChannel(this.chatChannel);
        }

        this.isRunning = false;
        console.log(`[${this.config.name}] Cleanup complete`);
    }

    async stop(): Promise<void> {
        await this.cleanup();
        await this.supabase.auth.signOut();
        console.log(`[${this.config.name}] Bot stopped`);
    }
}

// ============================================
// CLI INTERFACE
// ============================================

async function main() {
    console.log('='.repeat(60));
    console.log('  ELO ARENA - MATCHMAKING BOT SIMULATOR');
    console.log('='.repeat(60));
    console.log();

    // Parse command line arguments
    const args = process.argv.slice(2);
    const configFile = args.find(arg => arg.startsWith('--config='))?.split('=')[1];
    const botName = args.find(arg => arg.startsWith('--bot='))?.split('=')[1];
    const region = args.find(arg => arg.startsWith('--region='))?.split('=')[1] as 'EU' | 'AM' | 'AS' | 'global';
    const elo = args.find(arg => arg.startsWith('--elo='))?.split('=')[1];
    const name = args.find(arg => arg.startsWith('--name='))?.split('=')[1];

    let bot: MatchmakingBot;

    if (configFile || botName) {
        // Load from config file
        const configPath = configFile || path.join(__dirname, 'bot-config.json');

        if (!fs.existsSync(configPath)) {
            console.error(`Config file not found: ${configPath}`);
            process.exit(1);
        }

        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const botConfigs: BotConfig[] = configData.bots;

        let selectedConfig: BotConfig | undefined;

        if (botName) {
            selectedConfig = botConfigs.find(b => b.name === botName);
            if (!selectedConfig) {
                console.error(`Bot '${botName}' not found in config file`);
                console.log('Available bots:', botConfigs.map(b => b.name).join(', '));
                process.exit(1);
            }
        } else {
            // Interactive selection
            console.log('Available bots:');
            botConfigs.forEach((b, i) => {
                console.log(`  ${i + 1}. ${b.name} (${b.region}, ELO: ${b.elo})`);
            });

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const answer = await new Promise<string>(resolve => {
                rl.question('\nSelect bot number: ', resolve);
            });
            rl.close();

            const index = parseInt(answer) - 1;
            selectedConfig = botConfigs[index];

            if (!selectedConfig) {
                console.error('Invalid selection');
                process.exit(1);
            }
        }

        bot = new MatchmakingBot(selectedConfig);
    } else if (region && elo && name) {
        // Create bot from CLI arguments
        const config: BotConfig = {
            name: name,
            email: 'bot-eu-low@example.com',
            password: 'TestBot123!',
            region: region,
            elo: parseInt(elo),
            autoChat: true,
            chatMessages: ['Hello!', 'Ready to play?', 'GG!'],
            autoResult: 'win',
            delayBeforeResult: 30000,
        };

        bot = new MatchmakingBot(config);
    } else {
        console.log('Usage:');
        console.log('  1. From config file:');
        console.log('     npm run simulate-bot -- --config=./scripts/bot-config.json --bot="Bot EU Low"');
        console.log('     npm run simulate-bot (interactive)');
        console.log();
        console.log('  2. From CLI arguments:');
        console.log('     npm run simulate-bot -- --name="My Bot" --region=EU --elo=600');
        console.log();
        process.exit(1);
    }

    // Start bot
    try {
        await bot.authenticate();
        await bot.startMatchmaking();

        console.log();
        console.log('Bot is running. Press Ctrl+C to stop.');
        console.log();

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n\nShutting down...');
            await bot.stop();
            process.exit(0);
        });

        // Keep process alive
        await new Promise(() => { });
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run if executed directly
const isMainModule = process.argv[1] === __filename;
if (isMainModule) {
    main();
}

export { MatchmakingBot, BotConfig };
