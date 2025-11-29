#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking matches table schema...\n');

    // Intentamos insertar un registro dummy para ver qué columnas fallan
    // o simplemente seleccionamos una fila para ver las columnas
    const { data, error } = await supabase
        .from('matches')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error selecting from matches:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found in matches table:');
        console.log(Object.keys(data[0]).join(', '));
    } else {
        console.log('Table is empty, trying to infer columns from error...');
        // Try to insert with all columns to see if it complains
        const { error: insertError } = await supabase
            .from('matches')
            .insert({
                player1_id: '00000000-0000-0000-0000-000000000000', // Dummy UUIDs
                player2_id: '00000000-0000-0000-0000-000000000000',
                elo_before_a: 1000,
                elo_before_b: 1000,
                status: 'pending'
            });

        if (insertError) {
            console.log('Insert error:', insertError.message);
        }
    }
}

checkSchema();
