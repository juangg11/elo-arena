import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'src', 'pages', 'Matchmaking.tsx');

console.log('Leyendo archivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Aplicando cambios...');

// Cambio 1: Agregar import
if (!content.includes('getAdjacentRanks')) {
    content = content.replace(
        'import { useToast } from "@/hooks/use-toast";',
        'import { useToast } from "@/hooks/use-toast";\nimport { getAdjacentRanks, getRankFromElo } from "@/lib/eloSystem";'
    );
    console.log('✓ Import agregado');
}

// Cambio 2: Reemplazar constantes
if (content.includes('ELO_RANGE_INITIAL')) {
    content = content.replace(
        /const ELO_RANGE_INITIAL = 50;\r?\nconst REGION_EXPAND_TIME = 180; \/\/ 3 minutos\r?\nconst FULL_EXPAND_TIME = 360; \/\/ 6 minutos \(3 \+ 3\)/,
        `// Rank-based matchmaking phases (no region filtering)
const PHASE_1_TIME = 120; // 0-2 min: Same rank only
const PHASE_2_TIME = 240; // 2-4 min: Adjacent ranks (±1)
const PHASE_3_TIME = 360; // 4-6 min: ±2 ranks (max expansion)`
    );
    console.log('✓ Constantes actualizadas');
}

// Cambio 3: Actualizar timer
if (content.includes('FULL_EXPAND_TIME')) {
    content = content.replace(
        /if \(newTime >= FULL_EXPAND_TIME\) \{\r?\n\s+setSearchPhase\('any'\);\r?\n\s+\} else if \(newTime >= REGION_EXPAND_TIME\) \{\r?\n\s+setSearchPhase\('global'\);\r?\n\s+\}/,
        `// Update phase based on rank expansion, not region
                if (newTime >= PHASE_3_TIME) {
                    setSearchPhase('any'); // ±2 ranks
                } else if (newTime >= PHASE_2_TIME) {
                    setSearchPhase('global'); // ±1 rank
                } else {
                    setSearchPhase('region'); // Same rank
                }`
    );
    console.log('✓ Timer actualizado');
}

// Cambio 4: Reemplazar getSearchPhaseText
if (content.includes("return `Buscando en ${getRegionName")) {
    const oldGetSearchPhaseText = /const getSearchPhaseText = \(\) => \{[\s\S]*?return 'Buscando cualquier oponente disponible';[\s\S]*?\n    \};/;
    const newGetSearchPhaseText = `const getSearchPhaseText = () => {
        if (!profile) return 'Buscando...';
        
        const currentTime = searchTime;
        const myRank = profile.rank || 'novato';
        
        if (currentTime < PHASE_1_TIME) {
            // 0-2 min: Same rank only
            return \`Buscando en rango: \${myRank.toUpperCase()}\`;
        } else if (currentTime < PHASE_2_TIME) {
            // 2-4 min: Adjacent ranks (±1)
            const adjacentRanks = getAdjacentRanks(myRank, 1);
            return \`Buscando en rangos: \${adjacentRanks.map(r => r.toUpperCase()).join(', ')}\`;
        } else {
            // 4-6 min: ±2 ranks
            const expandedRanks = getAdjacentRanks(myRank, 2);
            return \`Buscando en rangos: \${expandedRanks.map(r => r.toUpperCase()).join(', ')}\`;
        }
    };`;

    content = content.replace(oldGetSearchPhaseText, newGetSearchPhaseText);
    console.log('✓ getSearchPhaseText actualizado');
}

// Cambio 5: Reemplazar findMatch function
if (content.includes('let eloRange = ELO_RANGE_INITIAL;')) {
    const oldFindMatch = /\/\/ Función de búsqueda de oponente\r?\n    const findMatch = async \(currentQueueId\?: string\) => \{[\s\S]*?console\.error\('Error en findMatch:', error\);[\s\S]*?\n    \};/;
    const newFindMatch = `// Función de búsqueda de oponente (rank-based)
    const findMatch = async (currentQueueId?: string) => {
        const activeQueueId = currentQueueId || queueIdRef.current;
        if (!profile || !activeQueueId) {
            console.log('findMatch skipped - no profile or queueId', { profile: !!profile, activeQueueId });
            return;
        }

        try {
            const currentTime = searchTime;
            const myRank = profile.rank || 'novato';
            
            // Determine which ranks to search based on time
            let targetRanks: string[];
            let rankDistance: number;
            
            if (currentTime < PHASE_1_TIME) {
                // Phase 1 (0-2 min): Same rank only
                targetRanks = [myRank];
                rankDistance = 0;
            } else if (currentTime < PHASE_2_TIME) {
                // Phase 2 (2-4 min): Adjacent ranks (±1)
                targetRanks = getAdjacentRanks(myRank, 1);
                rankDistance = 1;
            } else {
                // Phase 3 (4-6 min): ±2 ranks (max expansion)
                targetRanks = getAdjacentRanks(myRank, 2);
                rankDistance = 2;
            }

            console.log('Searching for opponents...', { 
                myQueueId: activeQueueId, 
                myProfileId: profile.id,
                myRank,
                targetRanks,
                rankDistance,
                searchTime: currentTime 
            });

            // Get all searching players
            const { data: allMatches, error } = await supabase
                .from('matchmaking_queue' as any)
                .select('*')
                .eq('status', 'searching')
                .is('match_id', null)
                .neq('id', activeQueueId)
                .neq('profile_id', profile.id);

            if (error) {
                console.error('Error buscando matches:', error);
                return;
            }

            if (!allMatches || allMatches.length === 0) {
                console.log('No players in queue');
                return;
            }

            // Get profiles to filter by rank
            const profileIds = allMatches.map((m: any) => m.profile_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, rank')
                .in('id', profileIds);

            if (!profiles) {
                console.log('Could not fetch profiles');
                return;
            }

            // Create a map of profile_id -> rank
            const rankMap = new Map(profiles.map((p: any) => [p.id, p.rank]));

            // Filter matches by rank
            const matchesInRank = allMatches.filter((m: any) => {
                const playerRank = rankMap.get(m.profile_id);
                return playerRank && targetRanks.includes(playerRank);
            });

            console.log('Potential matches found:', matchesInRank.length, 'in ranks:', targetRanks);

            if (matchesInRank.length > 0) {
                const matchesTyped = matchesInRank as unknown as MatchQueueEntry[];

                // Find best match prioritizing ELO similarity
                let bestMatch: MatchQueueEntry = matchesTyped[0];
                let bestScore = Math.abs(profile.elo - matchesTyped[0].elo);

                for (const match of matchesTyped) {
                    const eloDiff = Math.abs(profile.elo - match.elo);
                    
                    if (eloDiff < bestScore) {
                        bestScore = eloDiff;
                        bestMatch = match;
                    }
                }

                console.log('Best match selected:', bestMatch, 'ELO diff:', bestScore);
                await createMatch(bestMatch, activeQueueId);
            }
        } catch (error) {
            console.error('Error en findMatch:', error);
        }
    };`;

    content = content.replace(oldFindMatch, newFindMatch);
    console.log('✓ findMatch actualizado');
}

console.log('Guardando archivo...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ ¡Todos los cambios aplicados exitosamente!');
