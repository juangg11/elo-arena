import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CreateProfile = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);

  const [formData, setFormData] = useState({
    nickname: "",
    region: "ES",
    avatarUrl: ""
  });

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setRequiresLogin(true);
      return;
    }

    setUserId(user.id);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (existingProfile) {
      toast({
        title: "Perfil existente",
        description: "Ya tienes un perfil creado",
      });
      setSuccess(true);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

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
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));

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

  const handleSubmit = async () => {
    if (!formData.nickname.trim()) {
      toast({
        title: "Error",
        description: "El nombre de usuario es obligatorio",
        variant: "destructive"
      });
      return;
    }

    if (formData.nickname.length < 3 || formData.nickname.length > 20) {
      toast({
        title: "Error",
        description: "El nombre debe tener entre 3 y 20 caracteres",
        variant: "destructive"
      });
      return;
    }

    if (!userId) return;

    setLoading(true);

    try {
      const { data: existingNickname } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("nickname", formData.nickname)
        .single();

      if (existingNickname) {
        toast({
          title: "Error",
          description: "Este nombre de usuario ya está en uso",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .insert({
          user_id: userId,
          nickname: formData.nickname,
          region: formData.region,
          avatar_url: formData.avatarUrl || null,
          elo: 600,
          rank: "aspirante",
          games_played: 0,
          wins: 0
        });

      if (error) throw error;

      toast({
        title: "¡Perfil creado!",
        description: "Tu perfil ha sido creado exitosamente",
      });

      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al crear el perfil",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (requiresLogin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 text-center">
          <CardContent className="pt-12 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <User className="w-12 h-12 text-muted-foreground" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">Iniciar Sesión</h2>
            <p className="text-muted-foreground">
              Debes iniciar sesión para crear tu perfil.
            </p>
            <Button onClick={() => window.location.href = "/auth"} className="w-full mt-4">
              Ir a Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 text-center">
          <CardContent className="pt-12 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">¡Perfil Creado!</h2>
            <p className="text-muted-foreground">
              Tu perfil ha sido configurado exitosamente. Redirigiendo...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Crear Perfil
          </CardTitle>
          <CardDescription>
            Configura tu perfil para empezar a competir
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24 border-2 border-primary">
                <AvatarImage src={formData.avatarUrl} alt="Avatar" />
                <AvatarFallback className="bg-muted">
                  <User className="w-12 h-12 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>

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
                    Subir Avatar
                  </>
                )}
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading || loading}
              />
              <p className="text-xs text-muted-foreground">
                Máximo 2MB • JPG, PNG, GIF
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">Nombre de Usuario *</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="Ej: ThunderBolt"
                value={formData.nickname}
                onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                disabled={loading}
                maxLength={20}
                className="border-border/50"
              />
              <p className="text-xs text-muted-foreground">
                Entre 3 y 20 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Región *</Label>
              <Select
                value={formData.region}
                onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                disabled={loading}
              >
                <SelectTrigger id="region" className="border-border/50">
                  <SelectValue placeholder="Selecciona tu región" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ES">España</SelectItem>
                  <SelectItem value="FR">Francia</SelectItem>
                  <SelectItem value="LATAM">Latinoamérica</SelectItem>
                  <SelectItem value="ASIA">Asia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
              <p className="text-sm text-muted-foreground">
                📊 Comenzarás con <span className="font-bold text-primary">600 ELO</span> en el rango{" "}
                <span className="font-bold text-rank-aspirante">Aspirante</span>
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={loading || uploading || !formData.nickname.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando perfil...
                </>
              ) : (
                "Crear Perfil"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateProfile;