import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const versionFile = join(process.cwd(), 'VERSION.txt');

try {
  const currentVersion = readFileSync(versionFile, 'utf-8').trim();
  const parts = currentVersion.split('.');
  
  // Increment patch version (1.0.0 -> 1.0.1)
  const major = parseInt(parts[0]) || 1;
  const minor = parseInt(parts[1]) || 0;
  const patch = parseInt(parts[2]) || 0;
  
  const newVersion = `${major}.${minor}.${patch + 1}`;
  
  writeFileSync(versionFile, newVersion + '\n', 'utf-8');
  
  console.log(`✅ Versión incrementada: ${currentVersion} -> ${newVersion}`);
} catch (error) {
  console.error('❌ Error al incrementar versión:', error);
  process.exit(1);
}

