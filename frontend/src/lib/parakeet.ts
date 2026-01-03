// This file is deprecated in the web version.
// Parakeet/NeMo models are local inference engines not supported in the web app.

export class ParakeetAPI {
  static async init(): Promise<void> {}
  static async getAvailableModels(): Promise<any[]> { return []; }
  static async loadModel(modelName: string): Promise<void> {}
  static async getCurrentModel(): Promise<string | null> { return null; }
  static async isModelLoaded(): Promise<boolean> { return false; }
  static async transcribeAudio(audioData: number[]): Promise<string> { return ""; }
  static async getModelsDirectory(): Promise<string> { return ""; }
  static async downloadModel(modelName: string): Promise<void> {}
  static async cancelDownload(modelName: string): Promise<void> {}
  static async deleteCorruptedModel(modelName: string): Promise<string> { return ""; }
  static async hasAvailableModels(): Promise<boolean> { return false; }
  static async validateModelReady(): Promise<string> { return ""; }
  static async openModelsFolder(): Promise<void> {}
}

export const PARAKEET_MODEL_CONFIGS = {};
export const MODEL_DISPLAY_CONFIG = {};

export function getModelDisplayName(name: string): string { return name; }
export function getModelDisplayInfo(name: string): any { return null; }
export function isQuantizedModel(name: string): boolean { return false; }
export function getModelPerformanceBadge(quantization: any): any { return { label: '', color: '' }; }
export function getStatusColor(status: any): string { return ''; }
export function formatFileSize(size: number): string { return ''; }
export function getModelIcon(accuracy: any): string { return ''; }
