#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueue() {
    console.log('Checking matchmaking queue...\n');

    const { data, error } = await supabase
        .from('matchmaking_queue')
        .select('*');

    if (error) {
        console.error('❌ Error:', error.message);
        console.log('\n⚠️  La tabla matchmaking_queue no existe.');
        console.log('Ejecuta la migración SQL en Supabase Dashboard.\n');
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️  La cola está vacía. No hay usuarios buscando partida.\n');
        return;
    }

    console.log(`✅ Usuarios en cola: ${data.length}\n`);
    data.forEach((entry: any, i: number) => {
        console.log(`${i + 1}. User ID: ${entry.user_id}`);
        console.log(`   Profile ID: ${entry.profile_id}`);
        console.log(`   Region: ${entry.region}`);
        console.log(`   ELO: ${entry.elo}`);
        console.log(`   Status: ${entry.status}`);
        console.log(`   Created: ${new Date(entry.created_at).toLocaleTimeString()}`);
        console.log('');
    });
}

checkQueue();
