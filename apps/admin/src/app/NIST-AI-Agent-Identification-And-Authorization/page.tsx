'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Alert } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

import { Header } from '@/components/Header';
import { useAuth } from '@/components/AuthProvider';

export default function NistAiAgentIdentificationAndAuthorizationAliasPage() {
  const {
    isConnected,
    privateKeyMode,
    loading,
    walletAddress,
    openLoginModal,
    handleDisconnect,
  } = useAuth();

  const [markdown, setMarkdown] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  const apiUrl = useMemo(() => '/api/docs/agent-identity-authorization-submission', []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDoc(true);
      setError(null);
      try {
        const res = await fetch(apiUrl, { method: 'GET', headers: { accept: 'application/json' } });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json?.ok || typeof json?.markdown !== 'string') {
          throw new Error(typeof json?.error === 'string' ? json.error : `Failed to load submission (${res.status})`);
        }
        if (!cancelled) setMarkdown(json.markdown);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load submission');
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  if (error) {
    return (
      <Box sx={{ bgcolor: 'background.paper', minHeight: '100vh' }}>
        <Header
          displayAddress={walletAddress ?? null}
          privateKeyMode={privateKeyMode}
          isConnected={isConnected}
          onConnect={openLoginModal}
          onDisconnect={handleDisconnect}
          disableConnect={loading}
        />
        <Box sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Box>
    );
  }

  if (loadingDoc) {
    return (
      <Box sx={{ bgcolor: 'background.paper', minHeight: '100vh' }}>
        <Header
          displayAddress={walletAddress ?? null}
          privateKeyMode={privateKeyMode}
          isConnected={isConnected}
          onConnect={openLoginModal}
          onDisconnect={handleDisconnect}
          disableConnect={loading}
        />
        <Box sx={{ p: 2 }}>
          <Alert severity="info">Loading…</Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.paper', minHeight: '100vh' }}>
      <Header
        displayAddress={walletAddress ?? null}
        privateKeyMode={privateKeyMode}
        isConnected={isConnected}
        onConnect={openLoginModal}
        onDisconnect={handleDisconnect}
        disableConnect={loading}
      />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Box className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeSlug,
              [
                rehypeAutolinkHeadings,
                { behavior: 'wrap', properties: { style: 'text-decoration:none; color: inherit;' } },
              ],
            ]}
          >
            {markdown}
          </ReactMarkdown>
        </Box>
      </Box>
    </Box>
  );
}

