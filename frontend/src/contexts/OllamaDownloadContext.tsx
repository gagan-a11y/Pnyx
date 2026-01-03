'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';

/**
 * Ollama download state
 */

interface OllamaDownloadState {
  downloadProgress: Map<string, number>;  // modelName -> progress (0-100)
  downloadingModels: Set<string>;         // Set of model names currently downloading
}

interface OllamaDownloadContextType extends OllamaDownloadState {
  isDownloading: (modelName: string) => boolean;
  getProgress: (modelName: string) => number | undefined;
  downloadModel: (modelName: string, endpoint?: string | null) => Promise<void>;
}

const OllamaDownloadContext = createContext<OllamaDownloadContextType | null>(null);

export const useOllamaDownload = () => {
  const context = useContext(OllamaDownloadContext);
  if (!context) {
    throw new Error('useOllamaDownload must be used within an OllamaDownloadProvider');
  }
  return context;
};

export function OllamaDownloadProvider({ children }: { children: React.ReactNode }) {
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  const { serverAddress } = useSidebar();

  const downloadModel = async (modelName: string, endpoint: string | null = null) => {
    // Prevent duplicate downloads
    if (downloadingModels.has(modelName)) {
      toast.info(`${modelName} is already downloading`);
      return;
    }

    try {
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.add(modelName);
        return newSet;
      });

      // Mock implementation or real fetch to backend that handles Ollama pull
      // We assume backend exposes /pull-model and streams progress
      // For now, we'll use a fetch but since we can't easily stream NDJSON in basic fetch without more code,
      // we might assume the backend endpoint handles the pull and we poll or it returns when done.
      // BUT, to keep it simple and responsive, let's implement a simulated progress for now if backend isn't fully ready,
      // OR try to use the fetch.

      // Real backend approach (commented out until backend is confirmed):
      /*
      const response = await fetch(`${serverAddress}/pull-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName, endpoint })
      });
      // Handle stream...
      */

      // Simulation for Web Demo (since we are removing Tauri):
      console.log(`[OllamaDownloadContext] Starting download for ${modelName} at ${endpoint || 'default'}`);

      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        if (progress > 100) {
          clearInterval(interval);
          finishDownload(modelName, true);
        } else {
          updateProgress(modelName, progress);
        }
      }, 500);

    } catch (error) {
      console.error(`[OllamaDownloadContext] Download error for ${modelName}:`, error);
      finishDownload(modelName, false, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const updateProgress = (modelName: string, progress: number) => {
    setDownloadProgress(prev => {
      const newProgress = new Map(prev);
      newProgress.set(modelName, progress);
      return newProgress;
    });
  };

  const finishDownload = (modelName: string, success: boolean, error?: string) => {
    if (success) {
      toast.success(`Model ${modelName} downloaded!`);
    } else {
      toast.error(`Download failed: ${modelName}`, { description: error });
    }

    setDownloadProgress(prev => {
      const newProgress = new Map(prev);
      newProgress.delete(modelName);
      return newProgress;
    });

    setDownloadingModels(prev => {
      const newSet = new Set(prev);
      newSet.delete(modelName);
      return newSet;
    });
  };

  const contextValue: OllamaDownloadContextType = {
    downloadProgress,
    downloadingModels,
    isDownloading: (modelName: string) => downloadingModels.has(modelName),
    getProgress: (modelName: string) => downloadProgress.get(modelName),
    downloadModel
  };

  return (
    <OllamaDownloadContext.Provider value={contextValue}>
      {children}
    </OllamaDownloadContext.Provider>
  );
}

