-- Script para borrar todos los datos de las tablas de la aplicación
-- Ejecuta esto en el Editor SQL de Supabase

-- Borrar datos de tablas dependientes primero (por si acaso, aunque CASCADE se encarga)
TRUNCATE TABLE public.reports CASCADE;
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.matches CASCADE;
TRUNCATE TABLE public.matchmaking_queue CASCADE;

-- Borrar perfiles (OJO: Esto deja huérfanos a los usuarios en auth.users si no se borran también)
-- Si solo quieres reiniciar partidas, comenta la siguiente línea:
TRUNCATE TABLE public.profiles CASCADE;

-- Nota: Para borrar los usuarios de autenticación (auth.users), 
-- es mejor hacerlo desde el panel de Supabase: Authentication > Users > Select All > Delete
