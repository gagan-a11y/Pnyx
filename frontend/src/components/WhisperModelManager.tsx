import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ModelInfo,
  getModelIcon,
  getModelTagline,
  WhisperAPI // This is now stubbed
} from '../lib/whisper';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface ModelManagerProps {
  selectedModel?: string;
  onModelSelect?: (modelName: string) => void;
  className?: string;
  autoSave?: boolean;
}

export function ModelManager({
  selectedModel,
  onModelSelect,
  className = '',
  autoSave = false
}: ModelManagerProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize models (simulated for web)
  useEffect(() => {
    const initializeModels = async () => {
      try {
        setLoading(true);
        // In web mode, we assume the server handles models or we just show a static list
        // Since WhisperAPI is stubbed, we can use it to return mock data if updated, 
        // or just hardcode available models here for the UI.

        // Mock data for web UI
        const mockModels: ModelInfo[] = [
          { name: 'base', path: '', size_mb: 140, accuracy: 'Good', speed: 'Fast', status: 'Available' },
          { name: 'small', path: '', size_mb: 460, accuracy: 'Good', speed: 'Medium', status: 'Available' },
          { name: 'large-v3-turbo', path: '', size_mb: 1500, accuracy: 'High', speed: 'Slow', status: 'Available' }
        ];

        setModels(mockModels);

        if (!selectedModel && onModelSelect && mockModels.length > 0) {
          onModelSelect(mockModels[0].name);
        }

      } catch (err) {
        console.error('Failed to initialize Whisper models:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeModels();
  }, []);

  const selectModel = (modelName: string) => {
    if (onModelSelect) {
      onModelSelect(modelName);
    }
    const displayName = getDisplayName(modelName);
    toast.success(`Switched to ${displayName}`);
  };

  const getDisplayName = (modelName: string): string => {
    const modelNameMapping: { [key: string]: string } = {
      "base": "Small",
      "small": "Medium",
      "large-v3-turbo": "Large"
    };
    return modelNameMapping[modelName] || modelName;
  };

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-gray-100 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Simplified Model Card for Web (No download/delete)
  const renderModelCard = (model: ModelInfo) => {
    const isSelected = selectedModel === model.name;
    const displayName = getDisplayName(model.name);

    return (
      <div
        key={model.name}
        onClick={() => selectModel(model.name)}
        className={`
                relative rounded-lg border-2 transition-all cursor-pointer p-4
                ${isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300 bg-white'
          }
            `}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{getModelIcon(model.accuracy)}</span>
              <h3 className="font-semibold text-gray-900">{displayName}</h3>
              {isSelected && (
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-medium">✓</span>
              )}
            </div>
            <p className="text-sm text-gray-600 ml-9">{getModelTagline(model.name, model.speed, model.accuracy)}</p>
          </div>
          <div className="flex items-center gap-1.5 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs font-medium">Ready</span>
          </div>
        </div>
      </div>
    );
  };

  const basicModelNames = ["base", "small", "large-v3-turbo"];
  const basicModels = models.filter(m => basicModelNames.includes(m.name));

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="p-3 bg-blue-50 rounded-md mb-4">
        <p className="text-xs text-blue-800">
          <strong>Web Mode:</strong> Transcription models are managed by the server.
        </p>
      </div>

      <div className="space-y-3">
        {basicModels.map(renderModelCard)}
      </div>
    </div>
  );
}
