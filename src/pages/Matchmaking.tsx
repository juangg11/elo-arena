import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Trophy, Clock, Users, AlertTriangle, Shield, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
    id: string;
    nickname: string;
    elo: number;
    rank: string;
    region: string;
}

// Interfaz para la tabla 'matchmaking_queue'
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

// Interfaz para el resultado del INSERT en 'matches'
interface MatchInsertResult {
    id: string;
}


const MATCHMAKING_RULES = [
    "Prohibido usar cheats o trampas que te permitan conseguir algo que no sea obtenible legalmente.",
    "No se puede manipular o mentir en el resultado.",
    "En caso de disputa con el resultado saca captura del partido."
];

const ELO_RANGE_INITIAL = 50;
const REGION_EXPAND_TIME = 180; // 3 minutos
const FULL_EXPAND_TIME = 360; // 6 minutos (3 + 3)

const Matchmaking = () => {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTime, setSearchTime] = useState(0);
    const [loading, setLoading] = useState(true);
    const [queueId, setQueueId] = useState<string | null>(null);
    const [searchPhase, setSearchPhase] = useState<'region' | 'global' | 'any'>('region');
    const navigate = useNavigate();
    const { toast } = useToast();

    const searchIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const subscriptionRef = useRef<any>(null);
    const queueIdRef = useRef<string | null>(null);

    // Mantener queueIdRef sincronizado con el estado
    useEffect(() => {
        queueIdRef.current = queueId;
    }, [queueId]);

    // Timer para la búsqueda
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isSearching) {
            interval = setInterval(() => {
                setSearchTime((prev) => {
                    const newTime = prev + 1;

                    if (newTime >= FULL_EXPAND_TIME) {
                        setSearchPhase('any');
                    } else if (newTime >= REGION_EXPAND_TIME) {
                        setSearchPhase('global');
                    }

                    return newTime;
                });
            }, 1000);
        } else {
            setSearchTime(0);
            setSearchPhase('region');
        }
        return () => clearInterval(interval);
    }, [isSearching]);

    // Obtener Perfil y manejar Auth
    useEffect(() => {
        const fetchData = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                navigate("/auth");
                return;
            }

            setUser(session.user);

            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", session.user.id)
                .single();

            if (profileData) {
                setProfile(profileData as Profile);
            }

            setLoading(false);
        };

        fetchData();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                navigate("/auth");
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getRegionName = (regionCode: string) => {
        const regions: { [key: string]: string } = {
            global: "Global",
            EU: "Europa",
            AM: "América",
            AS: "Asia"
        };
        return regions[regionCode] || regionCode;
    };

    const getSearchPhaseText = () => {
        if (searchPhase === 'region') {
            return `Buscando en ${getRegionName(profile?.region || '')}`;
        } else if (searchPhase === 'global') {
            return 'Buscando en todas las regiones';
        } else {
            return 'Buscando cualquier oponente disponible';
        }
    };

    // Función de búsqueda de oponente
    const findMatch = async (currentQueueId?: string) => {
        const activeQueueId = currentQueueId || queueIdRef.current;
        if (!profile || !activeQueueId) {
            console.log('findMatch skipped - no profile or queueId', { profile: !!profile, activeQueueId });
            return;
        }

        try {
            const currentTime = searchTime;
            let eloRange = ELO_RANGE_INITIAL;

            // Aumentar rango de ELO con el tiempo
            eloRange += Math.floor(currentTime / 60) * 25;

            console.log('Searching for opponents...', { 
                myQueueId: activeQueueId, 
                myProfileId: profile.id,
                elo: profile.elo, 
                eloRange, 
                region: profile.region,
                searchTime: currentTime 
            });

            // Usar 'as any' para ignorar el tipado estricto de Supabase si no se genera types.ts
            let query = supabase
                .from('matchmaking_queue' as any)
                .select('*')
                .eq('status', 'searching')
                .is('match_id', null) // Asegurar que no tenga match_id asignado
                .neq('id', activeQueueId)
                .neq('profile_id', profile.id) // Excluir mi propio perfil
                .gte('elo', profile.elo - eloRange)
                .lte('elo', profile.elo + eloRange);

            // Fase 1: Solo tu región
            if (currentTime < REGION_EXPAND_TIME && profile.region !== 'global') {
                query = query.eq('region', profile.region);
            }

            const { data: potentialMatches, error } = await query
                .order('created_at', { ascending: true })
                .limit(10);

            if (error) {
                console.error('Error buscando matches:', error);
                return;
            }

            console.log('Potential matches found:', potentialMatches?.length || 0, potentialMatches);

            if (potentialMatches && potentialMatches.length > 0) {
                // Castear a unknown primero y luego a MatchQueueEntry[] para mayor seguridad.
                const matchesTyped = potentialMatches as unknown as MatchQueueEntry[];

                let bestMatch: MatchQueueEntry = matchesTyped[0];
                let bestScore = Math.abs(profile.elo - matchesTyped[0].elo);

                for (const match of matchesTyped) {
                    const eloDiff = Math.abs(profile.elo - match.elo);
                    const sameRegion = match.region === profile.region;

                    const score = eloDiff - (sameRegion ? 100 : 0);

                    if (score < bestScore) {
                        bestScore = score;
                        bestMatch = match;
                    }
                }

                console.log('Best match selected:', bestMatch);
                await createMatch(bestMatch, activeQueueId);
            }
        } catch (error) {
            console.error('Error en findMatch:', error);
        }
    };

    // Función para crear la partida con verificación robusta
    const createMatch = async (opponent: MatchQueueEntry, currentQueueId?: string) => {
        const activeQueueId = currentQueueId || queueIdRef.current;
        if (!profile || !activeQueueId) return;

        console.log('Creating match with opponent:', opponent);

        try {
            // Sistema de espera y verificación múltiple (10 segundos con verificaciones cada 2 segundos)
            const maxWaitTime = 10000; // 10 segundos
            const checkInterval = 2000; // Verificar cada 2 segundos
            const maxChecks = Math.floor(maxWaitTime / checkInterval);
            
            for (let check = 0; check < maxChecks; check++) {
                // Verificar que el oponente siga disponible
                const { data: opponentCheck, error: checkError } = await supabase
                    .from('matchmaking_queue' as any)
                    .select('status, match_id, profile_id')
                    .eq('id', opponent.id)
                    .single();

                if (checkError || !opponentCheck) {
                    console.log(`Check ${check + 1}: Opponent not found or error`);
                    if (check < maxChecks - 1) {
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                        continue;
                    }
                    toast({
                        title: "Error",
                        description: "El oponente ya no está disponible.",
                        variant: "destructive"
                    });
                    return;
                }

                // Si el oponente ya está en un match, verificar si hay matches duplicados
                if (opponentCheck.match_id) {
                    console.log(`Check ${check + 1}: Opponent already has match_id:`, opponentCheck.match_id);
                    
                    // Verificar si hay matches duplicados con este oponente
                    const { data: existingMatches, error: matchesError } = await supabase
                        .from('matches')
                        .select('id, player1_id, player2_id, status')
                        .or(`player1_id.eq.${opponentCheck.profile_id},player2_id.eq.${opponentCheck.profile_id}`)
                        .eq('status', 'pending')
                        .order('created_at', { ascending: false })
                        .limit(5);

                    if (existingMatches && existingMatches.length > 1) {
                        console.log('Found duplicate matches, cleaning up...');
                        // Eliminar matches duplicados (mantener el más reciente)
                        const matchesToDelete = existingMatches.slice(1);
                        for (const match of matchesToDelete) {
                            await supabase.from('matches').delete().eq('id', match.id);
                            console.log('Deleted duplicate match:', match.id);
                        }
                        // Continuar verificando
                        if (check < maxChecks - 1) {
                            await new Promise(resolve => setTimeout(resolve, checkInterval));
                            continue;
                        }
                    }
                    
                    toast({
                        title: "Oponente no disponible",
                        description: "El oponente ya encontró partida. Buscando otro...",
                        variant: "destructive"
                    });
                    return;
                }

                // Si el oponente no está buscando, cancelar
                if (opponentCheck.status !== 'searching') {
                    console.log(`Check ${check + 1}: Opponent status is not searching:`, opponentCheck.status);
                    if (check < maxChecks - 1) {
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                        continue;
                    }
                    toast({
                        title: "Oponente no disponible",
                        description: "El oponente ya encontró partida. Buscando otro...",
                        variant: "destructive"
                    });
                    return;
                }

                // Verificar que nosotros tampoco estemos ya en un match
                const { data: myCheck, error: myCheckError } = await supabase
                    .from('matchmaking_queue' as any)
                    .select('status, match_id, profile_id')
                    .eq('id', activeQueueId)
                    .single();

                if (myCheckError || !myCheck) {
                    console.error('Error checking own status:', myCheckError);
                    return;
                }

                if (myCheck.status !== 'searching' || myCheck.match_id) {
                    console.log('Already matched:', myCheck);
                    return;
                }

                // Verificar si ya existe un match entre estos dos jugadores
                const { data: existingMatch, error: existingMatchError } = await supabase
                    .from('matches')
                    .select('id, status')
                    .or(`and(player1_id.eq.${profile.id},player2_id.eq.${opponentCheck.profile_id}),and(player1_id.eq.${opponentCheck.profile_id},player2_id.eq.${profile.id})`)
                    .eq('status', 'pending')
                    .limit(1)
                    .single();

                if (existingMatch && !existingMatchError) {
                    console.log('Match already exists between these players:', existingMatch.id);
                    // Usar el match existente
                    const matchId = existingMatch.id;
                    
                    // Actualizar ambas entradas
                    await Promise.all([
                        supabase
                            .from('matchmaking_queue' as any)
                            .update({
                                status: 'matched',
                                matched_with: opponent.id,
                                match_id: matchId
                            })
                            .eq('id', activeQueueId)
                            .eq('status', 'searching')
                            .is('match_id', null),
                        supabase
                            .from('matchmaking_queue' as any)
                            .update({
                                status: 'matched',
                                matched_with: activeQueueId,
                                match_id: matchId
                            })
                            .eq('id', opponent.id)
                            .eq('status', 'searching')
                            .is('match_id', null)
                    ]);

                    cleanupSearch();
                    toast({
                        title: "¡Match encontrado!",
                        description: "Redirigiendo a la sala de match...",
                    });
                    setTimeout(() => {
                        navigate(`/match/${matchId}`);
                    }, 1000);
                    return;
                }

                // Si llegamos aquí, ambos están disponibles, crear el match
                break; // Salir del loop de verificación
            }

            const { data: matchData, error: matchError } = await supabase
                .from('matches')
                .insert({
                    player1_id: profile.id,
                    player2_id: opponent.profile_id,
                    player1_elo: profile.elo,
                    player2_elo: opponent.elo,
                    status: 'pending'
                } as any) // Añadimos 'as any' para evitar conflictos de tipado de Supabase
                .select('id')
                .single();

            if (matchError) {
                console.error('Error creating match:', matchError);
                throw matchError;
            }
            
            console.log('Match created:', matchData);

            const matchResult = matchData as MatchInsertResult;
            const matchId = matchResult.id;

            // Verificar si hay matches duplicados después de crear este
            const { data: duplicateMatches, error: dupError } = await supabase
                .from('matches')
                .select('id, player1_id, player2_id, created_at')
                .or(`and(player1_id.eq.${profile.id},player2_id.eq.${opponent.profile_id}),and(player1_id.eq.${opponent.profile_id},player2_id.eq.${profile.id})`)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (duplicateMatches && duplicateMatches.length > 1) {
                console.log('Found duplicate matches after creation, cleaning up...');
                // Mantener el más reciente (el que acabamos de crear) y eliminar los demás
                const matchesToDelete = duplicateMatches.filter(m => m.id !== matchId);
                for (const match of matchesToDelete) {
                    await supabase.from('matches').delete().eq('id', match.id);
                    console.log('Deleted duplicate match:', match.id);
                    
                    // Limpiar las entradas de cola asociadas
                    await supabase
                        .from('matchmaking_queue' as any)
                        .update({ status: 'searching', matched_with: null, match_id: null })
                        .eq('match_id', match.id);
                }
            }

            // Actualizar ambas entradas en paralelo y verificar que se actualicen correctamente
            const [myUpdateResult, opponentUpdateResult] = await Promise.all([
                supabase
                    .from('matchmaking_queue' as any)
                    .update({
                        status: 'matched',
                        matched_with: opponent.id,
                        match_id: matchId
                    })
                    .eq('id', activeQueueId)
                    .eq('status', 'searching') // Solo actualizar si sigue buscando
                    .is('match_id', null) // Solo si no tiene match_id
                    .select(),
                supabase
                    .from('matchmaking_queue' as any)
                    .update({
                        status: 'matched',
                        matched_with: activeQueueId,
                        match_id: matchId
                    })
                    .eq('id', opponent.id)
                    .eq('status', 'searching') // Solo actualizar si sigue buscando
                    .is('match_id', null) // Solo si no tiene match_id
                    .select()
            ]);

            // Verificar que ambas actualizaciones fueron exitosas
            if (!myUpdateResult.data || myUpdateResult.data.length === 0) {
                console.error('Failed to update own queue entry - already matched?');
                // Si no se pudo actualizar, eliminar el match creado
                await supabase.from('matches').delete().eq('id', matchId);
                toast({
                    title: "Error",
                    description: "No se pudo crear el match. Intenta de nuevo.",
                    variant: "destructive"
                });
                return;
            }

            if (!opponentUpdateResult.data || opponentUpdateResult.data.length === 0) {
                console.error('Failed to update opponent queue entry - already matched?');
                // Si no se pudo actualizar, eliminar el match creado y revertir nuestra actualización
                await supabase.from('matches').delete().eq('id', matchId);
                await supabase
                    .from('matchmaking_queue' as any)
                    .update({ status: 'searching', matched_with: null, match_id: null })
                    .eq('id', activeQueueId);
                toast({
                    title: "Oponente no disponible",
                    description: "El oponente ya encontró partida. Buscando otro...",
                    variant: "destructive"
                });
                return;
            }

            cleanupSearch();

            toast({
                title: "¡Match encontrado!",
                description: "Redirigiendo a la sala de match...",
            });

            setTimeout(() => {
                navigate(`/match/${matchId}`);
            }, 1000);

        } catch (error) {
            console.error('Error creando match:', error);
            toast({
                title: "Error",
                description: "No se pudo crear el match.",
                variant: "destructive"
            });
        }
    };

    const cleanupSearch = () => {
        if (searchIntervalRef.current) {
            clearInterval(searchIntervalRef.current);
            searchIntervalRef.current = null;
        }
        if (subscriptionRef.current) {
            supabase.removeChannel(subscriptionRef.current);
            subscriptionRef.current = null;
        }
        setIsSearching(false);
        setQueueId(null);
    };

    // Polling fallback to check if someone else matched us
    const checkIfMatched = async (currentQueueId: string) => {
        try {
            const { data, error } = await supabase
                .from('matchmaking_queue' as any)
                .select('*')
                .eq('id', currentQueueId)
                .single();

            if (error) {
                console.log('Queue entry not found, may have been deleted');
                return;
            }

            const entry = data as unknown as MatchQueueEntry;
            
            if (entry.status === 'matched' && entry.match_id) {
                console.log('Match found via polling! Navigating to:', entry.match_id);
                cleanupSearch();
                toast({
                    title: "¡Match encontrado!",
                    description: "Redirigiendo a la sala de match...",
                });
                setTimeout(() => {
                    navigate(`/match/${entry.match_id}`);
                }, 500);
            }
        } catch (err) {
            console.error('Error checking if matched:', err);
        }
    };

    const handleStartSearch = async () => {
        if (!profile || !user) return;

        try {
            setIsSearching(true);

            // Insertar en la cola
            const { data: queueEntryData, error: queueError } = await supabase
                .from('matchmaking_queue' as any)
                .insert({
                    user_id: user.id,
                    profile_id: profile.id,
                    elo: profile.elo,
                    region: profile.region,
                    status: 'searching'
                })
                .select() // Solicitamos el objeto completo para casteo
                .single();

            if (queueError) throw queueError;

            // ⚠️ CORRECCIÓN 7 (Línea 322): Castear a unknown primero para resolver el error 2352.
            const queueEntry = queueEntryData as unknown as MatchQueueEntry;

            setQueueId(queueEntry.id);
            queueIdRef.current = queueEntry.id;

            toast({
                title: "Buscando partida",
                description: `Buscando oponente en ${getRegionName(profile.region)}...`,
            });

            // Buscar inmediatamente pasando el queueId directamente
            findMatch(queueEntry.id);
            searchIntervalRef.current = setInterval(() => {
                findMatch();
                // Also check if we've been matched by someone else (polling fallback)
                checkIfMatched(queueEntry.id);
            }, 2000);

            const channel = supabase
                .channel('matchmaking-updates')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'matchmaking_queue',
                        filter: `id=eq.${queueEntry.id}`
                    },
                    (payload: any) => {
                        console.log('Queue update received:', payload);
                        const newEntry = payload.new as MatchQueueEntry;

                        if (newEntry.status === 'matched' && newEntry.match_id) {
                            console.log('Match found via realtime! Navigating to:', newEntry.match_id);
                            cleanupSearch();
                            toast({
                                title: "¡Match encontrado!",
                                description: "Redirigiendo a la sala de match...",
                            });
                            setTimeout(() => {
                                navigate(`/match/${newEntry.match_id}`);
                            }, 1000);
                        }
                    }
                )
                .subscribe((status) => {
                    console.log('Subscription status:', status);
                });

            subscriptionRef.current = channel;

        } catch (error) {
            console.error('Error iniciando búsqueda:', error);
            toast({
                title: "Error",
                description: "No se pudo iniciar la búsqueda.",
                variant: "destructive"
            });
            setIsSearching(false);
        }
    };

    const handleCancelSearch = async () => {
        const currentQ = queueId || queueIdRef.current;
        if (currentQ) {
            await supabase
                .from('matchmaking_queue' as any)
                .delete()
                .eq('id', currentQ);
        }

        cleanupSearch();

        toast({
            title: "Búsqueda cancelada",
            description: "Has salido de la cola de matchmaking.",
        });
    };

    // Cleanup seguro al desmontar
    useEffect(() => {
        return () => {
            const finalQueueId = queueIdRef.current;
            if (finalQueueId) {
                supabase
                    .from('matchmaking_queue' as any)
                    .delete()
                    .eq('id', finalQueueId)
                    .then(({ error }) => {
                        if (error) console.error("Error al limpiar cola:", error);
                    });
            }
            cleanupSearch();
        };
    }, []);

    if (loading || !profile) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <main className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <main className="container mx-auto px-4 pt-24 pb-12">
                <div className="max-w-2xl mx-auto space-y-6">
                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold mb-1">{profile.nickname}</h3>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Users className="h-4 w-4" />
                                        <span className="text-sm">{getRegionName(profile.region)}</span>
                                    </div>
                                </div>
                                <RankBadge rank={profile.rank} size="lg" />
                                <div className="text-right">
                                    <p className="text-2xl font-bold mt-2">{profile.elo}</p>
                                    <p className="text-xs text-muted-foreground">ELO Rating</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50">
                        <CardHeader>
                            <CardTitle className="text-center flex items-center justify-center gap-2">
                                <Search className="h-5 w-5" />
                                Búsqueda de Partida
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isSearching ? (
                                <div className="text-center space-y-6 py-8">
                                    <div className="relative">
                                        <Loader2 className="h-16 w-16 animate-spin mx-auto text-primary" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="h-12 w-12 rounded-full bg-primary/20 animate-ping" />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold mb-2">Buscando oponente...</h3>
                                        <p className="text-muted-foreground mb-1">
                                            {getSearchPhaseText()}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Rango ELO: {profile.elo - (ELO_RANGE_INITIAL + Math.floor(searchTime / 60) * 25)} - {profile.elo + (ELO_RANGE_INITIAL + Math.floor(searchTime / 60) * 25)}
                                        </p>

                                        <div className="flex items-center justify-center gap-4 text-sm mt-4">
                                            <Badge variant="secondary" className="gap-2">
                                                <Clock className="h-3 w-3" />
                                                {formatTime(searchTime)}
                                            </Badge>
                                            <Badge
                                                variant={searchPhase === 'region' ? 'default' : 'secondary'}
                                                className="gap-2"
                                            >
                                                <Users className="h-3 w-3" />
                                                {searchPhase === 'region' ? getRegionName(profile.region) : 'Global'}
                                            </Badge>
                                        </div>

                                        {searchTime >= REGION_EXPAND_TIME && searchTime < FULL_EXPAND_TIME && (
                                            <p className="text-xs text-yellow-500 mt-3">
                                                Expandiendo búsqueda a todas las regiones...
                                            </p>
                                        )}
                                        {searchTime >= FULL_EXPAND_TIME && (
                                            <p className="text-xs text-orange-500 mt-3">
                                                Buscando cualquier oponente disponible...
                                            </p>
                                        )}
                                    </div>

                                    <Button
                                        variant="destructive"
                                        onClick={handleCancelSearch}
                                        className="mt-4"
                                    >
                                        <XCircle className="h-4 w-4 mr-2" /> Cancelar búsqueda
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center space-y-6 py-8">
                                    <Trophy className="h-16 w-16 mx-auto text-primary opacity-50" />
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">¿Listo para competir?</h3>
                                        <p className="text-muted-foreground">
                                            Encuentra oponentes de tu nivel y demuestra tus habilidades
                                        </p>
                                    </div>
                                    <Button
                                        size="lg"
                                        onClick={handleStartSearch}
                                        className="mt-4 gap-2"
                                    >
                                        <Search className="h-5 w-5" />
                                        Buscar Ranked
                                    </Button>
                                </div>
                            )}

                            <div className="border-t border-border/50 pt-6 space-y-4">
                                <div>
                                    <h4 className="font-semibold mb-3 flex items-center justify-center gap-2">
                                        <Trophy className="h-4 w-4" />
                                        Cómo funciona
                                    </h4>
                                    <div className="space-y-2 text-sm text-muted-foreground text-center">
                                        <p>Te emparejaremos con jugadores de tu mismo rango de ELO.</p>
                                        <p>Primero buscamos en tu región (3 min), luego globalmente.</p>
                                    </div>
                                </div>

                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        Se sancionará prohibiendo jugar a todo aquel que sea reportado y se verifique su incumplimiento de las normas.
                                    </AlertDescription>
                                </Alert>

                                <div>
                                    <h4 className="font-semibold mb-3 flex items-center justify-center gap-2">
                                        <Shield className="h-4 w-4" />
                                        Normas
                                    </h4>
                                    <div className="space-y-2">
                                        {MATCHMAKING_RULES.map((rule, index) => (
                                            <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                                                <span className="text-primary font-bold mt-0.5">{index + 1}.</span>
                                                <span>{rule}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default Matchmaking;