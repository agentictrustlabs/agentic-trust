'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Alert } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

export default function NistAiAgentIdentificationAndAuthorizationAliasPage() {
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
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (loadingDoc) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">Loading…</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', minHeight: '100vh' }}>
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
  );
}

