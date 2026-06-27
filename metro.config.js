// core/ vive dentro de este repo (mobile/core), así que no hace falta
// configuración especial de monorepo. Metro lo resuelve vía el alias @core.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
