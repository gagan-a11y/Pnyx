"use client";

import { Transcript } from '@/types';
import { TranscriptView } from '@/components/TranscriptView';
import { TranscriptButtonGroup } from './TranscriptButtonGroup';

interface TranscriptPanelProps {
  transcripts: Transcript[];
  onCopyTranscript: () => void;
  onOpenMeetingFolder: () => Promise<void>;
  isRecording: boolean;
}

export function TranscriptPanel({
  transcripts,
  onCopyTranscript,
  onOpenMeetingFolder,
  isRecording
}: TranscriptPanelProps) {
  return (
    <div className="hidden md:flex md:w-1/4 lg:w-1/3 min-w-0 border-r border-gray-200 bg-white flex-col relative shrink-0">
      {/* Title area */}
      <div className="p-4 border-b border-gray-200">
        <TranscriptButtonGroup
          transcriptCount={transcripts?.length || 0}
          onCopyTranscript={onCopyTranscript}
          onOpenMeetingFolder={onOpenMeetingFolder}
        />
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto pb-4">
        <TranscriptView transcripts={transcripts} />
      </div>
    </div>
  );
}
