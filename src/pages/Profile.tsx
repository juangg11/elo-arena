import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User, Edit, Save, X, Upload, Loader2, Trophy } from "lucide-react";
import Footer from "@/components/Footer";

const DiscordIcon = () => (
    <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
);

interface ProfileData {
    nickname: string;
    elo: number;
    rank: string;
    region: string;
    games_played: number;
    wins: number;
    avatar_url: string | null;
    discord: string | null;
}

const Profile = () => {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const [editForm, setEditForm] = useState({
        nickname: "",
        avatarUrl: "",
        discord: "",
    });

    useEffect(() => {
        fetchProfile();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                navigate("/auth");
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    // Subscribe to profile changes for real-time updates
    useEffect(() => {
        if (!profile?.id) return;

        const profileChannel = supabase
            .channel(`profile-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${profile.id}`
                },
                () => {
                    // Refresh profile when it changes
                    fetchProfile();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileChannel);
        };
    }, [profile?.id]);

    const fetchProfile = async () => {
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
            setProfile(profileData);
            setEditForm({
                nickname: profileData.nickname,
                avatarUrl: profileData.avatar_url || "",
                discord: profileData.discord || "",
            });
        }

        setLoading(false);
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (!file.type.startsWith('image/')) {
            toast({
                title: "Error",
                description: "Solo se permiten imágenes",
                variant: "destructive"
            });
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast({
                title: "Error",
                description: "La imagen debe ser menor a 2MB",
                variant: "destructive"
            });
            return;
        }

        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('profiles')
                .getPublicUrl(filePath);

            setEditForm(prev => ({ ...prev, avatarUrl: publicUrl }));

            toast({
                title: "¡Éxito!",
                description: "Avatar subido correctamente",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Error al subir la imagen",
                variant: "destructive"
            });
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!editForm.nickname.trim()) {
            toast({
                title: "Error",
                description: "El nombre de usuario es obligatorio",
                variant: "destructive"
            });
            return;
        }

        if (editForm.nickname.length < 3 || editForm.nickname.length > 20) {
            toast({
                title: "Error",
                description: "El nombre debe tener entre 3 y 20 caracteres",
                variant: "destructive"
            });
            return;
        }

        setSaving(true);

        try {
            if (editForm.nickname !== profile?.nickname) {
                const { data: existingNickname } = await supabase
                    .from("profiles")
                    .select("nickname")
                    .eq("nickname", editForm.nickname)
                    .single();

                if (existingNickname) {
                    toast({
                        title: "Error",
                        description: "Este nombre de usuario ya está en uso",
                        variant: "destructive"
                    });
                    setSaving(false);
                    return;
                }
            }

            const { error } = await supabase
                .from("profiles")
                .update({
                    nickname: editForm.nickname,
                    avatar_url: editForm.avatarUrl || null,
                    discord: editForm.discord || null,
                })
                .eq("user_id", user.id);

            if (error) throw error;

            toast({
                title: "¡Perfil actualizado!",
                description: "Tus cambios han sido guardados exitosamente",
            });

            setIsEditing(false);
            await fetchProfile();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Error al actualizar el perfil",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditForm({
            nickname: profile?.nickname || "",
            avatarUrl: profile?.avatar_url || "",
            discord: profile?.discord || "",
        });
        setIsEditing(false);
    };

    if (loading || !profile) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <Navbar />
                <main className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center flex-1">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
                <Footer />
            </div>
        );
    }

    const winrate = profile.games_played > 0
        ? Math.round((profile.wins / profile.games_played) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            <main className="container mx-auto px-4 pt-24 pb-12 flex-1">
                <div className="max-w-4xl mx-auto space-y-6">
                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-2xl">Mi Perfil</CardTitle>
                            {!isEditing ? (
                                <Button onClick={() => setIsEditing(true)} className="gap-2">
                                    <Edit className="h-4 w-4" />
                                    Editar Perfil
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                                        <Save className="h-4 w-4" />
                                        {saving ? "Guardando..." : "Guardar"}
                                    </Button>
                                    <Button onClick={handleCancel} variant="outline" disabled={saving} className="gap-2">
                                        <X className="h-4 w-4" />
                                        Cancelar
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex flex-col items-center space-y-4 w-48 shrink-0">
                                    <Avatar className="w-32 h-32 border-4 border-primary">
                                        <AvatarImage src={isEditing ? editForm.avatarUrl : profile.avatar_url || ""} alt="Avatar" />
                                        <AvatarFallback className="bg-muted">
                                            <User className="w-16 h-16 text-muted-foreground" />
                                        </AvatarFallback>
                                    </Avatar>

                                    {isEditing && (
                                        <>
                                            <Label
                                                htmlFor="avatar-upload"
                                                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors text-sm"
                                            >
                                                {uploading ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Subiendo...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="w-4 h-4" />
                                                        Cambiar Avatar
                                                    </>
                                                )}
                                            </Label>
                                            <Input
                                                id="avatar-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleAvatarUpload}
                                                disabled={uploading || saving}
                                            />
                                            <p className="text-xs text-muted-foreground text-center">
                                                Máximo 2MB • JPG, PNG, GIF
                                            </p>
                                        </>
                                    )}
                                </div>

                                <div className="flex-1 space-y-4">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-base">Usuario:</Label>
                                            {isEditing ? (
                                                <Input
                                                    value={editForm.nickname}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, nickname: e.target.value }))}
                                                    disabled={saving}
                                                    maxLength={20}
                                                    className="h-8 w-48 border-border/50"
                                                />
                                            ) : (
                                                <p className="text-lg text-muted-foreground font-medium">{profile.nickname}</p>
                                            )}
                                        </div>


                                        <div className="flex items-center gap-2">
                                            <Label className="text-base">Región:</Label>
                                            <p className="text-lg text-muted-foreground font-medium">
                                                {profile.region}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Label className="text-base">Rango:</Label>
                                            <div>
                                                <RankBadge rank={profile.rank} size="lg" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="text-[#5865F2]">
                                                    <DiscordIcon />
                                                </div>
                                            </div>
                                            {isEditing ? (
                                                <Input
                                                    value={editForm.discord}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, discord: e.target.value }))}
                                                    disabled={saving}
                                                    placeholder="usuario#1234"
                                                    maxLength={37}
                                                    className="h-8 w-48 border-border/50"
                                                />
                                            ) : (
                                                <p className="text-lg text-muted-foreground font-medium">
                                                    {profile.discord || "No configurado"}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-primary" />
                                Estadísticas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 rounded-lg bg-muted/50">
                                    <div className="text-3xl font-bold text-primary">{profile.elo}</div>
                                    <div className="text-xs text-muted-foreground uppercase">ELO Rating</div>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-muted/50">
                                    <div className="text-3xl font-bold">{profile.games_played}</div>
                                    <div className="text-xs text-muted-foreground uppercase">Partidas</div>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-muted/50">
                                    <div className="text-3xl font-bold text-accent">{profile.wins}</div>
                                    <div className="text-xs text-muted-foreground uppercase">Victorias</div>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-muted/50">
                                    <div className="text-3xl font-bold">{winrate}%</div>
                                    <div className="text-xs text-muted-foreground uppercase">Win Rate</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Profile;
