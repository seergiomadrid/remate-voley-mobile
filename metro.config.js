// core/ vive dentro de este repo (mobile/core) y se empaqueta como fuente TS.
// Sus imports usan extensión ".js" (estilo ESM de TypeScript), pero los
// archivos reales son ".ts". Metro no resuelve eso por defecto, así que
// reescribimos los imports relativos ".js" a sin extensión y dejamos que
// Metro encuentre el ".ts"/".tsx" correspondiente.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest || context.resolveRequest;
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return resolve(context, moduleName.replace(/\.js$/, ""), platform);
    } catch {
      // Si no existe el .ts, intentamos la ruta original (.js real).
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
