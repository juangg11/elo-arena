import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Inicializa Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("🚀 Ejecutando seed...");

async function seed() {
  try {
    // Limpia tablas
    await supabase.from("matches").delete().neq("id", "");
    await supabase.from("profiles").delete().neq("id", "");

    // Inserta datos fake
    await supabase.from("profiles").insert([
      { user_id: crypto.randomUUID(), nickname: "PlayerOne", region: "EU", elo: 600, rank: "aspirante", games_played: 0, wins: 0 },
      { user_id: crypto.randomUUID(), nickname: "PlayerTwo", region: "FR", elo: 650, rank: "aspirante", games_played: 2, wins: 1 },
      { user_id: crypto.randomUUID(), nickname: "GamerX", region: "EU", elo: 800, rank: "promesa", games_played: 5, wins: 3 },
      { user_id: crypto.randomUUID(), nickname: "NoobMaster", region: "FR", elo: 550, rank: "aspirante", games_played: 1, wins: 0 },
      { user_id: crypto.randomUUID(), nickname: "ProSlayer", region: "FR", elo: 1200, rank: "relampago", games_played: 10, wins: 7 },
    ]);

    console.log("✅ Base de datos reseteada y datos fake insertados");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en seed:", error);
    process.exit(1);
  }
}

seed();
