import { useEffect, useState, useRef, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Send, CheckCircle, XCircle, AlertTriangle, MessageSquare, Trophy, User } from "lucide-react";

// --- Tipos de Datos ---

interface Profile {
    id: string;
    nickname: string;
    elo: number;
}

// Interfaz que refleja las columnas corregidas de la tabla 'matches'
interface Match {
    id: string;
    player1_id: string; // Columna real en BD
    player2_id: string; // Columna real en BD
    elo_before_a: number;
    elo_before_b: number;
    result_a: 'win' | 'lose' | null; // Columna declarada por Jugador 1
    result_b: 'win' | 'lose' | null; // Columna declarada por Jugador 2
    winner_id: string | null;
    status: 'pending' | 'completed' | 'reported';
    profiles_player_a: Profile; // Alias que apunta a player1_id
    profiles_player_b: Profile; // Alias que apunta a player2_id
}

interface ChatMessage {
    id: number;
    created_at: string;
    match_id: string;
    sender_id: string;
    content: string;
    profiles: { nickname: string; id: string; };
}

// --- Constantes ---
const ELO_CHANGE = 10;

const MatchPage = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [match, setMatch] = useState<Match | null>(null);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const [myResult, setMyResult] = useState<'win' | 'lose' | null>(null);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportText, setReportText] = useState("");
    const [reportFile, setReportFile] = useState<File | null>(null);

    // Identificación del jugador usando las columnas player1_id y player2_id
    const isPlayer1 = userProfile?.id === match?.player1_id;
    const opponent = isPlayer1 ? match?.profiles_player_b : match?.profiles_player_a;
    const myId = userProfile?.id || '';

    // Obtener el resultado del oponente
    const opponentResult = isPlayer1 ? match?.result_b : match?.result_a;

    // Función para manejar el scroll al final del chat
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Cargar datos iniciales y configurar suscripciones
    useEffect(() => {
        if (!matchId) return;

        const fetchInitialData = async () => {
            const { data: { user: supabaseUser } } = await supabase.auth.getUser();
            if (!supabaseUser) {
                navigate("/auth");
                return;
            }

            // Obtener perfil
            const { data: profileData } = await supabase
                .from("profiles")
                .select("id, nickname, elo")
                .eq("user_id", supabaseUser.id)
                .single();

            if (!profileData) {
                setLoading(false);
                return;
            }
            setUserProfile(profileData as Profile);

            // ⚠️ Consulta de Match corregida: usa player1_id y player2_id
            const { data: matchData, error: matchError } = await supabase
                .from("matches")
                .select(`
                    *,
                    profiles_player_a:profiles!matches_player1_id_fkey(id, nickname, elo), 
                    profiles_player_b:profiles!matches_player2_id_fkey(id, nickname, elo)
                `)
                .eq("id", matchId)
                .single();

            if (matchError || !matchData) {
                toast({ title: "Error", description: "Partida no encontrada.", variant: "destructive" });
                navigate("/");
                return;
            }

            // ✅ CORRECCIÓN 1 (Línea 121): Casteo a unknown primero para resolver el error 2352
            const currentMatch = matchData as unknown as Match;
            setMatch(currentMatch);
            setLoading(false);

            // Inicializar mi resultado si ya está guardado
            const myResultInDb = currentMatch.player1_id === profileData.id
                ? currentMatch.result_a
                : currentMatch.result_b;

            if (myResultInDb) {
                setMyResult(myResultInDb);
            }
        };

        fetchInitialData();

        // 2. Suscripción al chat (tiempo real)
        // ✅ CORRECCIÓN 2 (Línea 181): Usar 'as any' porque 'messages' no está tipado automáticamente
        const chatChannel = supabase
            .channel(`match:${matchId}-chat`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new as ChatMessage]);
                }
            )
            .subscribe();

        // 3. Suscripción al estado de la partida
        const matchChannel = supabase
            .channel(`match:${matchId}-state`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
                (payload) => {
                    const newMatch = payload.new as Match;
                    setMatch(newMatch);

                    // Si el match se completa, redirigir
                    if (newMatch.status === 'completed') {
                        toast({ title: "Partida Finalizada", description: "El resultado ha sido validado.", variant: "default" });
                        setTimeout(() => navigate("/"), 2000);
                    }
                    if (newMatch.status === 'reported') {
                        toast({ title: "¡Partida reportada!", description: "El resultado no fue consensuado.", variant: "destructive" });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(matchChannel);
        };
    }, [matchId, navigate, toast]);

    // Cargar mensajes históricos del chat
    useEffect(() => {
        const fetchMessages = async () => {
            // ✅ CORRECCIÓN 3 (Línea 202): Usar 'as any'
            const { data, error } = await supabase
                .from('messages' as any)
                .select(`
                    *,
                    profiles(id, nickname)
                `)
                .eq('match_id', matchId)
                .order('created_at', { ascending: true });

            if (!error) {
                // ✅ CORRECCIÓN 4 (Línea 190, 207): Usar 'as unknown as ChatMessage[]' para casteo seguro
                setMessages(data as unknown as ChatMessage[]);
            }
        };
        fetchMessages();
    }, [matchId]);

    // Manejar envío de mensajes
    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === "" || !matchId || !userProfile) return;

        // ✅ CORRECCIÓN 5 (Línea 218): Usar 'as any' para inserción en 'messages'
        const { error } = await supabase
            .from('messages' as any)
            .insert({
                match_id: matchId,
                sender_id: userProfile.id,
                content: newMessage.trim(),
            });

        if (error) {
            toast({ title: "Error", description: "No se pudo enviar el mensaje.", variant: "destructive" });
        } else {
            setNewMessage("");
        }
    };

    // ⚠️ Manejar la selección del resultado (usa result_a y result_b)
    const handleResultSelection = (result: 'win' | 'lose') => {
        if (!match || match.status !== 'pending') return;
        setMyResult(result);

        // Determinamos qué columna actualizar: 'result_a' si soy Jugador 1, 'result_b' si soy Jugador 2.
        const myKey = isPlayer1 ? 'result_a' : 'result_b';

        const updateResult = async () => {
            // ✅ CORRECCIÓN 6 (Línea 239): Usar 'as any' para el update con key dinámica
            const { error } = await supabase
                .from('matches')
                .update({ [myKey]: result } as any) // Actualiza result_a o result_b
                .eq('id', matchId);

            if (error) {
                toast({ title: "Error", description: "No se pudo guardar tu resultado.", variant: "destructive" });
                setMyResult(null);
            } else {
                toast({ title: "Resultado guardado", description: `Has marcado ${result === 'win' ? 'victoria' : 'derrota'}. El ELO se actualizará automáticamente.` });
            }
        };

        updateResult();
    };

    // Manejar el Reporte
    const handleReport = async () => {
        if (!matchId || !userProfile || !match) return;

        // Lógica de subida de archivo (asumiendo bucket 'reports')
        let filePath: string | null = null;
        if (reportFile) {
            const fileExt = reportFile.name.split('.').pop();
            filePath = `${matchId}/${userProfile.id}-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('reports')
                .upload(filePath, reportFile);

            if (uploadError) {
                toast({ title: "Error", description: "Error subiendo la captura. Inténtalo de nuevo.", variant: "destructive" });
                return;
            }
        }

        // Crear una nueva entrada de reporte
        // ✅ CORRECCIÓN 7 (Línea 262): Usar 'as any' para inserción en 'reports'
        const { error: reportError } = await supabase
            .from('reports' as any)
            .insert({
                match_id: matchId,
                reporter_id: userProfile.id,
                reason: reportText,
                screenshot_url: filePath,
            });

        if (reportError) {
            toast({ title: "Error", description: "Error al registrar el reporte.", variant: "destructive" });
            return;
        }

        // Marcar el match como reportado (El trigger de la BD ya hace esto si hay discrepancia)
        if (match.status === 'pending') {
            await supabase
                .from('matches')
                .update({ status: 'reported' })
                .eq('id', matchId);
        }


        toast({ title: "Reporte Enviado", description: "El caso será revisado por un administrador.", variant: "destructive" });
        setIsReportOpen(false);
    };

    // Lógica de renderizado
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
                {/* Columna de Chat */}
                <Card className="lg:col-span-2 flex flex-col h-[70vh]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Chat de Partida</CardTitle>
                        <AlertTitle className="text-sm font-normal text-muted-foreground">
                            Comunícate con tu rival ({opponent.nickname}) para iniciar o coordinar.
                        </AlertTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 border-t" ref={chatContainerRef}>
                        {messages.length === 0 ? (
                            <p className="text-center text-muted-foreground italic mt-10">Inicia la conversación...</p>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender_id === myId ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[70%] p-3 rounded-xl shadow ${msg.sender_id === myId
                                            ? 'bg-primary text-primary-foreground rounded-br-none'
                                            : 'bg-secondary text-secondary-foreground rounded-bl-none'
                                            }`}
                                    >
                                        <div className="font-semibold text-xs mb-1">
                                            {msg.sender_id === myId ? 'Tú' : msg.profiles.nickname}
                                        </div>
                                        <p>{msg.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                    <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
                        <Input
                            placeholder="Escribe un mensaje..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={match.status !== 'pending'}
                        />
                        <Button type="submit" disabled={newMessage.trim() === "" || match.status !== 'pending'}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </Card>

                {/* Columna de Resultados y Reporte */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /> Declarar Resultado</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">Selecciona el resultado final del enfrentamiento:</p>

                            <div className="flex gap-4">
                                <Button
                                    variant={myResult === 'win' ? "default" : "outline"}
                                    onClick={() => handleResultSelection('win')}
                                    disabled={match.status !== 'pending'}
                                    className="flex-1 gap-2"
                                >
                                    <Trophy className="h-4 w-4" /> Yo Gané
                                </Button>
                                <Button
                                    variant={myResult === 'lose' ? "destructive" : "outline"}
                                    onClick={() => handleResultSelection('lose')}
                                    disabled={match.status !== 'pending'}
                                    className="flex-1 gap-2"
                                >
                                    <XCircle className="h-4 w-4" /> Yo Perdí
                                </Button>
                            </div>

                            {myResult && match.status === 'pending' && (
                                <Alert className="mt-4">
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertTitle>Resultado Seleccionado</AlertTitle>
                                    <AlertDescription>
                                        {opponentResult
                                            ? `El oponente **${opponent.nickname}** ha marcado su resultado. Esperando resolución automática...`
                                            : `Esperando a que **${opponent.nickname}** declare su resultado.`
                                        }
                                    </AlertDescription>
                                </Alert>
                            )}

                            {match.status === 'completed' && (
                                <Alert variant="default" className="bg-green-100 border-green-500 text-green-700">
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertTitle>FINALIZADA</AlertTitle>
                                    <AlertDescription>
                                        Ganador: **{match.winner_id === myId ? userProfile.nickname : opponent.nickname}**. ELO actualizado.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Reportar Partida</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Si no llegáis a un acuerdo sobre el resultado o hay trampas, usa este botón.
                            </p>

                            <Button
                                variant="destructive"
                                className="w-full gap-2"
                                onClick={() => setIsReportOpen(!isReportOpen)}
                                disabled={match.status !== 'pending'}
                            >
                                <AlertTriangle className="h-4 w-4" /> {isReportOpen ? 'Cerrar Formulario' : 'Abrir Reporte'}
                            </Button>

                            {isReportOpen && (
                                <div className="space-y-4 border p-4 rounded-lg mt-4">
                                    <h4 className="font-semibold">Detalles del Reporte</h4>
                                    <Textarea
                                        placeholder="Describe el problema (ej: trampa, abandono, etc.)"
                                        value={reportText}
                                        onChange={(e) => setReportText(e.target.value)}
                                        rows={3}
                                    />
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setReportFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                    <Button onClick={handleReport} className="w-full">
                                        Enviar Reporte
                                    </Button>
                                </div>
                            )}

                            {match.status === 'reported' && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Reportada</AlertTitle>
                                    <AlertDescription>
                                        Esta partida está bajo revisión por un administrador.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default MatchPage;