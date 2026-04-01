'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Container, Stack, Typography, Alert, Link as MuiLink, Card, CardContent } from '@mui/material';
import { Explore as ExploreIcon, DescriptionOutlined } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

import { Header } from '@/components/Header';
import { useAuth } from '@/components/AuthProvider';
import { grayscalePalette as palette } from '@/styles/palette';

const API_URL = '/api/docs/agent-identity-authorization-submission';

export default function SubmissionPage() {
  const router = useRouter();
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDoc(true);
      setError(null);
      try {
        const res = await fetch(API_URL, { method: 'GET', headers: { accept: 'application/json' } });
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
  }, []);

  const rawUrl = useMemo(() => `${API_URL}?format=raw`, []);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Header
        displayAddress={walletAddress ?? null}
        privateKeyMode={privateKeyMode}
        isConnected={isConnected}
        onConnect={openLoginModal}
        onDisconnect={handleDisconnect}
        disableConnect={loading}
      />

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 6 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: '0.2em', color: 'text.secondary', fontWeight: 800 }}>
              Public comment submission (Markdown)
            </Typography>
            <Typography variant="h3" sx={{ mt: 1, fontWeight: 900, lineHeight: 1.1 }}>
              AI Agent Identity & Authorization
            </Typography>
            <Typography variant="h6" sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 980 }}>
              Rendered from the repository Markdown file, with headings, lists, and links preserved.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<ExploreIcon />}
                onClick={() => router.push('/agents')}
                sx={{ fontWeight: 900, borderRadius: 3, textTransform: 'none' }}
              >
                Explore live agents
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => router.push('/principles')}
                sx={{ fontWeight: 900, borderRadius: 3, textTransform: 'none', borderColor: palette.borderStrong }}
              >
                Back to principles
              </Button>
              <Button
                variant="text"
                size="large"
                component="a"
                href={rawUrl}
                startIcon={<DescriptionOutlined />}
                sx={{ fontWeight: 900, borderRadius: 3, textTransform: 'none' }}
              >
                Download raw Markdown
              </Button>
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {loadingDoc && !error && <Alert severity="info">Loading…</Alert>}

          {!loadingDoc && !error && (
            <Card variant="outlined" sx={{ borderRadius: 4, borderColor: palette.border, backgroundColor: 'background.paper' }}>
              <CardContent sx={{ px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3.5 } }}>
                <Box
                  sx={{
                    '& h1': { typography: 'h4', fontWeight: 900, mt: 2.5, mb: 1 },
                    '& h2': { typography: 'h5', fontWeight: 900, mt: 2.5, mb: 1 },
                    '& h3': { typography: 'h6', fontWeight: 900, mt: 2.25, mb: 1 },
                    '& p': { typography: 'body1', color: 'text.secondary', mb: 1.5 },
                    '& ul, & ol': { pl: 3.5, mb: 1.5, color: 'text.secondary' },
                    '& li': { mb: 0.5 },
                    '& a': { color: 'primary.main', fontWeight: 800 },
                    '& blockquote': {
                      m: 0,
                      my: 2,
                      px: 2,
                      py: 1.5,
                      borderLeft: `4px solid ${palette.borderStrong}`,
                      backgroundColor: palette.surfaceMuted,
                      borderRadius: 2,
                    },
                    '& code': {
                      fontFamily: 'monospace',
                      fontSize: '0.95em',
                      backgroundColor: palette.surfaceMuted,
                      border: `1px solid ${palette.border}`,
                      borderRadius: 1.5,
                      px: 0.75,
                      py: 0.2,
                    },
                    '& pre': {
                      overflowX: 'auto',
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${palette.border}`,
                      backgroundColor: palette.surfaceMuted,
                    },
                    '& pre code': {
                      backgroundColor: 'transparent',
                      border: 'none',
                      p: 0,
                    },
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[
                      rehypeSlug,
                      [
                        rehypeAutolinkHeadings,
                        { behavior: 'wrap', properties: { style: 'text-decoration:none; color: inherit;' } },
                      ],
                    ]}
                    components={{
                      a: ({ href, children }) => (
                        <MuiLink href={href as string} target={String(href || '').startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                          {children}
                        </MuiLink>
                      ),
                    }}
                  >
                    {markdown}
                  </ReactMarkdown>
                </Box>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

