import * as React from 'react';

import { copyToClipboardAsync } from '../native-modules/DevMenu';

export function useClipboard(clearInMillis: number = 3000) {
  const [clipboardContent, setClipboardContent] = React.useState('');
  const [clipboardError, setClipboardError] = React.useState('');

  const timerRef = React.useRef(null);

  React.useEffect(() => {
    if (clipboardContent) {
      timerRef.current = setTimeout(() => {
        setClipboardContent('');
      }, clearInMillis);
    }

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [clipboardContent, clearInMillis]);

  async function onCopyPress(data: object) {
    const content = JSON.stringify(data, null, 2);

    setClipboardError('');
    setClipboardContent(content);

    await copyToClipboardAsync(content).catch((err) => {
      setClipboardError(err.message);
      setClipboardContent('');
    });
  }

  return {
    onCopyPress,
    clipboardContent,
    clipboardError,
  };
}
