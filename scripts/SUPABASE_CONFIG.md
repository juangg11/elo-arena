# Configuración de Supabase para Bots

Para que los bots funcionen correctamente, necesitas deshabilitar la verificación de email en Supabase.

## Pasos

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)

2. Navega a **Authentication** → **Providers** → **Email**

3. Desactiva **"Confirm email"**

4. Guarda los cambios

## Alternativa

Si no quieres deshabilitar la verificación de email globalmente, puedes:

1. Crear manualmente los usuarios de los bots en Supabase Dashboard
2. Ir a **Authentication** → **Users** → **Add user**
3. Crear usuarios con los emails de `bot-config.json`:
   - `bot-eu-low@example.com` / `TestBot123!`
   - `bot-am-mid@example.com` / `TestBot123!`
   - `bot-as-high@example.com` / `TestBot123!`

## Solución de Problemas

### Error: "Could not find the 'elo_before_a' column"

Si ves este error en la terminal del bot, significa que la tabla `matches` no tiene las columnas necesarias. Ejecuta este SQL en Supabase:

```sql
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS elo_before_a INTEGER,
ADD COLUMN IF NOT EXISTS elo_before_b INTEGER,
ADD COLUMN IF NOT EXISTS elo_after_a INTEGER,
ADD COLUMN IF NOT EXISTS elo_after_b INTEGER,
ADD COLUMN IF NOT EXISTS result_a TEXT CHECK (result_a IN ('win', 'lose')),
ADD COLUMN IF NOT EXISTS result_b TEXT CHECK (result_b IN ('win', 'lose')),
ADD COLUMN IF NOT EXISTS player1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS player2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
```
