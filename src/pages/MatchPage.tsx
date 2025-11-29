// MatchPage.fixed.tsx
import { useEffect, useState, useRef, FormEvent, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Send, CheckCircle, XCircle, AlertTriangle, MessageSquare, Trophy } from "lucide-react";
import { calculateEloChange, checkRankChange, getRankFromElo } from "@/lib/eloSystem";
import "./MatchPage.css";

interface Profile {
    id: string;
    nickname: string;
    elo: number;
    avatar_url?: string | null;
}

interface Match {
    id: string;
    player1_id: string;
    player2_id: string;
    player1_elo: number;
    player2_elo: number;
    result_a: 'win' | 'lose' | null;
    result_b: 'win' | 'lose' | null;
    winner_id: string | null;
    status: 'pending' | 'completed' | 'reported';
    first_result_at: string | null;
    profiles_player_a: Profile;
    profiles_player_b: Profile;
}

const RESULT_TIMEOUT_MINUTES = 10;

interface ChatMessage {
    id: string;
    created_at: string;
    match_id: string;
    sender_id: string;
    content: string;
    profiles: { nickname: string; id: string; avatar_url: string | null; };
}

const MatchPage = () => {
    const { id: matchId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [match, setMatch] = useState<Match | null>(null);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    const [myResult, setMyResult] = useState<'win' | 'lose' | null>(null);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportText, setReportText] = useState("");
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [timeoutExpired, setTimeoutExpired] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number | null>(null);

    // Helpers
    const isPlayer1 = userProfile?.id === match?.player1_id;
    const opponent = isPlayer1 ? match?.profiles_player_b : match?.profiles_player_a;
    const myId = userProfile?.id || '';
    
    // Use result_a/result_b as the actual column names
    const myResultInMatch = isPlayer1 ? match?.result_a : match?.result_b;
    const opponentResult = isPlayer1 ? match?.result_b : match?.result_a;

    // Scroll to bottom on messages change
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Timer for 10 minute timeout
    useEffect(() => {
        if (!match?.first_result_at || match.status !== 'pending') return;

        const checkTimeout = () => {
            const firstResultTime = new Date(match.first_result_at!).getTime();
            const now = Date.now();
            const elapsed = now - firstResultTime;
            const timeoutMs = RESULT_TIMEOUT_MINUTES * 60 * 1000;
            const remaining = timeoutMs - elapsed;

            if (remaining <= 0) {
                setTimeoutExpired(true);
                setRemainingTime(0);
            } else {
                setRemainingTime(Math.ceil(remaining / 1000));
            }
        };

        checkTimeout();
        const interval = setInterval(checkTimeout, 1000);

        return () => clearInterval(interval);
    }, [match?.first_result_at, match?.status]);

    // 1) Cargar perfil y match
    useEffect(() => {
        if (!matchId) return;

        let isMounted = true;

        const fetchMatchAndProfile = async () => {
            setLoading(true);
            try {
                const { data: { user: supabaseUser } } = await supabase.auth.getUser();
                if (!supabaseUser) {
                    navigate("/auth");
                    return;
                }

                const { data: profileData, error: pErr } = await supabase
                    .from("profiles")
                    .select("id, nickname, elo, avatar_url")
                    .eq("user_id", supabaseUser.id)
                    .single();

                if (pErr || !profileData) {
                    toast({ title: "Error", description: "No se pudo cargar tu perfil.", variant: "destructive" });
                    setLoading(false);
                    return;
                }
                if (!isMounted) return;
                setUserProfile(profileData as Profile);

                const { data: matchData, error: matchError } = await supabase
                    .from("matches")
                    .select(`
              *,
              profiles_player_a:profiles!matches_player1_id_fkey(id, nickname, elo, avatar_url),
              profiles_player_b:profiles!matches_player2_id_fkey(id, nickname, elo, avatar_url)
          `)
                    .eq("id", matchId)
                    .single();

                if (matchError || !matchData) {
                    toast({ title: "Error", description: "Partida no encontrada.", variant: "destructive" });
                    navigate("/");
                    return;
                }

                setMatch(matchData as unknown as Match);

                // Inicializar myResult si ya existe (usando result_a/result_b)
                const isUserPlayer1 = matchData.player1_id === profileData.id;
                const myResultInDb = isUserPlayer1 ? matchData.result_a : matchData.result_b;

                if (myResultInDb) setMyResult(myResultInDb);
            } catch (err) {
                console.error("fetchMatchAndProfile error:", err);
                toast({ title: "Error", description: "Error cargando partida.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        fetchMatchAndProfile();

        return () => { isMounted = false; };
    }, [matchId, navigate, toast]);

    // 2) Cargar mensajes iniciales
    useEffect(() => {
        if (!matchId) return;
        let mounted = true;

        const fetchMessages = async () => {
            try {
                const { data, error } = await supabase
                    .from('messages')
                    .select(`
            *,
            profiles(id, nickname, avatar_url)
          `)
                    .eq('match_id', matchId)
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error("fetchMessages error:", error);
                    return;
                }
                if (!mounted) return;
                setMessages(data as ChatMessage[]);
            } catch (err) {
                console.error("fetchMessages unexpected error:", err);
            }
        };

        fetchMessages();

        return () => { mounted = false; };
    }, [matchId]);

    // 3) Suscripciones realtime (chat + match state)
    useEffect(() => {
        if (!matchId) return;

        const chatChannel = supabase
            .channel(`match:${matchId}-chat`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
                async (payload) => {
                    // payload.new es el nuevo message row pero no incluye profiles
                    const newMsg = payload.new as any;
                    
                    // Buscar el perfil del sender
                    const { data: senderData } = await supabase
                        .from('profiles')
                        .select('id, nickname, avatar_url')
                        .eq('id', newMsg.sender_id)
                        .single();
                    
                    const senderProfile = senderData || { 
                        id: newMsg.sender_id, 
                        nickname: 'Usuario', 
                        avatar_url: null 
                    };
                    
                    // Evita duplicados y agrega el mensaje
                    setMessages((prev) => {
                        const exists = prev.some(m => String(m.id) === String(newMsg.id));
                        if (exists) return prev;
                        
                        const messageWithProfile: ChatMessage = {
                            ...newMsg,
                            profiles: senderProfile
                        };
                        
                        return [...prev, messageWithProfile];
                    });
                }
            );

        const matchChannel = supabase
            .channel(`match:${matchId}-state`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
                (payload) => {
                    const newMatch = payload.new as Match;
                    setMatch(newMatch);
                    if (newMatch.status === 'completed') {
                        toast({ title: "Partida Finalizada", description: "El resultado ha sido validado.", variant: "default" });
                        setTimeout(() => navigate("/"), 2000);
                    } else if (newMatch.status === 'reported') {
                        toast({ title: "¡Partida reportada!", description: "El resultado no fue consensuado.", variant: "destructive" });
                    }
                }
            );

        // Suscribir ambos canales
        const subscribeAll = async () => {
            try {
                await chatChannel.subscribe();
                await matchChannel.subscribe();
            } catch (err) {
                console.error("subscribe error", err);
            }
        };
        subscribeAll();

        return () => {
            // cleanup: eliminar canales correctamente
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(matchChannel);
        };
    }, [matchId, navigate, toast]);

    // Handlers (definidos en el scope del componente)
    const handleSendMessage = useCallback(async (e?: FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !matchId || !userProfile) return;

        try {
            // Inserta mensaje en la tabla messages (el trigger/replicación dará el evento a realtime)
            const { error } = await supabase
                .from('messages')
                .insert({
                    match_id: matchId,
                    sender_id: userProfile.id,
                    content: newMessage.trim(),
                });

            if (error) {
                toast({ title: "Error", description: "No se pudo enviar el mensaje.", variant: "destructive" });
                return;
            }
            setNewMessage("");
            // No hace falta añadir manualmente si la suscripción funciona; pero añadirlo mejora UX en caso de latencia:
            // setMessages(prev => [...prev, { id: Date.now(), created_at: new Date().toISOString(), match_id: matchId, sender_id: userProfile.id, content: newMessage.trim(), profiles: { id: userProfile.id, nickname: userProfile.nickname, avatar_url: userProfile.avatar_url } }]);
        } catch (err) {
            console.error("handleSendMessage:", err);
            toast({ title: "Error", description: "Error al enviar mensaje.", variant: "destructive" });
        }
    }, [newMessage, matchId, userProfile, toast]);

    const handleResultSelection = async (result: 'win' | 'lose') => {
        if (!matchId || !userProfile || !match) return;

        // Check if timeout expired and user hasn't submitted yet
        if (timeoutExpired && !myResultInMatch) {
            toast({ 
                title: "Tiempo agotado", 
                description: "El tiempo para declarar resultado ha expirado.", 
                variant: "destructive" 
            });
            navigate("/");
            return;
        }

        // Optimistic update
        setMyResult(result);

        const myKey = isPlayer1 ? 'result_a' : 'result_b';

        try {
            // Build update payload
            const updatePayload: any = { [myKey]: result };
            
            // If this is the first result, set the timestamp
            if (!match.first_result_at) {
                updatePayload.first_result_at = new Date().toISOString();
            }

            // 1. Update my result
            const { error } = await supabase
                .from('matches')
                .update(updatePayload)
                .eq('id', matchId);

            if (error) throw error;

            toast({ title: "Resultado guardado", description: `Has marcado ${result === 'win' ? 'victoria' : 'derrota'}.` });

            // 2. Check if we can finalize (opponent already submitted)
            // Re-fetch match to get latest results from DB
            const { data: updatedMatch } = await supabase
                .from('matches')
                .select('result_a, result_b, status')
                .eq('id', matchId)
                .single();

            const currentOpponentResult = isPlayer1 
                ? (updatedMatch as any)?.result_b 
                : (updatedMatch as any)?.result_a;

            if (currentOpponentResult) {
                let newStatus = '';

                // Check for conflict (both claim win or both claim lose)
                if (
                    (result === 'win' && currentOpponentResult === 'win') ||
                    (result === 'lose' && currentOpponentResult === 'lose')
                ) {
                    newStatus = 'reported';

                    // Get user_id (not profile_id) for the report
                    const { data: { user: currentUser } } = await supabase.auth.getUser();
                    
                    if (!currentUser) {
                        console.error('No authenticated user found');
                        toast({
                            title: "Error",
                            description: "No se pudo identificar al usuario para crear el reporte.",
                            variant: "destructive"
                        });
                    } else {
                        // Auto-create report for conflict
                        console.log('Creating conflict report...', { matchId, reporterId: currentUser.id });
                        const { data: reportData, error: reportError } = await supabase
                            .from('reports')
                            .insert({
                                match_id: matchId,
                                reporter_id: currentUser.id, // Use user_id, not profile_id
                                description: `Reporte automático: Conflicto de resultados. Tú declaraste ${result === 'win' ? 'victoria' : 'derrota'}, el rival declaró ${currentOpponentResult === 'win' ? 'victoria' : 'derrota'}.`,
                                status: 'pending'
                            } as any)
                            .select();

                        if (reportError) {
                            console.error("Error creating auto-report:", reportError);
                            toast({
                                title: "Error",
                                description: `Error al crear reporte: ${reportError.message}`,
                                variant: "destructive"
                            });
                        } else {
                            console.log('Report created successfully:', reportData);
                        }
                    }

                    toast({ 
                        title: "Conflicto detectado", 
                        description: "Los resultados no coinciden. Se ha generado un reporte automático.", 
                        variant: "destructive" 
                    });
                } else if (
                    (result === 'win' && currentOpponentResult === 'lose') ||
                    (result === 'lose' && currentOpponentResult === 'win')
                ) {
                    // Results match - finalize and calculate ELO
                    newStatus = 'completed';
                    
                    // Determine winner and loser
                    const iAmWinner = result === 'win';
                    const winnerId = iAmWinner ? userProfile.id : opponent?.id;
                    const winnerElo = iAmWinner ? match.player1_elo : match.player2_elo;
                    const loserElo = iAmWinner ? match.player2_elo : match.player1_elo;
                    
                    // Get current profiles with all stats
                    const { data: winnerProfileData, error: winnerProfileError } = await supabase
                        .from('profiles')
                        .select('current_streak, elo, wins, games_played')
                        .eq('id', winnerId)
                        .single();
                    
                    const loserId = iAmWinner ? opponent?.id : userProfile.id;
                    const { data: loserProfileData, error: loserProfileError } = await supabase
                        .from('profiles')
                        .select('current_streak, elo, wins, games_played')
                        .eq('id', loserId)
                        .single();
                    
                    if (winnerProfileError) {
                        console.error('Error fetching winner profile:', winnerProfileError);
                    }
                    if (loserProfileError) {
                        console.error('Error fetching loser profile:', loserProfileError);
                    }
                    
                    const winnerStreak = winnerProfileData?.current_streak || 0;
                    const loserStreak = loserProfileData?.current_streak || 0;
                    
                    // Calculate ELO changes
                    const eloResult = calculateEloChange(
                        winnerProfileData?.elo || winnerElo || 600,
                        loserProfileData?.elo || loserElo || 600,
                        winnerStreak,
                        loserStreak
                    );
                    
                    // Check for rank changes
                    const winnerRankChange = checkRankChange(
                        winnerProfileData?.elo || winnerElo || 600,
                        eloResult.newWinnerElo
                    );
                    const loserRankChange = checkRankChange(
                        loserProfileData?.elo || loserElo || 600,
                        eloResult.newLoserElo
                    );
                    
                    // Get current stats (ensure we have numbers)
                    const winnerCurrentWins = Number(winnerProfileData?.wins) || 0;
                    const winnerCurrentGames = Number(winnerProfileData?.games_played) || 0;
                    const loserCurrentGames = Number(loserProfileData?.games_played) || 0;
                    
                    console.log('Updating profiles:', {
                        winner: { id: winnerId, wins: winnerCurrentWins, games: winnerCurrentGames },
                        loser: { id: loserId, games: loserCurrentGames }
                    });
                    
                    // Update winner profile
                    const { error: winnerUpdateError } = await supabase
                        .from('profiles')
                        .update({
                            elo: eloResult.newWinnerElo,
                            rank: winnerRankChange.newRank,
                            wins: winnerCurrentWins + 1,
                            games_played: winnerCurrentGames + 1,
                            current_streak: winnerStreak >= 0 ? winnerStreak + 1 : 1
                        } as any)
                        .eq('id', winnerId);
                    
                    if (winnerUpdateError) {
                        console.error('Error updating winner profile:', winnerUpdateError);
                    }
                    
                    // Update loser profile
                    const { error: loserUpdateError } = await supabase
                        .from('profiles')
                        .update({
                            elo: eloResult.newLoserElo,
                            rank: loserRankChange.newRank,
                            games_played: loserCurrentGames + 1,
                            current_streak: loserStreak <= 0 ? loserStreak - 1 : -1
                        } as any)
                        .eq('id', loserId);
                    
                    if (loserUpdateError) {
                        console.error('Error updating loser profile:', loserUpdateError);
                    }
                    
                    // Show appropriate toast
                    if (iAmWinner) {
                        let message = `+${eloResult.winnerGain} ELO`;
                        if (winnerRankChange.promoted) {
                            message += ` ¡Subiste a ${winnerRankChange.newRank.toUpperCase()}!`;
                        }
                        toast({ title: "¡Victoria!", description: message });
                    } else {
                        let message = `-${eloResult.loserLoss} ELO`;
                        if (loserRankChange.demoted) {
                            message += ` Bajaste a ${loserRankChange.newRank.toUpperCase()}`;
                        }
                        toast({ title: "Derrota", description: message, variant: "destructive" });
                    }
                }

                if (newStatus) {
                    const { error: finalError } = await supabase
                        .from('matches')
                        .update({ status: newStatus } as any)
                        .eq('id', matchId);

                    if (finalError) console.error("Error finalizing match:", finalError);
                }
            } else {
                // First to submit - opponent has 10 minutes
                toast({ 
                    title: "Resultado guardado", 
                    description: "Tu rival tiene 10 minutos para confirmar el resultado." 
                });
            }

            // Always navigate away after submitting result
            navigate("/");

        } catch (err) {
            console.error("handleResultSelection error:", err);
            toast({ title: "Error", description: "No se pudo guardar tu resultado.", variant: "destructive" });
            setMyResult(null);
        }
    };

    const handleReport = async () => {
        if (!matchId || !userProfile || !match) return;

        try {
            let filePath: string | null = null;
            if (reportFile) {
                const ext = reportFile.name.split('.').pop();
                filePath = `${matchId}/${userProfile.id}-${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage.from('reports').upload(filePath, reportFile);
                if (uploadError) {
                    toast({ title: "Error", description: "Error subiendo la captura.", variant: "destructive" });
                    return;
                }
            }

            const { error: reportError } = await supabase.from('reports').insert({
                match_id: matchId,
                reporter_id: userProfile.id,
                description: reportText, // Changed from reason to description to match schema
                evidence_url: filePath, // Changed from screenshot_url to evidence_url
                status: 'pending'
            } as any);

            if (reportError) {
                toast({ title: "Error", description: "Error al registrar el reporte.", variant: "destructive" });
                return;
            }

            if (match.status === 'pending') {
                await supabase.from('matches').update({ status: 'reported' }).eq('id', matchId);
            }

            toast({ title: "Reporte Enviado", description: "El caso será revisado por un administrador." });
            setIsReportOpen(false);
            setReportText("");
            setReportFile(null);
            
            // Redirect to index after reporting
            navigate("/");
        } catch (err) {
            console.error("handleReport", err);
            toast({ title: "Error", description: "Error enviando reporte.", variant: "destructive" });
        }
    };

    // Renders
    if (loading || !match || !userProfile || !opponent) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="py-4 border-b border-border">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-primary">
                        <Trophy className="h-5 w-5" /> Partida vs {opponent.nickname}
                    </h1>
                    <Button variant="ghost" onClick={() => navigate("/")}>Volver al Inicio</Button>
                </div>
            </header>

            <main className="container mx-auto px-4 pt-8 pb-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chat column */}
                <Card className="lg:col-span-2 flex flex-col h-[70vh]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Chat de Partida</CardTitle>
                        <AlertTitle className="text-sm font-normal text-muted-foreground">
                            Comunícate con tu rival ({opponent.nickname}) para iniciar o coordinar.
                        </AlertTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 border-t bg-muted/20 chat-scrollbar" ref={chatContainerRef}>
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <MessageSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
                                <p className="text-center text-muted-foreground italic">Inicia la conversación...</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMyMessage = msg.sender_id === myId;
                                const avatarUrl = isMyMessage ? userProfile?.avatar_url : msg.profiles.avatar_url;
                                const displayName = isMyMessage ? 'Tú' : msg.profiles.nickname;
                                return (
                                    <div key={msg.id} className={`flex gap-2 ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className="flex-shrink-0">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover ring-2 ring-background" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center ring-2 ring-background">
                                                    <span className="text-xs font-bold text-primary-foreground">{displayName.charAt(0).toUpperCase()}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col max-w-[70%]">
                                            <div className={`px-4 py-2 rounded-2xl shadow-sm ${isMyMessage ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card text-card-foreground border rounded-bl-sm'}`}>
                                                <div className={`font-semibold text-xs mb-1 ${isMyMessage ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                                    {displayName}
                                                </div>
                                                <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                                                <div className={`text-[10px] mt-1 ${isMyMessage ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>

                    <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
                        <Input placeholder="Escribe un mensaje..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                        <Button type="submit" disabled={newMessage.trim() === ""}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </Card>

                {/* Right column: Resultados y Reporte */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Resultado</CardTitle>
                        <AlertTitle className="text-sm font-normal text-muted-foreground">
                            Reporta el resultado de la partida. Si ambos coinciden, la partida finalizará.
                        </AlertTitle>
                    </CardHeader>
                    
                    {/* ELO Preview */}
                    {match.status === 'pending' && !myResult && (
                        <div className="px-6 pb-2">
                            <div className="bg-muted/30 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground mb-2">Puntos en juego</p>
                                <div className="flex justify-center gap-6">
                                    <div>
                                        <span className="text-green-500 font-bold">+{Math.round(20 * (1 - 1 / (1 + Math.pow(10, ((match.player2_elo || 600) - (match.player1_elo || 600)) / 400))))}</span>
                                        <p className="text-xs text-muted-foreground">Victoria</p>
                                    </div>
                                    <div>
                                        <span className="text-red-500 font-bold">-{Math.round(20 * (1 / (1 + Math.pow(10, ((match.player2_elo || 600) - (match.player1_elo || 600)) / 400))))}</span>
                                        <p className="text-xs text-muted-foreground">Derrota</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <CardContent className="space-y-4">
                        {match.status === 'completed' ? (
                            <Alert className="bg-green-500/10 border-green-500/50">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <AlertTitle>Partida Finalizada</AlertTitle>
                                <AlertDescription>
                                    Ganador: {match.winner_id === userProfile.id ? 'Tú' : (opponent?.nickname || 'Rival')}
                                </AlertDescription>
                            </Alert>
                        ) : match.status === 'reported' ? (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Conflicto</AlertTitle>
                                <AlertDescription>
                                    Los resultados no coinciden. Un admin revisará el caso.
                                </AlertDescription>
                            </Alert>
                        ) : timeoutExpired && !myResultInMatch ? (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Tiempo agotado</AlertTitle>
                                <AlertDescription>
                                    El tiempo para declarar resultado ha expirado. 
                                    El rival ya declaró su resultado.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                {/* Show remaining time if opponent submitted first */}
                                {match.first_result_at && !myResultInMatch && remainingTime !== null && remainingTime > 0 && (
                                    <Alert className="mb-4">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Tu rival ya declaró resultado</AlertTitle>
                                        <AlertDescription>
                                            Tienes <span className="font-bold">{Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}</span> para declarar tu resultado o reportar.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant={myResult === 'win' ? "default" : "outline"}
                                        className={`h-24 flex flex-col gap-2 ${myResult === 'win' ? 'bg-green-600 hover:bg-green-700' : 'hover:border-green-500 hover:text-green-500'}`}
                                        onClick={() => handleResultSelection('win')}
                                        disabled={!!myResult || timeoutExpired}
                                    >
                                        <Trophy className="h-8 w-8" />
                                        <span>Victoria</span>
                                    </Button>
                                    <Button
                                        variant={myResult === 'lose' ? "default" : "outline"}
                                        className={`h-24 flex flex-col gap-2 ${myResult === 'lose' ? 'bg-red-600 hover:bg-red-700' : 'hover:border-red-500 hover:text-red-500'}`}
                                        onClick={() => handleResultSelection('lose')}
                                        disabled={!!myResult || timeoutExpired}
                                    >
                                        <XCircle className="h-8 w-8" />
                                        <span>Derrota</span>
                                    </Button>
                                </div>
                                {myResult && (
                                    <p className="text-center text-sm text-muted-foreground">
                                        Has reportado: <span className="font-bold">{myResult === 'win' ? 'Victoria' : 'Derrota'}</span>.
                                        Esperando confirmación del rival...
                                    </p>
                                )}
                            </>
                        )}

                        <div className="pt-4 border-t">
                            <Button variant="link" className="text-muted-foreground p-0 h-auto" onClick={() => setIsReportOpen(!isReportOpen)}>
                                ¿Problemas? Reportar incidencia
                            </Button>
                        </div>

                        {isReportOpen && (
                            <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2">
                                <Textarea
                                    placeholder="Describe el problema..."
                                    value={reportText}
                                    onChange={(e) => setReportText(e.target.value)}
                                />
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                                />
                                <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setIsReportOpen(false)}>Cancelar</Button>
                                    <Button size="sm" onClick={handleReport} disabled={!reportText.trim()}>Enviar Reporte</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default MatchPage;
