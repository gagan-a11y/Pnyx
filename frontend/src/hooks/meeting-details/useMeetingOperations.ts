import { useCallback } from 'react';
import { toast } from 'sonner';

interface UseMeetingOperationsProps {
  meeting: any;
}

export function useMeetingOperations({
  meeting,
}: UseMeetingOperationsProps) {

  // Open meeting folder in file explorer
  const handleOpenMeetingFolder = useCallback(async () => {
    try {
      // Web app cannot access local file system directly to open folders
      toast.info('Feature not available in web version', {
        description: 'Opening local folders is not supported in the browser.'
      });
    } catch (error) {
      console.error('Failed to open meeting folder:', error);
      toast.error(error as string || 'Failed to open recording folder');
    }
  }, [meeting.id]);

  return {
    handleOpenMeetingFolder,
  };
}
