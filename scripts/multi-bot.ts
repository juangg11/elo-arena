#!/usr/bin/env node

/**
 * Multi-Bot Runner
 * 
 * This script allows you to run multiple bots simultaneously for testing
 * matchmaking with different configurations.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface BotProcess {
    name: string;
    process: ChildProcess;
}

const bots: BotProcess[] = [];

function startBot(botName: string): ChildProcess {
    console.log(`Starting bot: ${botName}`);

    const botProcess = spawn('npm', ['run', 'simulate-bot', '--', `--bot=${botName}`], {
        stdio: 'inherit',
        shell: true,
    });

    botProcess.on('error', (error) => {
        console.error(`Error starting bot ${botName}:`, error);
    });

    botProcess.on('exit', (code) => {
        console.log(`Bot ${botName} exited with code ${code}`);
    });

    return botProcess;
}

function stopAllBots() {
    console.log('\nStopping all bots...');
    bots.forEach(({ name, process }) => {
        console.log(`Stopping ${name}...`);
        process.kill('SIGINT');
    });
    process.exit(0);
}

async function main() {
    console.log('='.repeat(60));
    console.log('  MULTI-BOT RUNNER');
    console.log('='.repeat(60));
    console.log();

    // Load bot config
    const configPath = path.join(__dirname, 'bot-config.json');

    if (!fs.existsSync(configPath)) {
        console.error(`Config file not found: ${configPath}`);
        process.exit(1);
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const botConfigs = configData.bots;

    console.log('Available bots:');
    botConfigs.forEach((bot: any, index: number) => {
        console.log(`  ${index + 1}. ${bot.name} (${bot.region}, ELO: ${bot.elo})`);
    });
    console.log();

    // Parse command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage:');
        console.log('  npm run multi-bot -- 1 2 3    # Start bots 1, 2, and 3');
        console.log('  npm run multi-bot -- all      # Start all bots');
        console.log();
        process.exit(1);
    }

    let botsToStart: string[] = [];

    if (args[0] === 'all') {
        botsToStart = botConfigs.map((bot: any) => bot.name);
    } else {
        const indices = args.map(arg => parseInt(arg) - 1);
        botsToStart = indices
            .filter(i => i >= 0 && i < botConfigs.length)
            .map(i => botConfigs[i].name);
    }

    if (botsToStart.length === 0) {
        console.error('No valid bots selected');
        process.exit(1);
    }

    console.log(`Starting ${botsToStart.length} bot(s)...`);
    console.log();

    // Start all bots with a delay between each
    for (let i = 0; i < botsToStart.length; i++) {
        const botName = botsToStart[i];
        const botProcess = startBot(botName);
        bots.push({ name: botName, process: botProcess });

        // Wait 2 seconds between starting bots to avoid race conditions
        if (i < botsToStart.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log();
    console.log('All bots started. Press Ctrl+C to stop all bots.');
    console.log();

    // Handle graceful shutdown
    process.on('SIGINT', stopAllBots);
    process.on('SIGTERM', stopAllBots);

    // Keep process alive
    await new Promise(() => { });
}

if (require.main === module) {
    main();
}
