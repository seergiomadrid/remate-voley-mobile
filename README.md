# RemateVoley — App móvil (iOS + Android)

App Expo que **captura los datos de las dos placas por BLE y muestra el dashboard,
sin necesidad de ordenador**. Reutiliza la librería `@remate-voley/core`.

## Requisitos
- Node 18+ y la cuenta de Expo (EAS).
- Las placas flasheadas con el firmware nuevo (protocolo binario, ver `../docs/ble-protocol.md`).

> **Importante:** la app usa BLE nativo (`react-native-ble-plx`), que **no funciona en
> Expo Go**. Hay que generar un *dev build* con EAS.

## Puesta en marcha

```bash
cd mobile
npm install
npx expo install            # alinea versiones nativas

# Dev build (una vez por dispositivo)
npm i -g eas-cli
eas login
eas build --profile development --platform android   # APK para sideload
eas build --profile development --platform ios        # requiere cuenta Apple
# Instala el build en el móvil y luego:
npm start                    # arranca Metro para el dev client
```

Para una APK instalable directamente (sin servidor de desarrollo):
```bash
eas build --profile preview --platform android
```

## Flujo de uso
1. **Conectar sensores** — escanea y conecta `XIAO-ARM` y `XIAO-TORSO`.
2. **Sincronizar relojes** — pulsa el botón y **junta/golpea las dos placas** una vez.
3. **Iniciar captura** → haz tu serie de remates → **Detener y analizar**.
4. Se guarda la sesión y se abre el **dashboard** (calidad, picos, secuencia, consejos).
5. **Historial** — progreso entre sesiones y carga ACWR.

## Estructura
- `src/ble/` — conexión BLE y decodificación del protocolo binario (vía core).
- `src/db/` — persistencia SQLite (`docs/database-schema.dbml`).
- `src/analysis/` — payload de sesión para el dashboard.
- `app/` — pantallas (expo-router): captura, historial, sesión.

## Notas
- iOS: para instalar en tu iPhone necesitas un dev build (TestFlight o build interno con tu Apple ID).
- Android: la APK de `preview` se puede instalar directamente (sideload).
- El monorepo comparte `../core` vía `metro.config.js` (watchFolders) y el alias `@core`.
