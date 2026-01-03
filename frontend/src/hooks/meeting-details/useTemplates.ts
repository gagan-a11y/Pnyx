import { useState, useEffect, useCallback } from 'react';

import { toast } from 'sonner';
import Analytics from '@/lib/analytics';

export function useTemplates() {
  const [availableTemplates, setAvailableTemplates] = useState<Array<{
    id: string;
    name: string;
    description: string;
  }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard_meeting');

  // Fetch available templates on mount
  useEffect(() => {
    // Mock templates for web version
    const templates = [
      { id: 'standard_meeting', name: 'Standard Meeting', description: 'Standard meeting summary with key points and action items' },
      { id: 'daily_standup', name: 'Daily Standup', description: 'Concise update on progress, plans, and blockers' },
      { id: 'interview', name: 'Interview', description: 'Candidate assessment and key discussion points' },
      { id: 'brainstorming', name: 'Brainstorming', description: 'Capture ideas, suggestions, and creative concepts' }
    ];
    setAvailableTemplates(templates);
  }, []);

  // Handle template selection
  const handleTemplateSelection = useCallback((templateId: string, templateName: string) => {
    setSelectedTemplate(templateId);
    toast.success('Template selected', {
      description: `Using "${templateName}" template for summary generation`,
    });
    Analytics.trackFeatureUsed('template_selected');
  }, []);

  return {
    availableTemplates,
    selectedTemplate,
    handleTemplateSelection,
  };
}
