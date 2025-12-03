import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import fondo from "@/assets/fondo.jpg";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Trophy, Clock, Users, AlertTriangle, Shield, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAdjacentRanks, getRankFromElo } from "@/lib/eloSystem";

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

// Rank-based matchmaking phases (no region filtering)
const PHASE_1_TIME = 120; // 0-2 min: Same rank only 120
const PHASE_2_TIME = 240; // 2-4 min: Adjacent ranks (±1) 240
const PHASE_3_TIME = 360; // 4-6 min: ±2 ranks (max expansion) 360

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
    const searchTimeRef = useRef(0);

    // Mantener queueIdRef sincronizado con el estado
    useEffect(() => {
        queueIdRef.current = queueId;
    }, [queueId]);

    // Keep searchTimeRef in sync with searchTime state
    useEffect(() => {
        searchTimeRef.current = searchTime;
    }, [searchTime]);

    // Timer para la búsqueda
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isSearching) {
            interval = setInterval(() => {
                setSearchTime((prev) => {
                    const newTime = prev + 1;

                    // Update phase based on rank expansion, not region
                    if (newTime >= PHASE_3_TIME) {
                        setSearchPhase('any'); // ±2 ranks
                    } else if (newTime >= PHASE_2_TIME) {
                        setSearchPhase('global'); // ±1 rank
                    } else {
                        setSearchPhase('region'); // Same rank
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
        if (!profile) return 'Buscando...';

        const currentTime = searchTime;
        const myRank = profile.rank || 'novato';

        if (currentTime < PHASE_1_TIME) {
            // 0-2 min: Same rank only
            return `Buscando en rango: ${myRank.toUpperCase()}`;
        } else if (currentTime < PHASE_2_TIME) {
            // 2-4 min: Adjacent ranks (±1)
            const adjacentRanks = getAdjacentRanks(myRank, 1);
            return `Buscando en rangos: ${adjacentRanks.map(r => r.toUpperCase()).join(', ')}`;
        } else {
            // 4-6 min: ±2 ranks
            const expandedRanks = getAdjacentRanks(myRank, 2);
            return `Buscando en rangos: ${expandedRanks.map(r => r.toUpperCase()).join(', ')}`;
        }
    };

    // Función de búsqueda de oponente (rank-based)
    const findMatch = async (currentQueueId?: string) => {
        const activeQueueId = currentQueueId || queueIdRef.current;
        if (!profile || !activeQueueId) {
            console.log('findMatch skipped - no profile or queueId', { profile: !!profile, activeQueueId });
            return;
        }

        try {
            const currentTime = searchTimeRef.current;
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
    };

    // Función para crear la partida usando RPC atómica (previene race conditions)
    // Esta función usa locks de base de datos para prevenir matches simultáneos
    const createMatch = async (opponent: MatchQueueEntry, currentQueueId?: string) => {
        const activeQueueId = currentQueueId || queueIdRef.current;
        if (!profile || !activeQueueId) return;

        console.log('Creating match with opponent via atomic RPC:', opponent);

        try {
            // Usar función RPC atómica que previene race conditions
            // Esta función usa FOR UPDATE locks y hace todo en una transacción
            const { data: rpcResult, error: rpcError } = await supabase.rpc('create_match_atomic', {
                p_player1_queue_id: activeQueueId,
                p_player2_queue_id: opponent.id,
                p_player1_profile_id: profile.id,
                p_player2_profile_id: opponent.profile_id,
                p_player1_elo: profile.elo,
                p_player2_elo: opponent.elo
            });

            if (rpcError) {
                console.error('Error calling create_match_atomic RPC:', rpcError);
                toast({
                    title: "Error",
                    description: "No se pudo crear el match. Intenta de nuevo.",
                    variant: "destructive"
                });
                return;
            }

            // La función RPC devuelve un array con un objeto
            const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

            if (!result || !result.success) {
                console.log('Match creation failed:', result?.error_message || 'Unknown error');
                // El oponente ya está en otro match, continuar buscando silenciosamente
                return;
            }

            const matchId = result.match_id;
            console.log('Match created successfully via RPC:', matchId);

            cleanupSearch();

            toast({
                title: "¡Match encontrado!",
                description: "Redirigiendo a la sala de match...",
            });
            setTimeout(() => {
                navigate(`/match/${matchId}`);
            }, 1000);
        } catch (error) {
            console.error('Error creating match:', error);
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
        <div className="h-screen bg-background relative overflow-hidden">
            {/* Background Image Layer */}
            <div
                className="fixed inset-0 top-16 z-0"
                style={{
                    backgroundImage: `url(${fondo})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'top',
                    opacity: 0.2
                }}
            />

            {/* Content Layer */}
            <div className="relative z-10">
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
                                            {/* Title removed */}
                                            <p className="text-muted-foreground mb-1">
                                                {getSearchPhaseText()}
                                            </p>
                                            {/* ELO range removed */}

                                            <div className="flex items-center justify-center gap-4 text-sm mt-4">
                                                <Badge variant="secondary" className="gap-2">
                                                    <Clock className="h-3 w-3" />
                                                    {formatTime(searchTime)}
                                                </Badge>
                                                {/* Region badge removed */}
                                            </div>

                                            {/* Expansion message 1 removed */}
                                            {/* Expansion message 2 removed */}
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
        </div>
    );
};

export default Matchmaking;