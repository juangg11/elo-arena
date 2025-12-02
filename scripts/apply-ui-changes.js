import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'src', 'pages', 'Matchmaking.tsx');

console.log('Leyendo archivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Aplicando cambios de UI...');

// Cambio 1: Remover Rango ELO
if (content.includes('Rango ELO:')) {
    content = content.replace(
        /<p className="text-sm text-muted-foreground">\s*Rango ELO: \{profile\.elo - \(ELO_RANGE_INITIAL \+ Math\.floor\(searchTime \/ 60\) \* 25\)\} - \{profile\.elo \+ \(ELO_RANGE_INITIAL \+ Math\.floor\(searchTime \/ 60\) \* 25\)\}\s*<\/p>/g,
        '{/* ELO range removed */}'
    );
    console.log('✓ Rango ELO removido');
}

// Cambio 2: Remover Badge de Región
if (content.includes('searchPhase === \'region\' ? getRegionName')) {
    content = content.replace(
        /<Badge\s*variant=\{searchPhase === 'region' \? 'default' : 'secondary'\}\s*className="gap-2"\s*>\s*<Users className="h-3 w-3" \/>\s*\{searchPhase === 'region' \? getRegionName\(profile\.region\) : 'Global'\}\s*<\/Badge>/g,
        '{/* Region badge removed */}'
    );
    console.log('✓ Badge de región removido');
}

// Cambio 3: Remover mensajes de expansión
if (content.includes('Expandiendo búsqueda')) {
    content = content.replace(
        /\{searchTime >= REGION_EXPAND_TIME && searchTime < FULL_EXPAND_TIME && \(\s*<p className="text-xs text-yellow-500 mt-3">\s*Expandiendo búsqueda a todas las regiones\.\.\.\s*<\/p>\s*\)\}/g,
        '{/* Expansion message 1 removed */}'
    );
    content = content.replace(
        /\{searchTime >= FULL_EXPAND_TIME && \(\s*<p className="text-xs text-orange-500 mt-3">\s*Buscando cualquier oponente disponible\.\.\.\s*<\/p>\s*\)\}/g,
        '{/* Expansion message 2 removed */}'
    );
    console.log('✓ Mensajes de expansión removidos');
}

// Cambio 4: Remover título "Buscando oponente..." para dejar solo el texto de fase
if (content.includes('>Buscando oponente...</h3>')) {
    content = content.replace(
        /<h3 className="text-xl font-bold mb-2">Buscando oponente...<\/h3>/g,
        '{/* Title removed */}'
    );
    console.log('✓ Título "Buscando oponente..." removido');
}

console.log('Guardando archivo...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ ¡Cambios de UI aplicados exitosamente!');
