/** Nordic UART Service (ver docs/ble-protocol.md). */
export const NUS_SERVICE = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
export const NUS_TX = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"; // placa → app (notify)
export const NUS_RX = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"; // app → placa (write)

export const DEVICE_ARM = "XIAO-ARM";
export const DEVICE_TORSO = "XIAO-TORSO";

/** Comandos hacia la placa. */
export const CMD_SYNC = "S";
export const CMD_START = "G";
export const CMD_STOP = "X";
