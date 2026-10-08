import React from 'react';
import { CaseChatWorkspace, CaseChatWorkspaceProps } from './CaseChatWorkspace';

// Integrated with VoiceRecorder using renderMode="inline-composer"
export type CaseDiscussWorkspaceProps = CaseChatWorkspaceProps;
export const CaseDiscussWorkspace: React.FC<CaseChatWorkspaceProps> = (props) => {
  return <CaseChatWorkspace {...props} />;
};

export { CaseChatWorkspace };
export default CaseDiscussWorkspace;
