# Matchmaking Bot Simulator

Sistema de bots para probar el matchmaking de ELO Arena.

## 🎯 Características

- ✅ Autenticación automática (crea usuarios si no existen)
- ✅ Configuración de región y ELO
- ✅ Entrada automática en cola de matchmaking
- ✅ Chat automático cuando se encuentra match
- ✅ Declaración automática de resultados
- ✅ Suscripción en tiempo real a eventos
- ✅ Limpieza automática de recursos

## 📋 Requisitos Previos

1. Tener el proyecto configurado con Supabase
2. Variables de entorno en `.env`:
   ```
   VITE_SUPABASE_URL=tu_url
   VITE_SUPABASE_ANON_KEY=tu_key
   ```

## 🚀 Uso

### Opción 1: Modo Interactivo

```bash
npm run simulate-bot
```

Te mostrará una lista de bots configurados en `scripts/bot-config.json` para elegir.

### Opción 2: Seleccionar Bot por Nombre

```bash
npm run simulate-bot -- --bot="Bot EU Low"
```

### Opción 3: Crear Bot desde CLI

```bash
npm run simulate-bot -- --name="Mi Bot" --region=EU --elo=600
```

Regiones disponibles: `EU`, `AM`, `AS`, `global`

## 📝 Configuración de Bots

Edita `scripts/bot-config.json` para configurar bots predefinidos:

```json
{
  "bots": [
    {
      "name": "Bot EU Low",
      "email": "bot-eu-low@test.com",
      "password": "TestBot123!",
      "region": "EU",
      "elo": 600,
      "autoChat": true,
      "chatMessages": [
        "Hola! Listo para jugar?",
        "Buena suerte!",
        "GG!"
      ],
      "autoResult": "win",
      "delayBeforeResult": 30000
    }
  ]
}
```

### Parámetros de Configuración

- **name**: Nombre del bot (aparecerá como nickname)
- **email**: Email para autenticación
- **password**: Contraseña del bot
- **region**: Región del bot (`EU`, `AM`, `AS`, `global`)
- **elo**: Rating ELO del bot
- **autoChat**: Si debe enviar mensajes automáticamente
- **chatMessages**: Array de mensajes a enviar (con 5s de delay entre cada uno)
- **autoResult**: Resultado a declarar (`"win"`, `"lose"`, o `null` para manual)
- **delayBeforeResult**: Milisegundos antes de declarar resultado (default: 30000)

## 🧪 Escenarios de Prueba

### Probar Matchmaking en la Misma Región

Terminal 1:
```bash
npm run simulate-bot -- --name="Bot1" --region=EU --elo=600
```

Terminal 2:
```bash
npm run simulate-bot -- --name="Bot2" --region=EU --elo=620
```

Deberían encontrarse en ~2 segundos.

### Probar Expansión de Región

Terminal 1:
```bash
npm run simulate-bot -- --name="BotEU" --region=EU --elo=600
```

Terminal 2:
```bash
npm run simulate-bot -- --name="BotAM" --region=AM --elo=610
```

Deberían encontrarse después de 3 minutos (cuando se expande a global).

### Probar con Usuario Real

1. Inicia un bot:
   ```bash
   npm run simulate-bot -- --bot="Bot EU Low"
   ```

2. Abre la aplicación en el navegador
3. Entra en matchmaking con un usuario real
4. Deberías encontrar al bot y poder chatear con él

## 📊 Salida del Bot

El bot mostrará información en tiempo real:

```
[Bot EU Low] Authenticating...
[Bot EU Low] Signed in successfully
[Bot EU Low] Profile loaded: Bot EU Low (ELO: 600)
[Bot EU Low] Entering matchmaking queue...
  Region: EU
  ELO: 600
[Bot EU Low] ✓ In queue (ID: abc-123)
[Bot EU Low] Subscribed to queue updates
[Bot EU Low] 🎮 MATCH FOUND! Match ID: xyz-789
[Bot EU Low] Joining match xyz-789...
[Bot EU Low] 💬 Sent: "Hola! Listo para jugar?"
[Bot EU Low] 💬 Received: "Hola!"
[Bot EU Low] Will declare result 'win' in 30s
[Bot EU Low] ✓ Result declared: win
[Bot EU Low] ✓ Match completed!
```

## 🛑 Detener el Bot

Presiona `Ctrl+C` para detener el bot de forma segura. Se limpiarán automáticamente:
- Entrada en la cola de matchmaking
- Suscripciones en tiempo real
- Sesión de autenticación

## 🔧 Troubleshooting

### Error: "Missing Supabase credentials"
- Verifica que el archivo `.env` tenga las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

### El bot no encuentra matches
- Verifica que haya otro bot o usuario en la cola
- Revisa que los rangos de ELO sean compatibles (±50 inicialmente)
- Espera 3 minutos para la expansión regional

### Error de autenticación
- Verifica que el email/password sean válidos
- Si el usuario ya existe, asegúrate de usar la misma contraseña

## 💡 Tips

- Usa múltiples terminales para simular varios bots simultáneamente
- Ajusta `delayBeforeResult` para dar tiempo a probar el chat
- Configura bots con diferentes ELOs para probar el algoritmo de matchmaking
- Usa `autoResult: null` si quieres declarar el resultado manualmente
