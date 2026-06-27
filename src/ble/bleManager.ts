/**
 * Gestión de las dos placas por BLE. Decodifica el protocolo binario con el
 * parser de @remate-voley/core y acumula las muestras de cada sensor.
 */
import { BleManager, Device, State } from "react-native-ble-plx";
import { PermissionsAndroid, Platform } from "react-native";
import { createBinaryParser, estimateFs } from "@core";
import type { SensorId, SensorSample, SensorStream } from "@core";
import { base64ToBytes, strToBase64 } from "@/util/base64";
import {
  CMD_START,
  CMD_STOP,
  CMD_SYNC,
  DEVICE_ARM,
  DEVICE_TORSO,
  NUS_RX,
  NUS_SERVICE,
  NUS_TX,
} from "./uuids";

export interface BoardState {
  sensor: SensorId;
  connected: boolean;
  batteryPct?: number;
  batteryV?: number;
  sampleCount: number;
  lastGyroDps: number;
  synced: boolean;
}

export interface BleState {
  arm: BoardState;
  torso: BoardState;
  scanning: boolean;
  capturing: boolean;
  error?: string;
}

type Listener = (state: BleState) => void;

interface Board {
  sensor: SensorId;
  deviceName: string;
  device: Device | null;
  parser: ReturnType<typeof createBinaryParser>;
  samples: SensorSample[];
  state: BoardState;
}

function emptyBoardState(sensor: SensorId): BoardState {
  return { sensor, connected: false, sampleCount: 0, lastGyroDps: 0, synced: false };
}

class RemateBle {
  private manager = new BleManager();
  private listeners = new Set<Listener>();
  private capturing = false;
  private scanning = false;
  private error?: string;

  private boards: Record<"ARM" | "TORSO", Board> = {
    ARM: { sensor: "ARM", deviceName: DEVICE_ARM, device: null, parser: createBinaryParser(), samples: [], state: emptyBoardState("ARM") },
    TORSO: { sensor: "TORSO", deviceName: DEVICE_TORSO, device: null, parser: createBinaryParser(), samples: [], state: emptyBoardState("TORSO") },
  };

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((l) => l(s));
  }

  snapshot(): BleState {
    return {
      arm: { ...this.boards.ARM.state },
      torso: { ...this.boards.TORSO.state },
      scanning: this.scanning,
      capturing: this.capturing,
      error: this.error,
    };
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    const sdk = Platform.Version as number;
    const perms =
      sdk >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const res = await PermissionsAndroid.requestMultiple(perms);
    return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }

  async scanAndConnect(): Promise<void> {
    const ok = await this.requestPermissions();
    if (!ok) {
      this.error = "Permisos de Bluetooth denegados.";
      this.emit();
      return;
    }
    // Esperar a que el adaptador esté encendido.
    const state = await this.manager.state();
    if (state !== State.PoweredOn) {
      this.error = "Activa el Bluetooth para conectar los sensores.";
      this.emit();
      return;
    }

    this.error = undefined;
    this.scanning = true;
    this.emit();

    this.manager.startDeviceScan([NUS_SERVICE], null, (err, device) => {
      if (err) {
        this.error = err.message;
        this.scanning = false;
        this.emit();
        return;
      }
      if (!device?.name) return;
      const board = device.name === DEVICE_ARM ? this.boards.ARM : device.name === DEVICE_TORSO ? this.boards.TORSO : null;
      if (board && !board.device) {
        this.connectBoard(board, device);
      }
      if (this.boards.ARM.device && this.boards.TORSO.device) {
        this.manager.stopDeviceScan();
        this.scanning = false;
        this.emit();
      }
    });

    // Detener el escaneo tras 12 s aunque falte alguna placa.
    setTimeout(() => {
      if (this.scanning) {
        this.manager.stopDeviceScan();
        this.scanning = false;
        this.emit();
      }
    }, 12000);
  }

  private async connectBoard(board: Board, device: Device) {
    try {
      board.device = device;
      const connected = await device.connect({ requestMTU: 247 });
      await connected.discoverAllServicesAndCharacteristics();
      board.state.connected = true;
      this.emit();

      connected.onDisconnected(() => {
        board.state.connected = false;
        board.device = null;
        this.emit();
      });

      connected.monitorCharacteristicForService(NUS_SERVICE, NUS_TX, (err, char) => {
        if (err || !char?.value) return;
        this.onData(board, base64ToBytes(char.value));
      });
    } catch (e: any) {
      board.device = null;
      this.error = `No se pudo conectar a ${board.deviceName}: ${e?.message ?? e}`;
      this.emit();
    }
  }

  private onData(board: Board, bytes: Uint8Array) {
    const items = board.parser.push(bytes);
    let changed = false;
    for (const item of items) {
      if (item.type === "data") {
        const last = item.samples[item.samples.length - 1];
        if (last) board.state.lastGyroDps = Math.round(last.gyroMag);
        if (this.capturing) {
          for (const s of item.samples) board.samples.push(s);
          board.state.sampleCount = board.samples.length;
        }
        changed = true;
      } else if (item.type === "status") {
        board.state.batteryV = item.batteryV;
        board.state.batteryPct = item.batteryPct;
        changed = true;
      } else if (item.type === "syncAck") {
        board.state.synced = true;
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private async send(board: Board, cmd: string) {
    if (!board.device) return;
    await board.device.writeCharacteristicWithoutResponseForService(NUS_SERVICE, NUS_RX, strToBase64(cmd));
  }

  /** Sincroniza los relojes: SYNC a ambas placas y limpia parsers/buffers. */
  async sync(): Promise<void> {
    for (const b of [this.boards.ARM, this.boards.TORSO]) {
      b.parser.reset();
      b.samples = [];
      b.state.sampleCount = 0;
      b.state.synced = false;
    }
    await Promise.all([this.send(this.boards.ARM, CMD_SYNC), this.send(this.boards.TORSO, CMD_SYNC)]);
    this.emit();
  }

  async startCapture(): Promise<void> {
    for (const b of [this.boards.ARM, this.boards.TORSO]) {
      b.samples = [];
      b.state.sampleCount = 0;
    }
    this.capturing = true;
    await Promise.all([this.send(this.boards.ARM, CMD_START), this.send(this.boards.TORSO, CMD_START)]);
    this.emit();
  }

  /** Detiene la captura y devuelve los streams acumulados. */
  stopCapture(): { arm: SensorStream | null; torso: SensorStream | null } {
    this.capturing = false;
    const build = (b: Board): SensorStream | null =>
      b.samples.length
        ? { sensor: b.sensor, samples: b.samples.slice(), fs: estimateFs(b.samples), batteryV: b.state.batteryV, batteryPct: b.state.batteryPct }
        : null;
    const result = { arm: build(this.boards.ARM), torso: build(this.boards.TORSO) };
    this.emit();
    return result;
  }

  disconnectAll() {
    for (const b of [this.boards.ARM, this.boards.TORSO]) {
      b.device?.cancelConnection().catch(() => {});
      b.device = null;
      b.state = emptyBoardState(b.sensor);
      b.parser.reset();
      b.samples = [];
    }
    this.capturing = false;
    this.emit();
  }
}

export const ble = new RemateBle();
